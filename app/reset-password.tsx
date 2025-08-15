import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../config/supabase';
import SupabaseAuthService from '../services/supabase-auth';

function ResetPasswordScreen() {
  const router = useRouter();
  const { code, r } = useLocalSearchParams<{ code?: string; r?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  // Exchange the one-time code for a session so we can update the password
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // First, try to exchange the PKCE code if present
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data?.session?.user && mounted) {
            setSessionReady(true);
          }
        } else {
          // Sometimes tokens are injected directly into the session by Supabase before redirect
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && mounted) {
            setSessionReady(true);
          }
        }
      } catch (err) {
        console.error('Reset exchange/session error:', err);
        Alert.alert('Error', 'Reset link is invalid or expired. Please request a new reset email.');
      } finally {
        if (mounted) setInitializing(false);
      }
    })();
    return () => { mounted = false; };
  }, [code, r]);

  const handleReset = async () => {
    if (!password || password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await SupabaseAuthService.getInstance().updatePassword(password);
      Alert.alert('Success', 'Your password has been updated.', [
        { text: 'OK', onPress: () => router.replace('/loginscreen') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update password. Try the link again.');
    } finally {
      setLoading(false);
    }
  };

  const renderBody = () => {
    if (initializing) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" />
          <Text style={{ marginTop: 12, color: '#666' }}>Preparing reset…</Text>
        </View>
      );
    }

    if (!sessionReady) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.title}>Reset link not active</Text>
          <Text style={styles.subtitle}>Please request a new reset email and open it on this device.</Text>
          <TouchableOpacity style={[styles.button, { marginTop: 16 }]} onPress={() => router.replace('/forgotpassword')}>
            <Text style={styles.buttonText}>Request new link</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.subtitle}>Enter and confirm your new password to complete the reset.</Text>

        <View style={{ marginTop: 24 }}>
          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Enter new password"
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Confirm new password"
            autoCapitalize="none"
            value={confirm}
            onChangeText={setConfirm}
          />
        </View>

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} disabled={loading} onPress={handleReset}>
          <Text style={styles.buttonText}>{loading ? 'Updating...' : 'Update password'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.content}>{renderBody()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  centerBox: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#000', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
  label: { fontSize: 14, color: '#000', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8f8f8' },
  button: { marginTop: 24, backgroundColor: '#007AFF', borderRadius: 8, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default ResetPasswordScreen; 