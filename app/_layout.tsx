import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import SupabaseAuthService from '../services/supabase-auth';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  const [loaded, error] = useFonts({
    'SpaceMono': require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    checkAuthState();
    
    // Listen for authentication state changes
    const authService = SupabaseAuthService.getInstance();
    const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setIsAuthenticated(true);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const checkAuthState = async () => {
    try {
      const authService = SupabaseAuthService.getInstance();
      const isAuth = await authService.isAuthenticated();
      setIsAuthenticated(isAuth);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inAuthScreen = segments[0] === 'auth' || segments[0] === 'index' || segments[0] === 'onboarding2' || segments[0] === 'onboarding3';

    if (isAuthenticated && !inAuthGroup) {
      // User is authenticated but not in the auth group, redirect to home
      router.replace('/(tabs)');
    } else if (!isAuthenticated && inAuthGroup) {
      // User is not authenticated but in the auth group, redirect to auth
      router.replace('/auth');
    }
  }, [isAuthenticated, segments, isLoading]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded || isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding2" />
      <Stack.Screen name="onboarding3" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="loginscreen" />
      <Stack.Screen name="signupscreen" />
      <Stack.Screen name="password-screen" />
      <Stack.Screen name="email-verification" />
      <Stack.Screen name="complete-signup" />
      <Stack.Screen name="forgotpassword" />
      <Stack.Screen name="forgotpasswordconfirmation" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
