import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../config/supabase';

// Complete the auth session for better UX on mobile
WebBrowser.maybeCompleteAuthSession();

export interface SupabaseUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'apple' | 'email';
}

class SupabaseAuthService {
  private static instance: SupabaseAuthService;
  
  public static getInstance(): SupabaseAuthService {
    if (!SupabaseAuthService.instance) {
      SupabaseAuthService.instance = new SupabaseAuthService();
    }
    return SupabaseAuthService.instance;
  }

  // Sign in with Google using Supabase
  async signInWithGoogle(): Promise<SupabaseUser> {
    try {
      console.log('Starting Supabase Google Sign-In...');

      // Use Expo's redirect URI that works reliably
      const redirectTo = AuthSession.makeRedirectUri();

      console.log('Redirect URI:', redirectTo);

      // Start the OAuth flow with Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Supabase OAuth error:', error);
        throw new Error(error.message);
      }

      if (!data?.url) {
        throw new Error('No OAuth URL returned from Supabase');
      }

      console.log('Opening OAuth URL:', data.url);

      // Use WebBrowser for proper redirect handling
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      console.log('Auth result:', result);

      if (result.type === 'success') {
        // The URL should contain the auth tokens
        const url = result.url;
        console.log('Success URL:', url);

        // Check if we got a successful redirect with tokens
        if (url.includes('access_token') || url.includes('#')) {
          // Wait a moment for Supabase to process the session
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Get the session from Supabase
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('Session error:', sessionError);
            throw new Error(sessionError.message);
          }

          if (session?.user) {
            const user: SupabaseUser = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.full_name || 
                    session.user.user_metadata?.name || 
                    session.user.email?.split('@')[0] || 'User',
              picture: session.user.user_metadata?.avatar_url || 
                      session.user.user_metadata?.picture,
              provider: 'google',
            };

            // Store user info locally
            await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
            await AsyncStorage.setItem('auth_provider', 'google');

            console.log('Google Sign-In Success:', user);
            return user;
          }
        }
        
        // If no session yet, try parsing URL fragments manually
        try {
          let accessToken = '';
          let refreshToken = '';
          
          if (url.includes('#')) {
            const fragment = url.split('#')[1];
            const params = new URLSearchParams(fragment);
            accessToken = params.get('access_token') || '';
            refreshToken = params.get('refresh_token') || '';
          } else if (url.includes('access_token')) {
            const urlParams = new URLSearchParams(url.split('?')[1]);
            accessToken = urlParams.get('access_token') || '';
            refreshToken = urlParams.get('refresh_token') || '';
          }
          
          if (accessToken) {
            console.log('Setting session with tokens...');
            const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (setSessionError) {
              console.error('Set session error:', setSessionError);
              throw new Error(setSessionError.message);
            }
            
            if (sessionData.user) {
              const user: SupabaseUser = {
                id: sessionData.user.id,
                email: sessionData.user.email || '',
                name: sessionData.user.user_metadata?.full_name || 
                      sessionData.user.user_metadata?.name || 
                      sessionData.user.email?.split('@')[0] || 'User',
                picture: sessionData.user.user_metadata?.avatar_url || 
                        sessionData.user.user_metadata?.picture,
                provider: 'google',
              };

              await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
              await AsyncStorage.setItem('auth_provider', 'google');

              console.log('Google Sign-In Success (manual tokens):', user);
              return user;
            }
          }
        } catch (parseError) {
          console.error('Error parsing tokens:', parseError);
        }
        
        throw new Error('No user session found after authentication');
      } else if (result.type === 'cancel') {
        throw new Error('User cancelled the authentication');
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  }

  // Sign in with Apple using Supabase
  async signInWithApple(): Promise<SupabaseUser> {
    try {
      console.log('Starting Supabase Apple Sign-In...');

      // Check if Apple Sign In is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Apple Sign In is not available on this device');
      }

      // Get Apple credential
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Sign in with Supabase using Apple ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user) {
        const user: SupabaseUser = {
          id: data.user.id,
          email: data.user.email || credential.email || '',
          name: credential.fullName ? 
            `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() : 
            data.user.user_metadata?.full_name || 
            data.user.email?.split('@')[0] || 'User',
          picture: data.user.user_metadata?.avatar_url,
          provider: 'apple',
        };

        // Store user info locally
        await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
        await AsyncStorage.setItem('auth_provider', 'apple');

        console.log('Apple Sign-In Success:', user);
        return user;
      }

      throw new Error('No user data received from Apple Sign-In');
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        throw new Error('User cancelled Apple Sign In');
      }
      console.error('Apple Sign-In Error:', error);
      throw error;
    }
  }

  // Check if Apple Sign In is available
  async isAppleAuthenticationAvailable(): Promise<boolean> {
    return await AppleAuthentication.isAvailableAsync();
  }

  // Get current session from Supabase
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  // Get stored user
  async getStoredUser(): Promise<SupabaseUser | null> {
    try {
      console.log('🔍 SupabaseAuthService: Getting stored user...');
      const userString = await AsyncStorage.getItem('supabase_user');
      console.log('📦 Raw user string from storage:', userString);
      
      if (userString) {
        const user = JSON.parse(userString);
        console.log('👤 Parsed user from storage:', user);
        return user;
      } else {
        console.log('❌ No user found in storage with key "supabase_user"');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting stored user:', error);
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

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const session = await this.getCurrentSession();
      const user = await this.getStoredUser();
      return !!(session && user);
    } catch (error) {
      return false;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase sign out error:', error);
      }

      // Clear local storage
      await AsyncStorage.multiRemove([
        'supabase_user',
        'auth_provider',
      ]);
      
      console.log('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  // Listen for auth changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  // Sign up with email and password
  async signUpWithEmail(email: string, password: string, name: string): Promise<SupabaseUser> {
    try {
      console.log('Starting Supabase email signup...');

      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            name: name,
          },
        },
      });

      if (error) {
        console.error('Supabase signup error:', error);
        throw new Error(error.message);
      }

      if (data.user) {
        const user: SupabaseUser = {
          id: data.user.id,
          email: data.user.email || email,
          name: name,
          picture: data.user.user_metadata?.avatar_url,
          provider: 'email',
        };

        // Store user info locally
        await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
        await AsyncStorage.setItem('auth_provider', 'email');

        console.log('Email Signup Success:', user);
        
        // Check if email confirmation is required
        if (!data.session) {
          console.log('Email confirmation required');
          return {
            ...user,
            emailConfirmationRequired: true,
          } as SupabaseUser & { emailConfirmationRequired: boolean };
        }

        return user;
      }

      throw new Error('No user data received from signup');
    } catch (error) {
      console.error('Email Signup Error:', error);
      throw error;
    }
  }

  // Sign in with email and password  
  async signInWithEmail(email: string, password: string): Promise<SupabaseUser> {
    try {
      console.log('Starting Supabase email signin...');

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase signin error:', error);
        throw new Error(error.message);
      }

      if (data.user) {
        const user: SupabaseUser = {
          id: data.user.id,
          email: data.user.email || email,
          name: data.user.user_metadata?.full_name || 
                data.user.user_metadata?.name || 
                data.user.email?.split('@')[0] || 'User',
          picture: data.user.user_metadata?.avatar_url,
          provider: 'email',
        };

        // Store user info locally
        await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
        await AsyncStorage.setItem('auth_provider', 'email');

        console.log('Email Signin Success:', user);
        return user;
      }

      throw new Error('No user data received from signin');
    } catch (error) {
      console.error('Email Signin Error:', error);
      throw error;
    }
  }
}

export default SupabaseAuthService; 