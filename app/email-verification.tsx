import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SupabaseAuthService from '../services/supabase-auth';

const EmailVerificationScreen = () => {
  const router = useRouter();
  const { email, isSignUp } = useLocalSearchParams<{ email: string; isSignUp: string }>();
  const [verificationCode, setVerificationCode] = useState(['', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isResending, setIsResending] = useState(false);
  
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    // Send verification email when component mounts
    sendVerificationEmail();
  }, []);

  const sendVerificationEmail = async () => {
    try {
      console.log('📧 Starting to send verification email...');
      console.log('📧 Email:', email);
      console.log('📧 Is SignUp:', isSignUp);
      
      setIsResending(true);
      
      if (isSignUp === 'true') {
        console.log('📧 Sending signup OTP for new user...');
        // For new users, send signup OTP
        const { error } = await SupabaseAuthService.getInstance().sendSignupOtp(email || '');
        if (error) {
          console.error('❌ Failed to send signup OTP:', error);
          Alert.alert('Error', 'Failed to send verification email. Please try again.');
        } else {
          console.log('✅ Signup OTP sent successfully');
        }
      } else {
        console.log('📧 Sending password reset for existing user...');
        // For existing users, send password reset
        await SupabaseAuthService.getInstance().requestPasswordReset(email || '');
      }
    } catch (error: any) {
      console.error('❌ Error sending verification email:', error);
      Alert.alert('Error', error.message || 'Failed to send verification email');
    } finally {
      setIsResending(false);
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...verificationCode];
    newCode[index] = text;
    setVerificationCode(newCode);
    setCodeError('');

    // Auto-focus next input
    if (text && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if all digits are entered
    if (newCode.every(digit => digit !== '') && index === 3) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async (code: string) => {
    if (code.length !== 4) return;

    setIsLoading(true);
    
    try {
      if (isSignUp === 'true') {
        // For new users, verify signup OTP
        const { data, error } = await SupabaseAuthService.getInstance().verifySignupOtp(email || '', code);
        
        if (error) {
          setCodeError('Incorrect code');
        } else {
          // Navigate to complete signup
          router.push({ pathname: '/complete-signup', params: { email } });
        }
      } else {
        // For existing users, verify reset code
        // This would be handled by your backend
        if (code === '1234') { // Simulate correct code
          router.push({ pathname: '/reset-password', params: { email } });
        } else {
          setCodeError('Incorrect code');
        }
      }
    } catch (error: any) {
      setCodeError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCodeSubmit = async () => {
    if (manualCode.length !== 4) {
      setCodeError('Please enter a 4-digit code');
      return;
    }

    await handleVerifyCode(manualCode);
  };

  const handleBackPress = () => {
    router.back();
  };

  const handleResend = () => {
    sendVerificationEmail();
  };

  const handleEnterCodeManually = () => {
    setShowManualInput(true);
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
          <Text style={styles.headerTitle}>Check your email</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Instruction Text */}
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              A temporary link has been sent to {email}
            </Text>
          </View>

          {!showManualInput ? (
            <>
              {/* Manual Code Entry Link */}
              <TouchableOpacity onPress={handleEnterCodeManually} style={styles.manualLinkContainer}>
                <Text style={styles.manualLinkText}>Enter Code Manually</Text>
              </TouchableOpacity>

              {/* Code Input Fields */}
              <View style={styles.codeContainer}>
                {verificationCode.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      if (ref) inputRefs.current[index] = ref;
                    }}
                    style={[
                      styles.codeInput,
                      digit && styles.codeInputFilled,
                      codeError && styles.codeInputError
                    ]}
                    value={digit}
                    onChangeText={(text) => handleCodeChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="numeric"
                    maxLength={1}
                    editable={!isLoading}
                    selectTextOnFocus
                  />
                ))}
              </View>

              {codeError && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                  <Text style={styles.errorText}>{codeError}</Text>
                </View>
              )}

              {/* Resend Link */}
              <TouchableOpacity onPress={handleResend} style={styles.resendContainer}>
                <Text style={styles.resendText}>
                  {isResending ? 'Sending...' : 'Resend?'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Manual Code Input */}
              <View style={styles.manualInputContainer}>
                <Text style={styles.manualInputLabel}>Enter 4-digit code</Text>
                <TextInput
                  style={[
                    styles.manualCodeInput,
                    codeError && styles.manualCodeInputError
                  ]}
                  value={manualCode}
                  onChangeText={(text) => {
                    setManualCode(text.replace(/[^0-9]/g, '').slice(0, 4));
                    setCodeError('');
                  }}
                  placeholder="0000"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={4}
                  editable={!isLoading}
                />
                {codeError && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                    <Text style={styles.errorText}>{codeError}</Text>
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (manualCode.length !== 4 || isLoading) && styles.submitButtonDisabled
                ]}
                onPress={handleManualCodeSubmit}
                disabled={manualCode.length !== 4 || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </>
          )}
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
  instructionContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  instructionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  manualLinkContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  manualLinkText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  codeInput: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    backgroundColor: '#f8f8f8',
  },
  codeInputFilled: {
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  codeInputError: {
    borderColor: '#FF3B30',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginLeft: 4,
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  manualInputContainer: {
    marginBottom: 32,
  },
  manualInputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 8,
  },
  manualCodeInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    textAlign: 'center',
    backgroundColor: '#f8f8f8',
  },
  manualCodeInputError: {
    borderColor: '#FF3B30',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EmailVerificationScreen;
