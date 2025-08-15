import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
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
      console.log('🔐 Starting Supabase Google Sign-In...');

      // Use a more standard Expo redirect URI
      const redirectTo = 'exp://localhost:19006/--/auth/callback';

      // Use Supabase's OAuth flow with explicit redirect URI
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
        console.error('❌ Supabase OAuth error:', error);
        throw new Error(error.message);
      }

      if (!data?.url) {
        throw new Error('No OAuth URL returned from Supabase');
      }

      console.log('🌐 Opening OAuth URL:', data.url);

      // Use openAuthSessionAsync for proper OAuth handling
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );
      
      console.log('📱 Auth result:', result);

      if (result.type === 'success') {
        console.log('✅ OAuth success! URL:', result.url);
        
        // Enhanced token/code extraction with detailed logging
        console.log('🔍 Full callback URL:', result.url);
        
        try {
          // Parse the URL
          const urlParts = result.url.split('?');
          const baseUrl = urlParts[0];
          const queryString = urlParts[1] || '';
          
          console.log('🔍 Base URL:', baseUrl);
          console.log('🔍 Query string:', queryString);
          
          // Check for authorization code (PKCE flow)
          const queryParams = new URLSearchParams(queryString);
          const authCode = queryParams.get('code');
          
          console.log('🔑 Extracted parameters:', { 
            hasAuthCode: !!authCode, 
            authCodeLength: authCode?.length || 0
          });

          if (authCode) {
            console.log('✅ Found authorization code, exchanging for session...');
            
            // Exchange the authorization code for a session using PKCE
            const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(authCode);

            console.log('📝 Session exchange result:', {
              hasUser: !!sessionData?.user,
              hasSession: !!sessionData?.session,
              error: sessionError?.message
            });

            if (!sessionError && sessionData?.user) {
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

              // Store user info locally
              await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
              await AsyncStorage.setItem('auth_provider', 'google');

              console.log('🎉 Google Sign-In Success (code exchange):', user);
              return user;
            } else {
              console.error('❌ Session exchange error:', sessionError);
            }
          } else {
            console.log('⚠️ No authorization code found in callback URL');
            
            // Fallback: Check for direct tokens (implicit flow)
            let accessToken = null;
            let refreshToken = null;
            
            // Check if tokens are in the fragment (after #)
            if (result.url.includes('#')) {
              const fragment = result.url.split('#')[1];
              console.log('🔍 URL fragment:', fragment);
              
              const fragmentParams = new URLSearchParams(fragment);
              accessToken = fragmentParams.get('access_token');
              refreshToken = fragmentParams.get('refresh_token');
            }
            
            // Check if tokens are in query parameters
            if (!accessToken && queryString) {
              accessToken = queryParams.get('access_token');
              refreshToken = queryParams.get('refresh_token');
            }
            
            console.log('🔑 Extracted tokens:', { 
              hasAccessToken: !!accessToken, 
              hasRefreshToken: !!refreshToken,
              accessTokenLength: accessToken?.length || 0,
              refreshTokenLength: refreshToken?.length || 0
            });

            if (accessToken) {
              console.log('✅ Setting session with extracted tokens...');
              
              // Set the session directly with the tokens
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });

              console.log('📝 Session set result:', {
                hasUser: !!sessionData?.user,
                hasSession: !!sessionData?.session,
                error: sessionError?.message
              });

              if (!sessionError && sessionData?.user) {
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

                // Store user info locally
                await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
                await AsyncStorage.setItem('auth_provider', 'google');

                console.log('🎉 Google Sign-In Success (direct tokens):', user);
                return user;
              } else {
                console.error('❌ Session error or no user:', sessionError);
              }
            }
          }
        } catch (urlError) {
          console.error('❌ Token/code extraction failed:', urlError);
          console.log('🔄 Falling back to session polling...');
        }
        
        // Fallback: Wait and try multiple approaches to get the session
        console.log('🔄 Fallback: Trying session polling...');
        
        // Try immediate session check first
        let { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('📊 Initial session check:', { hasSession: !!session, error: sessionError?.message });
        
        if (!sessionError && session?.user) {
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

          await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
          await AsyncStorage.setItem('auth_provider', 'google');

          console.log('🎉 Google Sign-In Success (immediate):', user);
          return user;
        }

        // Extended polling with shorter intervals
        console.log('⏳ Session not found immediately, starting extended polling...');
        
        for (let i = 0; i < 15; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second intervals
          
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
          console.log(`📊 Polling attempt ${i + 1}/15:`, { 
            hasSession: !!retrySession, 
            error: retryError?.message,
            userId: retrySession?.user?.id
          });
          
          if (!retryError && retrySession?.user) {
            const user: SupabaseUser = {
              id: retrySession.user.id,
              email: retrySession.user.email || '',
              name: retrySession.user.user_metadata?.full_name || 
                    retrySession.user.user_metadata?.name || 
                    retrySession.user.email?.split('@')[0] || 'User',
              picture: retrySession.user.user_metadata?.avatar_url || 
                      retrySession.user.user_metadata?.picture,
              provider: 'google',
            };

            await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
            await AsyncStorage.setItem('auth_provider', 'google');

            console.log('🎉 Google Sign-In Success (polling):', user);
            return user;
          }
        }
        
        // Final attempt: force refresh the session
        console.log('🔄 Final attempt: Forcing session refresh...');
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshData?.session?.user) {
            const user: SupabaseUser = {
              id: refreshData.session.user.id,
              email: refreshData.session.user.email || '',
              name: refreshData.session.user.user_metadata?.full_name || 
                    refreshData.session.user.user_metadata?.name || 
                    refreshData.session.user.email?.split('@')[0] || 'User',
              picture: refreshData.session.user.user_metadata?.avatar_url || 
                      refreshData.session.user.user_metadata?.picture,
              provider: 'google',
            };

            await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
            await AsyncStorage.setItem('auth_provider', 'google');

            console.log('🎉 Google Sign-In Success (refresh):', user);
            return user;
          }
        } catch (refreshError) {
          console.error('❌ Session refresh failed:', refreshError);
        }
        
        console.error('❌ All session retrieval attempts failed');
        throw new Error('Authentication completed but session not found. The redirect URL might not be configured correctly in Supabase. Please check your Supabase settings.');
      } else if (result.type === 'cancel') {
        throw new Error('User cancelled the authentication');
      } else {
        console.error('❌ Auth result type:', result.type);
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('❌ Google Sign-In Error:', error);
      throw error;
    }
  }

  // Sign in with Apple using Supabase
  async signInWithApple(): Promise<SupabaseUser> {
    try {
      console.log('🍎 Starting Supabase Apple Sign-In...');

      // Check if Apple Sign In is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      console.log('🍎 Apple Sign In Available:', isAvailable);
      
      if (!isAvailable) {
        throw new Error('Apple Sign In is not available on this device');
      }

      console.log('🍎 Requesting Apple credentials...');
      
      // Get Apple credential
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('🍎 Apple credential received:', {
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
        hasIdentityToken: !!credential.identityToken,
        hasAuthorizationCode: !!credential.authorizationCode,
      });

      if (!credential.identityToken) {
        console.error('🍎 No identity token received from Apple');
        throw new Error('No identity token received from Apple');
      }

      console.log('🍎 Sending identity token to Supabase...');

      // Sign in with Supabase using Apple ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        console.error('🍎 Supabase Apple Sign-In Error:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      console.log('🍎 Supabase response data:', {
        hasUser: !!data.user,
        hasSession: !!data.session,
        userId: data.user?.id,
        userEmail: data.user?.email,
      });

      if (data.user) {
        // Extract name from credential or user metadata
        let userName = 'User';
        if (credential.fullName?.givenName || credential.fullName?.familyName) {
          userName = `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim();
        } else if (data.user.user_metadata?.full_name) {
          userName = data.user.user_metadata.full_name;
        } else if (data.user.user_metadata?.name) {
          userName = data.user.user_metadata.name;
        } else if (data.user.email) {
          userName = data.user.email.split('@')[0];
        }

        const user: SupabaseUser = {
          id: data.user.id,
          email: data.user.email || credential.email || '',
          name: userName,
          picture: data.user.user_metadata?.avatar_url,
          provider: 'apple',
        };

        console.log('🍎 Creating user object:', user);

        // Store user info locally
        await AsyncStorage.setItem('supabase_user', JSON.stringify(user));
        await AsyncStorage.setItem('auth_provider', 'apple');

        console.log('🍎 Apple Sign-In Success - User stored locally');
        return user;
      }

      console.error('🍎 No user data received from Apple Sign-In');
      throw new Error('No user data received from Apple Sign-In');
    } catch (error: any) {
      console.error('🍎 Apple Sign-In Error:', error);
      
      // Handle specific Apple authentication errors
      if (error.code === 'ERR_CANCELED' || error.code === 'ERR_REQUEST_CANCELED') {
        throw new Error('User cancelled Apple Sign In');
      } else if (error.code === 'ERR_INVALID_RESPONSE') {
        throw new Error('Invalid response from Apple. Please try again.');
      } else if (error.code === 'ERR_NOT_HANDLED') {
        throw new Error('Apple Sign In not properly configured. Please contact support.');
      } else if (error.code === 'ERR_UNKNOWN') {
        throw new Error('Unknown Apple Sign In error. Please try again.');
      }
      
      // Re-throw the original error if it's not an Apple-specific error
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

  // Get stored user and ensure session is active
  async getStoredUser(): Promise<SupabaseUser | null> {
    try {
      console.log('🔍 SupabaseAuthService: Getting stored user...');
      const userString = await AsyncStorage.getItem('supabase_user');
      console.log('📦 Raw user string from storage:', userString);
      
      if (userString) {
        const user = JSON.parse(userString);
        console.log('👤 Parsed user from storage:', user);
        
        // Check if we have an active Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!session && !error) {
          console.log('🔄 No active session found, attempting to restore...');
          // Try to restore session automatically
          await this.restoreSession();
        }
        
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

  // Restore Supabase session from stored tokens/state
  private async restoreSession(): Promise<void> {
    try {
      console.log('🔄 Attempting to restore Supabase session...');
      
      // Supabase should automatically restore the session if tokens are stored
      // Let's trigger a session refresh
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.log('⚠️ Session refresh failed:', error.message);
        // Session restore failed, user may need to sign in again
      } else if (data.session) {
        console.log('✅ Session restored successfully');
      } else {
        console.log('⚠️ No session to restore');
      }
    } catch (error) {
      console.error('❌ Error restoring session:', error);
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
      
      // If no active session, user is not authenticated
      if (!session) {
        console.log('🔍 No active session found - user not authenticated');
        return false;
      }
      
      const user = await this.getStoredUser();
      const isAuth = !!(session && user);
      console.log('🔍 Authentication check result:', { hasSession: !!session, hasUser: !!user, isAuthenticated: isAuth });
      return isAuth;
    } catch (error) {
      console.error('❌ Authentication check error:', error);
      return false;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      console.log('🚪 Starting sign out process...');
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Supabase sign out error:', error);
      } else {
        console.log('✅ Supabase session cleared');
      }

      // Clear local storage
      await AsyncStorage.multiRemove([
        'supabase_user',
        'auth_provider',
      ]);
      
      console.log('✅ Local storage cleared');
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('❌ Error signing out:', error);
      throw error;
    }
  }

  // Listen for auth changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  // Request a password reset email
  async requestPasswordReset(email: string, redirectPath: string = 'reset-password'): Promise<void> {
    try {
      // Build a redirect URL that matches the current runtime (Expo Go -> exp://, Dev/Standalone -> blii://)
      const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const redirectTo = Linking.createURL(redirectPath, { queryParams: { r: unique } });
      console.log('🔗 Password reset redirect URL:', redirectTo);
      console.log('📧 Sending reset email to:', email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) {
        console.error('❌ Reset email error:', error);
        throw new Error(error.message);
      }
      console.log('✅ Reset email sent successfully');
    } catch (error) {
      console.error('Password reset email error:', error);
      throw error;
    }
  }

  // Send magic link for email verification
  async sendMagicLink(email: string): Promise<{ error: any }> {
    try {
      const redirectTo = Linking.createURL('email-verification');
      console.log('🔗 Magic link redirect URL:', redirectTo);
      console.log('📧 Sending magic link to:', email);
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      
      if (error) {
        console.error('❌ Magic link error:', error);
        return { error };
      }
      
      console.log('✅ Magic link sent successfully');
      return { error: null };
    } catch (error) {
      console.error('Magic link error:', error);
      return { error };
    }
  }

  // Send signup OTP for new users
  async sendSignupOtp(email: string): Promise<{ error: any }> {
    try {
      console.log('📧 Sending signup OTP to:', email);
      
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // This will create a new user if they don't exist
        },
      });
      
      console.log('📧 Supabase OTP response:', { data, error });
      
      if (error) {
        console.error('❌ Signup OTP error:', error);
        return { error };
      }
      
      console.log('✅ Signup OTP sent successfully');
      return { error: null };
    } catch (error) {
      console.error('❌ Signup OTP error:', error);
      return { error };
    }
  }

  // Verify OTP code
  async verifyOtp(email: string, token: string): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      
      if (error) {
        console.error('❌ OTP verification error:', error);
        return { data: null, error };
      }
      
      console.log('✅ OTP verified successfully');
      return { data, error: null };
    } catch (error) {
      console.error('OTP verification error:', error);
      return { data: null, error };
    }
  }

  // Verify signup OTP for new users
  async verifySignupOtp(email: string, token: string): Promise<{ data: any; error: any }> {
    try {
      console.log('🔐 Verifying signup OTP for:', email);
      
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });
      
      if (error) {
        console.error('❌ Signup OTP verification error:', error);
        return { data: null, error };
      }
      
      console.log('✅ Signup OTP verified successfully');
      return { data, error: null };
    } catch (error) {
      console.error('Signup OTP verification error:', error);
      return { data: null, error };
    }
  }

  // Complete the password reset by setting a new password
  async updatePassword(newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
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

  // Complete signup by updating user profile after OTP verification
  async completeSignupWithProfile(email: string, password: string, name: string): Promise<SupabaseUser> {
    try {
      console.log('Completing signup with profile...');

      // Update the user's profile with name and password
      const { data, error } = await supabase.auth.updateUser({
        password: password,
        data: {
          full_name: name,
          name: name,
        },
      });

      if (error) {
        console.error('Profile update error:', error);
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

        console.log('Profile Update Success:', user);
        return user;
      }

      throw new Error('No user data received from profile update');
    } catch (error) {
      console.error('Profile Update Error:', error);
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
