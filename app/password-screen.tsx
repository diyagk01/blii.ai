import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import SupabaseAuthService from '../services/supabase-auth';

const PasswordScreen = () => {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setPasswordError('');
  };

  const handleSignIn = async () => {
    if (!password.trim()) {
      setPasswordError('Please enter your password');
      return;
    }

    setIsLoading(true);
    
    try {
      const userInfo = await SupabaseAuthService.getInstance().signInWithEmail(
        email || '',
        password
      );
      
      console.log('Email Sign-In Success:', userInfo);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Email Sign-In Error:', error);
      
      // Check if it's a "user not found" error
      if (error.message.includes('Invalid login credentials') || 
          error.message.includes('Email not confirmed') ||
          error.message.includes('Invalid email or password')) {
        // User doesn't exist, redirect to sign up flow
        router.replace({ pathname: '/email-verification', params: { email, isSignUp: true } });
      } else {
        setPasswordError('Incorrect password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackPress = () => {
    router.back();
  };

  const handleForgotPassword = () => {
    router.push({ pathname: '/forgotpassword', params: { email } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Continue with email</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Email Display */}
          <View style={styles.emailContainer}>
            <Text style={styles.emailText}>{email}</Text>
          </View>

          {/* Password Input */}
          <View style={styles.passwordSection}>
            <Text style={styles.passwordLabel}>Password</Text>
            <View style={[
              styles.passwordInputContainer,
              passwordError && styles.passwordInputError
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            {passwordError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                <Text style={styles.errorText}>{passwordError}</Text>
              </View>
            )}
          </View>

          {/* Forgot Password Link */}
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordContainer}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[
              styles.signInButton,
              (!password.trim() || isLoading) && styles.signInButtonDisabled
            ]}
            onPress={handleSignIn}
            disabled={!password.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000',
  },
  headerSpacer: {
    width: 34,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  emailContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  emailText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  passwordSection: {
    marginBottom: 24,
  },
  passwordLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 8,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
  },
  passwordInputError: {
    borderColor: '#FF3B30',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },
  eyeButton: {
    padding: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginLeft: 4,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  forgotPasswordText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signInButtonDisabled: {
    backgroundColor: '#ccc',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PasswordScreen;
