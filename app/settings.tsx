import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const settingsOptions = [
  {
    icon: <MaterialCommunityIcons name="swap-vertical" size={22} color="#3B82F6" />, // Storage and Data
    label: 'Storage and Data',
    route: '/settings-storage' as const,
  },
  {
    icon: <Ionicons name="lock-closed-outline" size={22} color="#3B82F6" />, // Privacy and security
    label: 'Privacy and security',
    route: '/settings-privacy' as const,
  },
  {
    icon: <Feather name="message-square" size={22} color="#3B82F6" />, // Chat
    label: 'Chat',
    route: '/settings-chat' as const,
  },
  {
    icon: <Ionicons name="notifications-outline" size={22} color="#3B82F6" />, // Notifications
    label: 'Notifications',
    route: '/settings-notifications' as const,
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.optionsContainer}>
        {settingsOptions.map((option, idx) => (
          <TouchableOpacity key={option.label} style={styles.optionCard} activeOpacity={0.8} onPress={() => router.push(option.route as any)}>
            <View style={styles.iconBox}>{option.icon}</View>
            <Text style={styles.optionLabel}>{option.label}</Text>
            <Ionicons name="chevron-forward" size={20} color="#B0B0B0" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        ))}
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
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionLabel: {
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
  },
}); 