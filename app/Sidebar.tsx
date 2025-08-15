import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SidebarProps {
  userName: string;
  userEmail: string;
  userAvatarUrl: string;
  onMenuItemPress?: () => void; // Add callback to close sidebar when menu item is pressed
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

export default function Sidebar({ userName, userEmail, userAvatarUrl, onMenuItemPress }: SidebarProps) {
  const router = useRouter();
  
  const handleMenuItemPress = (route?: string) => {
    if (route) {
      router.push(route as any);
    }
    onMenuItemPress?.(); // Close the sidebar
  };
  return (
    <SafeAreaView style={styles.container}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Image
          source={require('../assets/images/Frame 1686554130.png')}
          style={styles.avatar}
        />
        <View style={styles.profileTextCol}>
          <Text style={styles.profileName}>Hi {userName}</Text>
          <Text style={styles.profileEmail} numberOfLines={1} adjustsFontSizeToFit>{userEmail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#B0B0B0" style={{ marginLeft: 'auto' }} />
      </View>

      {/* Upgrade Card with Linear Gradient */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/UpgradePro')} style={{ borderRadius: 10, overflow: 'hidden', marginTop: 23, marginBottom: 12, marginRight: 10, marginLeft: 10 }}>
        <LinearGradient
          colors={["#589AFF", "#0065FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.upgradeCard}
        >
          <View style={styles.upgradeLeftBlock}>
            <View style={styles.upgradeTextContainer}>
              <Text style={styles.upgradeTitle}>Upgrade to Blii Pro</Text>
              <Text style={[styles.upgradeSubtitle, { flexWrap: 'wrap', maxWidth: 160 }]}>Get full access to AI, unlimited saves, smart search and more.</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Menu List */}
      <View style={{ marginTop: 8, flex: 1 }}>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => handleMenuItemPress('/all-saves')}>
          <Ionicons name="bookmark-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>All Saves</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => handleMenuItemPress()}>
          <Ionicons name="star-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>Starred</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => handleMenuItemPress()}>
          <Ionicons name="laptop-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>Linked devices</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => handleMenuItemPress('/settings')}>
          <Ionicons name="settings-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => handleMenuItemPress('/recently-deleted')}>
          <Ionicons name="trash-outline" size={20} color="#222" />
          <Text style={styles.menuLabel}>Recently Deleted</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => handleMenuItemPress()}>
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
    paddingLeft: 24,
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'column',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    marginBottom: 10,
    marginRight: 10,
    marginLeft: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    resizeMode: 'cover',
  },
  profileTextCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginLeft: 12,
    flex: 1,
    marginRight: 8, // Add margin to prevent overlap with chevron
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
    flexShrink: 1,
    minWidth: 0,
  },
  upgradeCard: {
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  upgradeLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  upgradeCircle: {
    width: 30,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  upgradeTextContainer: {
    flex: 1,
    marginRight: 8, // Add margin to prevent overlap with chevron
  },
  upgradeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'System',
    lineHeight: 18,
  },
  upgradeSubtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: '#fff',
    fontFamily: 'System',
    lineHeight: 14,
    marginTop: 1,
    flexWrap: 'wrap', // Allow text to wrap
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
    marginLeft: 20,
    paddingHorizontal: 4,
  },
  menuLabel: {
    color: '#171717',
    fontFamily: 'SF Pro',
    fontSize: 15,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.23,
    // font-feature-settings is not supported in React Native, so it's omitted
  },
});
