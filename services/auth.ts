import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

// Complete the auth session for better UX on mobile
WebBrowser.maybeCompleteAuthSession();

import { DISABLE_GOOGLE_AUTH, GOOGLE_OAUTH_CONFIG, isGoogleAuthConfigured } from '../config/google-auth';
import DatabaseService from './database';

// Create redirect URI using Expo's auth proxy for better compatibility
const redirectUri = AuthSession.makeRedirectUri();

console.log('Redirect URI:', redirectUri); // Debug log

export interface GoogleUrser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export interface AppleUser {
  id: string;
  email?: string;
  name?: string;
  fullName?: {
    givenName?: string;
    familyName?: string;
  };
}

class AuthService {
  private static instance: AuthService;
  private dbService = DatabaseService.getInstance();
  
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Save user to Supabase database
  private async saveUserToDatabase(user: GoogleUser | AppleUser, provider: 'google' | 'apple'): Promise<string | null> {
    try {
      // Check if user already exists
      const existingUser = await this.dbService.getUserByEmail(user.email || '');
      
      if (existingUser) {
        // Update last login
        await this.dbService.updateUserLastLogin(existingUser.id);
        console.log('User already exists, updated last login:', existingUser.id);
        return existingUser.id;
      } else {
        // Create new user
        const newUser = await this.dbService.createUser({
          email: user.email || '',
          name: user.name || '',
          picture: 'picture' in user ? user.picture : undefined,
          provider,
        });
        
        if (newUser) {
          console.log('New user created in database:', newUser.id);
          return newUser.id;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error saving user to database:', error);
      return null;
    }
  }

  // Sign in with Apple
  async signInWithApple(): Promise<AppleUser> {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Process the credential
      const appleUser: AppleUser = {
        id: credential.user,
        email: credential.email || undefined,
        name: credential.fullName ? 
          `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() : 
          undefined,
        fullName: credential.fullName ? {
          givenName: credential.fullName.givenName || undefined,
          familyName: credential.fullName.familyName || undefined,
        } : undefined,
      };

      // Save user to Supabase database
      const databaseUserId = await this.saveUserToDatabase(appleUser, 'apple');

      // Store user info locally
      await AsyncStorage.setItem('user', JSON.stringify(appleUser));
      await AsyncStorage.setItem('auth_provider', 'apple');
      if (databaseUserId) {
        await AsyncStorage.setItem('database_user_id', databaseUserId);
      }
      
      // Store Apple specific data
      if (credential.identityToken) {
        await AsyncStorage.setItem('apple_identity_token', credential.identityToken);
      }
      if (credential.authorizationCode) {
        await AsyncStorage.setItem('apple_auth_code', credential.authorizationCode);
      }

      return appleUser;
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        throw new Error('User cancelled Apple Sign In');
      }
      console.error('Apple Sign-In Error:', error);
      throw new Error('Apple Sign In failed');
    }
  }

  // Check if Apple Sign In is available
  async isAppleAuthenticationAvailable(): Promise<boolean> {
    return await AppleAuthentication.isAvailableAsync();
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<GoogleUser> {
    // Check if Google auth is disabled
    if (DISABLE_GOOGLE_AUTH) {
      throw new Error('Google Sign-In is temporarily disabled during development. Please use Apple Sign-In or manual signup.');
    }

    // Check if Google auth is properly configured
    if (!isGoogleAuthConfigured()) {
      throw new Error('Google Sign-In is not properly configured. Please contact support.');
    }

    try {
      console.log('Starting Google Sign-In...');
      console.log('Client ID:', GOOGLE_OAUTH_CONFIG.clientId);
      console.log('Redirect URI:', redirectUri);

      // Create request
      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_OAUTH_CONFIG.clientId,
        scopes: GOOGLE_OAUTH_CONFIG.scopes,
        redirectUri: redirectUri,
        responseType: AuthSession.ResponseType.Code,
        state: await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          Math.random().toString(),
          { encoding: Crypto.CryptoEncoding.HEX }
        ),
        extraParams: GOOGLE_OAUTH_CONFIG.additionalParameters,
      });

      // Start the auth session
      const result = await request.promptAsync({
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      });

      console.log('Auth result:', result);

      if (result.type === 'success') {
        // Exchange authorization code for access token
        const tokenResponse = await this.exchangeCodeForTokens(result.params.code);
        
        // Get user info from Google
        const userInfo = await this.getGoogleUserInfo(tokenResponse.access_token);
        
        // Save user to Supabase database
        const databaseUserId = await this.saveUserToDatabase(userInfo, 'google');
        
        // Store tokens securely
        await this.storeTokens(tokenResponse);
        
        // Store user info locally
        await AsyncStorage.setItem('user', JSON.stringify(userInfo));
        await AsyncStorage.setItem('auth_provider', 'google');
        if (databaseUserId) {
          await AsyncStorage.setItem('database_user_id', databaseUserId);
        }
        
        return userInfo;
      } else if (result.type === 'cancel') {
        throw new Error('User cancelled the authentication');
      } else {
        console.error('Auth failed with result:', result);
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  }

  // Exchange authorization code for tokens
  private async exchangeCodeForTokens(code: string): Promise<any> {
    console.log('Exchanging code for tokens...');
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });

    const responseText = await response.text();
    console.log('Token exchange response:', responseText);

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  // Get user information from Google
  private async getGoogleUserInfo(accessToken: string): Promise<GoogleUser> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return response.json();
  }

  // Store tokens securely
  private async storeTokens(tokens: any): Promise<void> {
    await AsyncStorage.setItem('access_token', tokens.access_token);
    if (tokens.refresh_token) {
      await AsyncStorage.setItem('refresh_token', tokens.refresh_token);
    }
  }

  // Get stored user (works for both Google and Apple)
  async getStoredUser(): Promise<GoogleUser | AppleUser | null> {
    try {
      const userString = await AsyncStorage.getItem('user');
      return userString ? JSON.parse(userString) : null;
    } catch (error) {
      console.error('Error getting stored user:', error);
      return null;
    }
  }

  // Get database user ID
  async getDatabaseUserId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('database_user_id');
    } catch (error) {
      console.error('Error getting database user ID:', error);
      return null;
    }
  }

  // Get auth provider
  async getAuthProvider(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('auth_provider');
    } catch (error) {
      console.error('Error getting auth provider:', error);
      return null;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        'user', 
        'access_token', 
        'refresh_token', 
        'auth_provider',
        'database_user_id',
        'apple_identity_token',
        'apple_auth_code'
      ]);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const user = await this.getStoredUser();
      const provider = await this.getAuthProvider();
      
      if (!user || !provider) return false;
      
      if (provider === 'google') {
        const token = await AsyncStorage.getItem('access_token');
        return !!(user && token);
      } else if (provider === 'apple') {
        const appleToken = await AsyncStorage.getItem('apple_identity_token');
        return !!(user && appleToken);
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
}

export default AuthService; 