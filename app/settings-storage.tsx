import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsStorageScreen() {
  const router = useRouter();
  const [uploadQuality, setUploadQuality] = useState<'standard' | 'hd'>('standard');
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Storage and Data</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.optionsContainer}>
        <TouchableOpacity style={styles.optionCard} activeOpacity={0.8}>
          <View style={styles.iconBox}><MaterialCommunityIcons name="database-outline" size={20} color="#3B82F6" /></View>
          <Text style={styles.optionLabel}>Storage Usage</Text>
          <Text style={styles.optionValue}>364 MB</Text>
          <Ionicons name="chevron-forward" size={20} color="#B0B0B0" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.optionCard} activeOpacity={0.8}>
          <View style={styles.iconBox}><MaterialCommunityIcons name="access-point-network" size={20} color="#3B82F6" /></View>
          <Text style={styles.optionLabel}>Network Usage</Text>
          <Text style={styles.optionValue}>364 MB</Text>
          <Ionicons name="chevron-forward" size={20} color="#B0B0B0" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>Upload Quality</Text></View>
        <Text style={styles.sectionDescription}>Choose the quality when uploading items</Text>
        <TouchableOpacity style={styles.radioRow} onPress={() => setUploadQuality('standard')} activeOpacity={0.8}>
          <View style={[styles.radioOuter, uploadQuality === 'standard' && styles.radioOuterActive]}>
            {uploadQuality === 'standard' && <View style={styles.radioInner} />}
          </View>
          <Text style={styles.radioLabel}>Standard Quality</Text>
          <Text style={styles.radioDesc}>Faster upload, smaller size</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.radioRow} onPress={() => setUploadQuality('hd')} activeOpacity={0.8}>
          <View style={[styles.radioOuter, uploadQuality === 'hd' && styles.radioOuterActive]}>
            {uploadQuality === 'hd' && <View style={styles.radioInner} />}
          </View>
          <Text style={styles.radioLabel}>HD Quality</Text>
          <Text style={styles.radioDesc}>Slower upload, Crisper & 5x file larger</Text>
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
  optionValue: {
    fontSize: 13,
    color: '#888',
    marginRight: 8,
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
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    marginTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#B0B0B0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterActive: {
    borderColor: '#3B82F6',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  radioLabel: {
    fontSize: 15,
    color: '#222',
    fontWeight: '500',
    marginRight: 8,
  },
  radioDesc: {
    fontSize: 13,
    color: '#888',
  },
}); 