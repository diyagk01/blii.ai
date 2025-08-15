// app/onboarding3.tsx
'use client';

import { ResizeMode, Video } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Animated, Dimensions,
    Image,
    ImageBackground,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width, height } = Dimensions.get('window');

const Onboarding3: React.FC = () => {
  const router = useRouter();

  const handleNext = () => {
    // Navigate to the new auth screen
    router.push('/auth');
  };

  const handleSkip = () => {
    // Skip onboarding: navigate to new auth screen
    router.replace('/auth');
  };

  const handleBackToStep1 = () => {
    // Navigate back to the first onboarding step, typically '/'
    router.push('/');
  };

  const handleBackToStep2 = () => {
    // Always go to the previous onboarding screen explicitly
    router.push('/onboarding2');
  };

  // Animated color for the blue phrase
  const colorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(colorAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }, 3000);
    return () => clearTimeout(timeout);
  }, [colorAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <ImageBackground
        source={require('../assets/images/Screenshot 2025-07-11 at 9.19.53 PM.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {/* Top Row: Back and Skip */}
      <View style={{ position: 'absolute', top: 90, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, paddingHorizontal: 20 }}>
        <TouchableOpacity onPress={handleBackToStep2} style={styles.backButton}>
          <View style={styles.customBackArrow} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
      {/* Main Content */}
      <View style={styles.content}>
        {/* Image Area */}
        <View style={styles.imageContainer}>
          <Video
            source={require('../assets/animations/Onboarding 3.mov')}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            style={styles.placeholderImage}
          />
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Find it in seconds</Text>
          <Text style={styles.description}>
            Type what you remember and{' '}
            <Animated.Text
              style={{ color: colorAnim.interpolate({ inputRange: [0, 1], outputRange: ['#666666', '#0066FF'] }) }}
            >
              Blii will pull up exactly what you saved.
            </Animated.Text>
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
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    zIndex: 1,
  },
  skipText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '300',
    backgroundColor: 'transparent',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066FF', // blue
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 8,
  },
  getStartedText: {
    fontSize: 16,
    color: '#fff', // white text
    marginRight: 8,
    fontWeight: '500',
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
  link: {
    color: '#0066FF',
    textDecorationLine: 'underline',
  },

});

export default Onboarding3;
