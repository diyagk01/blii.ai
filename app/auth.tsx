import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SupabaseAuthService from '../services/supabase-auth';

const AuthScreen = () => {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      
      const userInfo = await SupabaseAuthService.getInstance().signInWithGoogle();
      console.log('Google Sign-In Success:', userInfo);
      
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    try {
      setAppleLoading(true);
      
      const isAvailable = await SupabaseAuthService.getInstance().isAppleAuthenticationAvailable();
      if (!isAvailable) {
        Alert.alert('Error', 'Apple Sign In is not available on this device');
        return;
      }
      
      const userInfo = await SupabaseAuthService.getInstance().signInWithApple();
      console.log('Apple Sign-In Success:', userInfo);
      
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Apple Sign-In Error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Apple');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >


        {/* Main Content */}
        <View style={styles.content}>
          {/* App Logo and Branding */}
          <View style={styles.brandingContainer}>
            <Image 
              source={require('../assets/images/blii.png')} 
              style={styles.appLogo}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>Smart recall for a busy mind</Text>
          </View>

          {/* Authentication Options */}
          <View style={styles.authOptions}>
            {/* Google Sign In */}
            <TouchableOpacity 
              style={[styles.socialButton, googleLoading && styles.socialButtonDisabled]} 
              onPress={handleGoogleLogin}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <View style={styles.socialButtonContent}>
                  <Image source={require('../assets/images/Google.png')} style={styles.socialIcon} />
                  <Text style={styles.socialButtonText}>Continue with Google</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Apple Sign In */}
            <TouchableOpacity 
              style={[styles.socialButton, appleLoading && styles.socialButtonDisabled]} 
              onPress={handleAppleLogin}
              disabled={appleLoading}
            >
              {appleLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <View style={styles.socialButtonContent}>
                  <Image source={require('../assets/images/Apple Logo.png')} style={styles.socialIcon} />
                  <Text style={styles.socialButtonText}>Continue with Apple</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  appLogo: {
    width: 200,
    height: 80,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 16,
    color: '#2F2F2F',
    textAlign: 'center',
    fontFamily: 'Satoshi',
    fontWeight: '500',
    letterSpacing: 0.169,
  },
  authOptions: {
    width: '100%',
  },
  socialButton: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 45,
    marginBottom: 16,
    backgroundColor: '#FDFDFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  socialButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },

});

export default AuthScreen;
