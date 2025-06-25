import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface ForgotPasswordConfirmationScreenProps {
  email?: string;
}

const ForgotPasswordConfirmationScreen = ({ 
  email = "your email" 
}: ForgotPasswordConfirmationScreenProps) => {
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleResend = async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    
    try {
      // Simulate API call to resend email
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Email Resent',
        'Password recovery instructions have been sent again to your email address.',
        [{ text: 'OK' }]
      );
      
      // Reset countdown
      setCanResend(false);
      setCountdown(60);
      
      // Restart timer
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error) {
      Alert.alert('Error', 'Failed to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleBackPress = () => {
    console.log('Navigate back to login or previous screen');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Forgot Password</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.envelopeIcon}>
            <Ionicons name="mail" size={32} color="#fff" />
            <View style={styles.checkmarkContainer}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
          </View>
        </View>

        {/* Success Message */}
        <View style={styles.messageContainer}>
          <Text style={styles.successMessage}>
            We have sent password recovery instructions to your email
          </Text>
        </View>

        {/* Additional Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Please check your inbox and follow the instructions to reset your password.
          </Text>
          <Text style={styles.infoText}>
            If you don't see the email, check your spam folder.
          </Text>
        </View>
      </View>

      {/* Bottom Section */}
      <View style={styles.bottomContainer}>
        <Text style={styles.resendText}>
          Didn't receive it yet?{' '}
          {canResend ? (
            <Text 
              style={[styles.resendLink, isResending && styles.resendLinkDisabled]} 
              onPress={handleResend}
            >
              {isResending ? 'Resending...' : 'Resend'}
            </Text>
          ) : (
            <Text style={styles.resendDisabled}>
              Resend in {formatTime(countdown)}
            </Text>
          )}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 40,
  },
  envelopeIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FF9F43',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  messageContainer: {
    marginBottom: 30,
  },
  successMessage: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    lineHeight: 28,
  },
  infoContainer: {
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendLink: {
    color: '#007AFF',
    fontWeight: '500',
  },
  resendLinkDisabled: {
    color: '#ccc',
  },
  resendDisabled: {
    color: '#999',
  },
});

export default ForgotPasswordConfirmationScreen;