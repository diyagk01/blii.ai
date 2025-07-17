import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsNotificationsScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState(false);
  const [smartHighlights, setSmartHighlights] = useState(true);
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.optionsContainer}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Reminders</Text>
          <Switch value={reminders} onValueChange={setReminders} trackColor={{ false: '#E5E7EB', true: '#3B82F6' }} thumbColor={reminders ? '#fff' : '#fff'} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Smart Highlights</Text>
          <Switch value={smartHighlights} onValueChange={setSmartHighlights} trackColor={{ false: '#E5E7EB', true: '#3B82F6' }} thumbColor={smartHighlights ? '#fff' : '#fff'} />
        </View>
        <TouchableOpacity style={styles.resetBtn} activeOpacity={0.8}>
          <Text style={styles.resetBtnText}>Reset Notification Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F3',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    flex: 1,
  },
  optionsContainer: {
    marginTop: 18,
    paddingHorizontal: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
    flex: 1,
  },
  resetBtn: {
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  resetBtnText: {
    color: '#F44',
    fontSize: 16,
    fontWeight: '500',
  },
}); 