import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const featureList = [
  {
    iconComponent: (
      <Image
        source={require('../assets/images/unlimitedsaves.png')}
        style={{ width: 22, height: 22, resizeMode: 'contain' }}
      />
    ),
    title: 'Unlimited Saves',
    desc: 'No monthly limits',
  },
  {
    iconComponent: (
      <Image
        source={require('../assets/images/unlimai.png')}
        style={{ width: 22, height: 22, resizeMode: 'contain' }}
      />
    ),
    title: 'Unlimited AI prompts',
    desc: 'Ask Blii anything, anytime',
  },
  {
    iconComponent: (
      <Image
        source={require('../assets/images/smartsearch.png')}
        style={{ width: 22, height: 22, resizeMode: 'contain' }}
      />
    ),
    title: 'Smart search & auto-tagging',
    desc: 'Find anything in seconds',
  },
  {
    iconComponent: (
      <Image
        source={require('../assets/images/priority.png')}
        style={{ width: 22, height: 22, resizeMode: 'contain' }}
      />
    ),
    title: 'Priority support',
    desc: 'Help when you need it',
  },
];

const UpgradePro = () => {
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)')}>
            <Ionicons name="chevron-back" size={26} color="#222" />
          </TouchableOpacity>
        </View>

        {/* Folder+Lock replaced with video */}
        <View style={styles.folderContainer}>
          <Video
            source={require('../assets/animations/bliipro.mov')}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            style={styles.folderVideo}
          />
        </View>

        {/* Add GIF above title */}
        <View style={{ alignItems: 'center', marginBottom: 12, marginTop: -24 }}>
          <Image
            source={require('../assets/animations/1918916744405cc915fb6c68b73e81427f2d8a22 (1).gif')}
            style={{ width: 240, height: 120, borderRadius: 8, resizeMode: 'contain' }}
          />
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.titleText}>
            Upgrade to{' '}
            <Text style={styles.gradientText}>Blii Pro</Text>
            {' '}with
          </Text>
          <Text style={styles.titleText}>Full AI Access</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresList}>
          {featureList.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>{f.iconComponent}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plan selection */}
        <View style={styles.planRow}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {/* Gradient badge above Yearly */}
            {selectedPlan === 'yearly' && (
              <LinearGradient
                colors={["#1ec9a7", "#3ec6f2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.planBadgeGradient}
              >
                <Text style={styles.planBadgeText}>No Monthly Billing</Text>
              </LinearGradient>
            )}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'yearly' ? styles.planCardActive : styles.planCardInactive,
              ]}
              onPress={() => setSelectedPlan('yearly')}
              activeOpacity={0.85}
            >
              <Text style={styles.planTitle}>Yearly</Text>
              <Text style={styles.planPrice}>$59.88/year</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'monthly' ? styles.planCardActive : styles.planCardInactive,
                styles.planCardMonthly,
              ]}
              onPress={() => setSelectedPlan('monthly')}
              activeOpacity={0.85}
            >
              <Text style={styles.planTitle}>Monthly</Text>
              <Text style={styles.planPrice}>$4.99/month</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fine print */}
        <Text style={styles.finePrint}>Cancel anytime · No hidden fees</Text>

        {/* Upgrade button */}
        <TouchableOpacity
          style={styles.upgradeBtn}
          activeOpacity={0.9}
          onPress={() => Alert.alert('Upgrade', 'Upgrade to Pro clicked!')}
        >
          <LinearGradient
            colors={["#1877FF", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.upgradeBtnGradient}
          >
            <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    alignItems: 'center',
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 18,
    width: '100%',
    height: 90,
    justifyContent: 'center',
  },
  folderVideo: {
    width: 110,
    height: 70,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 30,
  },
  gradientText: {
    fontWeight: '700',
    color: '#1877FF', // fallback
  },
  featuresList: {
    width: '100%',
    marginBottom: 18,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  featureIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    color: '#6B7280',
  },
  planRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 10,
    marginTop: 8,
    justifyContent: 'space-between',
  },
  planCard: {
    minWidth: 185,
    backgroundColor: '#F6F8FA',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  planCardActive: {
    backgroundColor: '#fff',
    borderColor: '#1877FF',
    shadowColor: '#1877FF',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  planCardInactive: {
    backgroundColor: '#F6F8FA',
    borderColor: '#E5E7EB',
    shadowColor: '#E5E7EB',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  planCardMonthly: {
    backgroundColor: '#F6F8FA',
    borderColor: '#E5E7EB',
    shadowColor: '#E5E7EB',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  planBadge: {
    position: 'absolute',
    top: -18,
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 2,
  },
  planBadgeGradient: {
    position: 'absolute',
    top: -18,
    left: '50%',
    transform: [{ translateX: -50 }],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 2,
  },
  planBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 2,
  },
  planPrice: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  finePrint: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 18,
  },
  upgradeBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  upgradeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 14,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UpgradePro; 