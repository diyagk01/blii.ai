// app/onboarding2.tsx
'use client';

import { ResizeMode, Video } from 'expo-av';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Dimensions,
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

const Onboarding2: React.FC = () => {
  const router = useRouter();

  const handleNext = () => {
    // Navigate to onboarding3 screen. 
    // Ensure you have app/onboarding3.tsx defined.
    router.push('/onboarding3');
  };

  const handleSkip = () => {
    // Skip onboarding: navigate to sign up screen
    router.replace('/signupscreen');
  };

  const handleBack = () => {
    // Go back to the first onboarding screen explicitly
    router.push('/');
  };

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
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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
            source={require('../assets/animations/Onboarding 2.mov')}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            style={styles.fullScreenVideo}
          />
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Sorted by Smart Tags</Text>
          <Text style={styles.description}>
            Blii AI auto-tags your saves so you never lose track. Edit or add your own anytime.
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
    // Remove any justifyContent override for vertical centering
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  fullScreenVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
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
    gap: 8, // reduce space between indicators and next button
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0066FF', // blue
    justifyContent: 'center',
    alignItems: 'center',
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

export default Onboarding2;
