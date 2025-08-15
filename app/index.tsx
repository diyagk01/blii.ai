'use client';

import { useRouter } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

const OnboardingScreen: React.FC = () => {
  const router = useRouter();

  const handleNext = () => {
    // Navigate to onboarding2 screen
    router.push('/onboarding2');
  };

  const handleSkip = () => {
    // Skip onboarding: navigate to new auth screen
    router.replace('/auth');
  };

  const handleBack = () => {
    // Navigate back to the previous screen
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Top Row: Skip only (no back button on first page) */}
      <View style={{ position: 'absolute', top: 90, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', zIndex: 2, paddingHorizontal: 20 }}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Image Area */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../assets/animations/Onboarding-1-unscreen.gif')}
            style={styles.placeholderImage}
            resizeMode="cover"
          />
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Save it like you chat</Text>
          <Text style={styles.description}>
            PDFs, links, thoughts. Send it like a message and save it for later.
          </Text>
        </View>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomContainer}>
        <View style={styles.navigationContainer}>
          {/* Page Indicators */}
          <View style={styles.pageIndicators}>
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          {/* Next Button */}
          <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
            <Image
              source={require('../assets/animations/4d5d3e183a97848bb37625ee893df1d7a1362f14.gif')}
              style={{ width: 32, height: 32, resizeMode: 'contain' }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 10,
  },
  placeholderImage: {
    width: width * 0.8,
    height: height * 0.4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  textContainer: {
    marginTop: 0,
    paddingBottom: 40,
    marginBottom: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    lineHeight: 38,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
    fontWeight: '400',
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 2,
  },
  activeDot: {
    backgroundColor: '#888',
    width: 28,
    height: 7,
    borderRadius: 3.5,
  },
  nextButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    zIndex: 1,
  },
  skipText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '300',
    backgroundColor: 'transparent',
  },
  backButton: {
    padding: 4,
    zIndex: 10,
  },
  customBackArrow: {
    width: 13,
    height: 13,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#222',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    backgroundColor: 'transparent',
  },
});

export default OnboardingScreen;
