import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SidebarProps {
  userName: string;
  userEmail: string;
  userAvatarUrl: string;
}

type MenuItem =
  | { icon: (color: string) => React.ReactNode; label: string; divider?: false }
  | { divider: true };

const menuItems: MenuItem[] = [
  { icon: (color: string) => <Ionicons name="bookmark-outline" size={20} color={color} />, label: 'All Saves' },
  { icon: (color: string) => <Ionicons name="star-outline" size={20} color={color} />, label: 'Starred' },
  { icon: (color: string) => <MaterialCommunityIcons name="devices" size={20} color={color} />, label: 'Linked devices' },
  { divider: true },
  { icon: (color: string) => <Ionicons name="settings-outline" size={20} color={color} />, label: 'Settings' },
  { icon: (color: string) => <Ionicons name="trash-outline" size={20} color={color} />, label: 'Recently Deleted' },
  { icon: (color: string) => <Feather name="help-circle" size={20} color={color} />, label: 'Help' },
];

export default function Sidebar({ userName, userEmail, userAvatarUrl }: SidebarProps) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Image
          source={{ uri: userAvatarUrl }}
          style={styles.avatar}
        />
        <View style={styles.profileTextCol}>
          <Text style={styles.profileName}>Hi {userName}</Text>
          <Text style={styles.profileEmail}>{userEmail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#B0B0B0" style={{ marginLeft: 'auto' }} />
      </View>

      {/* Upgrade Card */}
      <TouchableOpacity style={{ marginBottom: 12 }} activeOpacity={0.85} onPress={() => router.push('/UpgradePro')}>
        <Image
          source={require('../assets/images/Frame 1686554138.png')}
          style={{ width: 219, height: 70, borderRadius: 12, resizeMode: 'cover', alignSelf: 'center' }}
        />
      </TouchableOpacity>

      {/* Menu List */}
      <View style={{ marginTop: 8, flex: 1 }}>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Ionicons name="bookmark-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>All Saves</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Ionicons name="star-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>Starred</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Ionicons name="laptop-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>Linked devices</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>Recently Deleted</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <Ionicons name="help-circle-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>Help</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: '100%',
    backgroundColor: '#fff',
    padding: 16,
    flexDirection: 'column',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    resizeMode: 'cover',
  },
  profileTextCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    fontFamily: 'System',
    lineHeight: 20,
  },
  profileEmail: {
    fontSize: 13,
    fontWeight: '400',
    color: '#888',
    fontFamily: 'System',
    lineHeight: 18,
  },
  upgradeCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    marginBottom: 0,
  },
  upgradeLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradeCircle: {
    width: 36,
    height: 36,
    backgroundColor: '#fff',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  upgradeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'System',
    lineHeight: 20,
  },
  upgradeSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#fff',
    fontFamily: 'System',
    lineHeight: 16,
    marginTop: 2,
    maxWidth: 160,
  },
  divider: {
    marginTop: 18,
    marginBottom: 18,
    height: 1,
    backgroundColor: '#E5E7EB',
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: '#222',
    fontFamily: 'System',
  },
}); 