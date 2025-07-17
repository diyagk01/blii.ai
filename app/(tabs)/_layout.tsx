import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

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
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
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
            <View style={{
              backgroundColor: focused ? '#007AFF' : 'transparent',
              borderRadius: 16,
              padding: focused ? 8 : 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={focused ? '#fff' : '#8E8E93'} />
            </View>
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
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{
              backgroundColor: focused ? '#007AFF' : 'transparent',
              borderRadius: 16,
              padding: focused ? 8 : 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={focused ? '#fff' : '#8E8E93'} />
            </View>
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text style={{ color: focused ? '#007AFF' : '#8E8E93', fontWeight: '500', fontSize: 12, marginTop: 2 }}>Chat</Text>
          ),
        }}
      />
      <Tabs.Screen 
        name="all-saves"
        options={{
          title: 'All Saves',
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{
              backgroundColor: focused ? '#007AFF' : 'transparent',
              borderRadius: 16,
              padding: focused ? 8 : 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name={focused ? 'folder' : 'folder-outline'} size={24} color={focused ? '#fff' : '#8E8E93'} />
            </View>
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text style={{ color: focused ? '#007AFF' : '#8E8E93', fontWeight: '500', fontSize: 12, marginTop: 2 }}>All Saves</Text>
          ),
        }}
      />
    </Tabs>
  );
} 