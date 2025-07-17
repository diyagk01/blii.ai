import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsPrivacyScreen() {
  const router = useRouter();
  const [faceId, setFaceId] = useState(false);
  const [smartTagging, setSmartTagging] = useState(true);
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy and Security</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.optionsContainer}>
        <TouchableOpacity style={styles.optionCard} activeOpacity={0.8}>
          <View style={styles.iconBox}><MaterialCommunityIcons name="shield-key-outline" size={20} color="#3B82F6" /></View>
          <Text style={styles.optionLabel}>Two-Step Verification</Text>
          <Ionicons name="chevron-forward" size={20} color="#B0B0B0" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.optionCard} activeOpacity={0.8}>
          <View style={styles.iconBox}><MaterialCommunityIcons name="account-lock-outline" size={20} color="#3B82F6" /></View>
          <Text style={styles.optionLabel}>Set Privacy for AI Suggestions</Text>
          <Ionicons name="chevron-forward" size={20} color="#B0B0B0" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>Face ID</Text></View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Require Face ID</Text>
          <Switch value={faceId} onValueChange={setFaceId} trackColor={{ false: '#E5E7EB', true: '#3B82F6' }} thumbColor={faceId ? '#fff' : '#fff'} />
        </View>
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>Smart Tagging</Text></View>
        <Text style={styles.sectionDescription}>Let Blii automatically suggest tags for your saved content.</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Auto-tag messages</Text>
          <Switch value={smartTagging} onValueChange={setSmartTagging} trackColor={{ false: '#E5E7EB', true: '#3B82F6' }} thumbColor={smartTagging ? '#fff' : '#fff'} />
        </View>
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
    flex: 1,
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 2,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  sectionDescription: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    marginTop: 2,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#222',
    fontWeight: '500',
    flex: 1,
  },
}); 