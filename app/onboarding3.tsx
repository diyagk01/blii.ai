// app/onboarding3.tsx
'use client';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Dimensions,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const Onboarding3: React.FC = () => {
  const router = useRouter();

  const handleNext = () => {
    // If there is a next onboarding screen (e.g., onboarding3), navigate there.
    // If this truly is the last page, you might navigate to '/home' or main app.
    // Example: router.push('/home');
    // Here, assuming you have onboarding3:
    router.push('/signupscreen');
  };

  const handleSkip = () => {
    // Skip onboarding: navigate to main/home screen.
    router.replace('/home');
  };

  const handleBackToStep1 = () => {
    // Navigate back to the first onboarding step, typically '/'
    router.push('/');
  };

  const handleBackToStep2 = () => {
    // If you have an explicit second step separate from this,
    // and this page is actually step 3, you might do router.push('/onboarding2').
    // But since this file is onboarding2, this may not be needed.
    // If this is step 2 (last), then step1 is '/', and no separate step2 exists.
    // Leave this for illustration or remove if not needed.
    router.push('/onboarding2');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Main Content */}
      <View style={styles.content}>
        {/* Placeholder Image Area */}
        <View style={styles.imageContainer}>
          <View style={styles.placeholderImage}>
            <View style={styles.checkerboard}>
              {Array.from({ length: 100 }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.checkerSquare,
                    (Math.floor(index / 10) + index) % 2 === 0
                      ? styles.lightSquare
                      : styles.darkSquare,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Your second brain,{'\n'}across devices</Text>
          <Text style={styles.description}>
            Access your saves across phone, laptop or tablet, private and always in sync.
          </Text>
        </View>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomContainer}>
        <View style={styles.navigationContainer}>
         
          {/* Page Indicators */}
          <View style={styles.pageIndicators}>
            {/* First dot: navigate back to step 1 */}
            <TouchableOpacity onPress={handleBackToStep1}>
              <View style={styles.dot} />
            </TouchableOpacity>
            {/* Second dot: if this were step 2 in a 3-step flow and you want it tappable */}
            {/* If this file is onboarding2 (and considered step 2), you might leave this un-tappable or remove */}
            {/* Here we show it as tappable but same page: */}
            <TouchableOpacity onPress={handleBackToStep2}>
              <View style={styles.dot} />
            </TouchableOpacity>
            {/* Third dot: active style, since this is the last page */}
            <View style={[styles.dot, styles.activeDot]} />
          </View>

          {/* Next Button */}
          <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
          <Text style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  placeholderImage: {
    width: width * 0.8,
    height: height * 0.4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  checkerboard: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checkerSquare: {
    width: '10%',
    height: '10%',
  },
  lightSquare: {
    backgroundColor: '#f0f0f0',
  },
  darkSquare: {
    backgroundColor: '#e0e0e0',
  },
  textContainer: {
    paddingBottom: 40,
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
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '400',
  },
  pageIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#000000',
    width: 24,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 24,
  },
  getStartedText: {
    fontSize: 16,
    color: '#000',
    marginRight: 8, // space between text and icon
    fontWeight: '500',
  },

});

export default Onboarding3;
