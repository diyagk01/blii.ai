import { Tabs } from 'expo-router';
import React from 'react';
import { Image, Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          paddingTop: 0,
          paddingBottom: 18,
          height: 80,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '500',
          marginTop: 4,
        },
        headerShown: false,
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen 
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <Image
              source={focused
                ? require('../../assets/images/home-3.png')
                : require('../../assets/images/home-2.png')}
              style={{ width: 22, height: 28, resizeMode: 'contain' }}
            />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text style={{ color: focused ? '#007AFF' : '#8E8E93', fontWeight: '500', fontSize: 12, marginTop: 2 }}>Home</Text>
          ),
        }}
      />
      <Tabs.Screen 
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: () => (
            <Image
              source={require('../../assets/images/message-text-2.png')}
              style={{ width: 22, height: 28, resizeMode: 'contain' }}
            />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text style={{ color: focused ? '#007AFF' : '#8E8E93', fontWeight: '500', fontSize: 12, marginTop: 2 }}>Chat</Text>
          ),
          tabBarStyle: { display: 'none' }, // Hide tab bar on chat screen
        }}
      />
      <Tabs.Screen 
        name="all-saves"
        options={{
          title: 'All Saves',
          tabBarIcon: ({ focused }) => (
            <Image
              source={focused
                ? require('../../assets/images/frame.png')
                : require('../../assets/images/frame-2.png')}
              style={{ width: 22, height: 28, resizeMode: 'contain' }}
            />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text style={{ color: focused ? '#007AFF' : '#8E8E93', fontWeight: '500', fontSize: 12, marginTop: 2 }}>All Saves</Text>
          ),
        }}
      />
    </Tabs>
  );
} 