// app/onboarding2.tsx
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

const Onboarding2: React.FC = () => {
  const router = useRouter();

  const handleNext = () => {
    // Navigate to onboarding3 screen. 
    // Ensure you have app/onboarding3.tsx defined.
    router.push('/onboarding3');
  };

  const handleSkip = () => {
    // Skip onboarding: navigate to main/home screen.
    // Adjust '/home' to your actual main route.
    router.replace('/home');
  };

  const handleBack = () => {
    // Go back to previous screen (onboarding1).
    // If onboarding1 is at '/', use:
    router.back();
    // Or explicitly: router.push('/');
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
          <Text style={styles.title}>Get what you saved,{'\n'}instantly</Text>
          <Text style={styles.description}>
            Ask Bill anything you've saved. It understands context and brings back exactly what you need.
          </Text>
        </View>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomContainer}>
        <View style={styles.navigationContainer}>
      

          {/* Page Indicators */}
          <View style={styles.pageIndicators}>
            {/* Back dot: wrap in Touchable to go back */}
            <TouchableOpacity onPress={handleBack}>
              <View style={styles.dot} />
            </TouchableOpacity>
            {/* Active dot */}
            <View style={[styles.dot, styles.activeDot]} />
            {/* Next dot */}
            <View style={styles.dot} />
          </View>

          {/* Next Button */}
          <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '400',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Onboarding2;
