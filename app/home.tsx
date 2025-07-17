import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import ChatService from '../services/chat';
import OpenAIService from '../services/openai';
import SupabaseAuthService from '../services/supabase-auth';
import Sidebar from './Sidebar';
// (Revert: remove drawer/modal logic)

const { width } = Dimensions.get('window');

interface RecentUpload {
  id: string;
  title: string;
  type: 'image' | 'file' | 'link';
  image: string;
  file_url?: string;
  created_at: string;
  tags?: string[];
}

const HomeScreen = () => {
  const router = useRouter();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [user, setUser] = useState<any>(null);
  const sidebarAnim = useRef(new Animated.Value(-280)).current;

  useEffect(() => {
    if (!user) {
      SupabaseAuthService.getInstance().getStoredUser().then(setUser);
    }
    // Animate sidebar in/out
    if (drawerVisible) {
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(sidebarAnim, {
        toValue: -280,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [drawerVisible, user]);

  // const openDrawer = () => { // Removed as per edit hint
  //   setDrawerVisible(true);
  //   Animated.timing(drawerAnim, {
  //     toValue: 0,
  //     duration: 250,
  //     useNativeDriver: false,
  //   }).start();
  // };
  // const closeDrawer = () => { // Removed as per edit hint
  //   Animated.timing(drawerAnim, {
  //     toValue: -300,
  //     duration: 200,
  //     useNativeDriver: false,
  //   }).start(() => setDrawerVisible(false));
  // };

  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [stats, setStats] = useState([
    { icon: 'image-outline', label: 'Images', count: 0 },
    { icon: 'link-outline', label: 'Links', count: 0 },
    { icon: 'document-text-outline', label: 'Docs', count: 0 },
    { icon: 'videocam-outline', label: 'Videos', count: 0 },
  ]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [smartPrompts, setSmartPrompts] = useState<string[]>([
    "What have I saved recently?",
    "Help me organize my content?",
    "Find connections in my uploads?"
  ]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const topics = [
    { name: 'Health', color: '#4CAF50', emoji: '🍃' },
    { name: 'Work', color: '#424242', emoji: '💼' },
    { name: 'Travel', color: '#2196F3', emoji: '✈️' },
    { name: 'To Read', color: '#9E9E9E', emoji: '📖' },
  ];

  // Load recent uploads from chat
  const loadRecentUploads = async () => {
    try {
      console.log('Loading recent uploads...');
      const messages = await ChatService.getInstance().getUserMessages(20); // Get last 20 messages
      
      // Filter for images and files only
      const uploads: RecentUpload[] = await Promise.all(
        messages
          .filter(msg => (msg.type === 'image' || msg.type === 'file' || msg.type === 'link') && (msg.file_url || msg.type === 'link'))
          .map(async (msg) => {
            let imageUrl = '';
            let title = '';

            if (msg.type === 'image') {
              imageUrl = msg.file_url!;
              title = msg.filename || msg.content;
            } else if (msg.type === 'file') {
              imageUrl = getFileTypeImage(msg.filename);
              title = msg.filename || msg.content;
            } else if (msg.type === 'link') {
              // For links, try to get the actual preview image from the LinkPreviewService
              try {
                const LinkPreviewService = await import('../services/link-preview');
                const linkPreviewService = LinkPreviewService.default.getInstance();
                const previewData = await linkPreviewService.generatePreview(msg.file_url || '');
                
                imageUrl = previewData.image;
                title = previewData.title;
                
                console.log('✅ Generated link preview for homepage:', {
                  url: msg.file_url,
                  title: previewData.title,
                  hasImage: !!previewData.image
                });
              } catch (error) {
                console.error('❌ Failed to generate link preview for homepage:', error);
                // Fallback to basic preview
                imageUrl = getLinkPreviewImage(msg.file_url || '');
                title = msg.content;
              }
            }

            return {
              id: msg.id,
              title: title,
              type: msg.type as 'image' | 'file' | 'link',
              image: imageUrl,
              file_url: msg.file_url,
              created_at: msg.created_at,
              tags: msg.tags
            };
          })
      );

      // Only take the first 6 after processing
      setRecentUploads(uploads.slice(0, 6));
      
      // Update stats
      const imageCount = messages.filter(msg => msg.type === 'image').length;
      const fileCount = messages.filter(msg => msg.type === 'file').length;
      const linkCount = messages.filter(msg => msg.type === 'link').length;
      
      setStats([
        { icon: 'image-outline', label: 'Images', count: imageCount },
        { icon: 'link-outline', label: 'Links', count: linkCount },
        { icon: 'document-text-outline', label: 'Docs', count: fileCount },
        { icon: 'videocam-outline', label: 'Videos', count: 0 }, // You can implement video tracking later
      ]);

      console.log('Loaded uploads with enhanced link previews:', uploads.length);
    } catch (error) {
      console.error('Error loading recent uploads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Generate placeholder image for file types
  const getFileTypeImage = (filename?: string) => {
    if (!filename) return 'https://via.placeholder.com/150x100/666/white?text=File';
    
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'https://via.placeholder.com/150x100/FF5722/white?text=PDF';
      case 'doc':
      case 'docx':
        return 'https://via.placeholder.com/150x100/2196F3/white?text=DOC';
      case 'xls':
      case 'xlsx':
        return 'https://via.placeholder.com/150x100/4CAF50/white?text=XLS';
      case 'ppt':
      case 'pptx':
        return 'https://via.placeholder.com/150x100/FF9800/white?text=PPT';
      default:
        return 'https://via.placeholder.com/150x100/666/white?text=FILE';
    }
  };

  // Generate better link preview image based on domain
  const getLinkPreviewImage = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        return 'https://via.placeholder.com/150x100/FF0000/white?text=▶+YouTube';
      } else if (domain.includes('github.com')) {
        return 'https://via.placeholder.com/150x100/24292e/white?text=📁+GitHub';
      } else if (domain.includes('medium.com')) {
        return 'https://via.placeholder.com/150x100/00ab6c/white?text=📰+Medium';
      } else if (domain.includes('techcrunch.com')) {
        return 'https://via.placeholder.com/150x100/0f9d58/white?text=🚀+Tech';
      } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
        return 'https://via.placeholder.com/150x100/1da1f2/white?text=🐦+X';
      } else if (domain.includes('linkedin.com')) {
        return 'https://via.placeholder.com/150x100/0077b5/white?text=💼+LinkedIn';
      } else {
        return 'https://via.placeholder.com/150x100/4285f4/white?text=🔗+Link';
      }
    } catch {
      return 'https://via.placeholder.com/150x100/4285f4/white?text=🔗+Link';
    }
  };

  // Load smart prompts based on user content
  const loadSmartPrompts = async () => {
    try {
      setLoadingPrompts(true);
      console.log('🧠 Loading smart prompts...');
      const questions = await OpenAIService.getInstance().generateSmartQuestions(3);
      setSmartPrompts(questions);
      console.log('✅ Smart prompts loaded:', questions);
    } catch (error) {
      console.error('❌ Error loading smart prompts:', error);
      // Keep existing fallback prompts
    } finally {
      setLoadingPrompts(false);
    }
  };

  useEffect(() => {
    loadRecentUploads();
    loadSmartPrompts();
    // Clean up orphaned extracted content
    ChatService.getInstance().cleanupOrphanedExtractedContent();
  }, []);

  // Ensure home page always updates when navigated to
  useFocusEffect(
    React.useCallback(() => {
      loadRecentUploads();
      loadSmartPrompts();
    }, [router])
  );

  const onRefresh = () => {
    loadRecentUploads();
    loadSmartPrompts(); // Also refresh the smart prompts
  };

  const handlePromptPress = (prompt: string) => {
    console.log('Prompt pressed:', prompt);
    // Navigate to chat tab with the prompt as initial message
    router.replace({
      pathname: '/chat',
      params: { initialMessage: prompt }
    });
  };

  const handleTopicPress = (topic: string) => {
    if (selectedTopic === topic) {
      setSelectedTopic(null); // Toggle off if already selected
    } else {
      setSelectedTopic(topic);
    }
  };

  const handleSavePress = (save: RecentUpload) => {
    console.log('Save pressed:', save.title);
    // Navigate to chat tab
    router.replace('/chat');
  };

  // Collect all unique tags from recentUploads for By Topic
  const allTags = Array.from(new Set(recentUploads.flatMap(u => u.tags || [])));
  // Map tags to topic objects (add emoji/color if desired)
  const tagTopics = allTags.map(tag => ({
    name: tag,
    color: '#E5F3FF', // default color, can be improved
    emoji: '🏷️', // default emoji, can be improved
  }));

  // Filter uploads by selected topic and search query
  let filteredUploads = recentUploads;
  if (selectedTopic) {
    filteredUploads = filteredUploads.filter(u => u.tags && u.tags.includes(selectedTopic));
  }
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filteredUploads = filteredUploads.filter(u =>
      (u.title && u.title.toLowerCase().includes(q)) ||
      (u.tags && u.tags.some(tag => tag.toLowerCase().includes(q))) ||
      (u.type === 'link' && u.file_url && u.file_url.toLowerCase().includes(q))
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fafafc' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f6fc" />
      {/* Sidebar Modal */}
      <Modal
        visible={drawerVisible}
        transparent
        animationType="none"
        onRequestClose={() => setDrawerVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' }}
          activeOpacity={1}
          onPress={() => setDrawerVisible(false)}
        >
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <Animated.View style={{ width: 280, height: '100%', backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 8, transform: [{ translateX: sidebarAnim }] }}>
              <Sidebar
                userName={user?.name || 'User'}
                userEmail={user?.email || ''}
                userAvatarUrl={user?.picture || 'https://ui-avatars.com/api/?name=User'}
              />
              <TouchableOpacity
                style={{ position: 'absolute', top: 18, right: 12, zIndex: 10, padding: 8 }}
                onPress={() => setDrawerVisible(false)}
              >
                <Ionicons name="close" size={24} color="#222" />
              </TouchableOpacity>
            </Animated.View>
            <View style={{ flex: 1 }} />
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Main Content */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32, minHeight: Dimensions.get('window').height + 1 }}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: '#fafafc' }}
      >
        {/* Search Bar */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24, marginBottom: 24 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 18,
            height: 48,
            paddingHorizontal: 16,
            shadowColor: '#007AFF',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            borderWidth: 1,
            borderColor: '#E5EAF0',
          }}>
            <TouchableOpacity onPress={() => setDrawerVisible(true)}>
              <Ionicons name="menu-outline" size={22} color="#B0B0B0" style={{ marginRight: 8 }} />
            </TouchableOpacity>
            <TextInput
              style={{ flex: 1, fontSize: 16, color: '#222' }}
              placeholder={'Send message to save...'}
              placeholderTextColor="#B0B0B0"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            <Ionicons name="search-outline" size={22} color="#B0B0B0" style={{ marginLeft: 8 }} />
          </View>
        </View>
        {recentUploads.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', marginTop: 12 }}>
            <Text style={{ fontWeight: '600', fontSize: 15, color: '#222', alignSelf: 'flex-start', marginLeft: 16, marginBottom: 12 }}>Add Your First Save</Text>
            <View style={{ flexDirection: 'row', marginBottom: 32 }}>
              <TouchableOpacity style={styles.emptyActionButtonNew} onPress={() => router.replace('/chat')}>
                <View style={styles.emptyActionIconBox}>
                  <Image
                    source={require('../assets/images/Frame 1686554136.png')}
                    style={{ width: 38, height: 38, borderRadius: 10, resizeMode: 'cover' }}
                  />
                </View>
                <Text style={styles.emptyActionButtonTextNew}>Send an image</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.emptyActionButtonNew, { marginLeft: 16 }]} onPress={() => router.replace('/chat')}>
                <View style={styles.emptyActionIconBox}>
                  <Image
                    source={require('../assets/images/Frame 1686554136 (1).png')}
                    style={{ width: 38, height: 38, borderRadius: 10, resizeMode: 'cover' }}
                  />
                </View>
                <Text style={styles.emptyActionButtonTextNew}>Upload a doc</Text>
              </TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 16 }}>
              <Image
                source={require('../assets/animations/e2845539ebe2165b68fdf65cced864ee8d2083e8 (1).gif')}
                style={{ width: 240, height: 240, resizeMode: 'contain', borderRadius: 16 }}
              />
            </View>
            <Text style={{ color: '#666', fontSize: 17, textAlign: 'center', marginTop: 8, fontFamily: 'System', fontWeight: '400', lineHeight: 24 }}>
              Your space is empty, drop a{`\n`}message to begin saving.
            </Text>
          </View>
        ) : (
          <>
            {/* Stats 2x2 Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 0, marginBottom: 36 }}>
              {[0, 1].map(row => (
                <View key={row} style={{ flexDirection: 'row', width: '100%', marginBottom: 10 }}>
                  {[0, 1].map(col => {
                    const idx = row * 2 + col;
                    const stat = stats[idx];
                    if (!stat) return <View key={col} style={{ flex: 1, marginHorizontal: 4 }} />;
                    return (
                      <View
                        key={stat.label}
                        style={{
                          flex: 1,
                          backgroundColor: '#fff',
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: '#F3F4F6',
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 18,
                          paddingHorizontal: 18,
                          marginHorizontal: col === 0 ? 0 : 12,
                          shadowColor: '#000',
                          shadowOpacity: 0.03,
                          shadowRadius: 2,
                          shadowOffset: { width: 0, height: 1 },
                        }}
                      >
                        <Ionicons name={stat.icon as any} size={22} color="#222" style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: 15, color: '#A0A0A0', fontWeight: '500', flex: 1 }}>{stat.label}</Text>
                        <Text style={{ fontSize: 16, color: '#B0B0B0', fontWeight: '600', marginLeft: 8 }}>{stat.count}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
            {/* Smart Prompts */}
            <View style={{ paddingHorizontal: 16, marginTop: 0, marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11 }}>
                <Text style={{ color: '#2264E6', fontWeight: '700', fontSize: 17 }}>Smart Prompts</Text>
                <Ionicons name="sparkles-outline" size={16} color="#2264E6" />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }} contentContainerStyle={{ gap: 16 }}>
                {smartPrompts.map((prompt, idx) => (
                  <TouchableOpacity
                    key={prompt}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 12,
                      paddingHorizontal: 18,
                      paddingVertical: 18,
                      marginRight: 0,
                      width: 240,
                      borderWidth: 1.2,
                      borderColor: 'rgba(162,89,255,0.18)', // subtle purple
                      justifyContent: 'center',
                    }}
                    onPress={() => handlePromptPress(prompt)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#222', fontSize: 16, flex: 1, fontWeight: '500', textAlign: 'left' }} numberOfLines={2}>{prompt}</Text>
                      <Ionicons name="arrow-forward-outline" size={20} color="#7B61FF" style={{ marginLeft: 12 }} />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* By Topic */}
            <View style={{ paddingHorizontal: 16, marginTop: 0, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' }}>
                <Text style={{ color: '#222', fontWeight: '700', fontSize: 17 }}>By Topic</Text>
                <TouchableOpacity onPress={() => router.push('/all-saves')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#1877F2', fontWeight: '600', fontSize: 15, marginRight: 2 }}>See all</Text>
                  <Ionicons name="chevron-forward" size={17} color="#1877F2" />
                </TouchableOpacity>
                {selectedTopic && (
                  <TouchableOpacity onPress={() => setSelectedTopic(null)}>
                    <Text style={{ color: '#007AFF', fontWeight: '500', fontSize: 13 }}>Clear Filter</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {tagTopics.map((topic, idx) => {
                  const isSelected = selectedTopic === topic.name;
                  return (
                    <TouchableOpacity
                      key={topic.name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1.2,
                        borderColor: isSelected ? '#90C2FF' : '#E5EAF0',
                        backgroundColor: isSelected ? '#F5FAFF' : '#fff',
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        marginRight: 10,
                        minWidth: 44,
                        minHeight: 36,
                        justifyContent: 'center',
                        shadowColor: isSelected ? '#90C2FF' : 'transparent',
                        shadowOpacity: isSelected ? 0.12 : 0,
                        shadowRadius: isSelected ? 4 : 0,
                        shadowOffset: { width: 0, height: 1 },
                      }}
                      onPress={() => handleTopicPress(topic.name)}
                    >
                      <Text style={{ fontSize: 14, marginRight: 6 }}>{topic.emoji}</Text>
                      <Text style={{ fontSize: 13, color: isSelected ? '#222' : '#444', fontWeight: '400', fontFamily: 'System' }}>{topic.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {/* Topic Cards */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {filteredUploads.map((save, idx) => (
                  <TouchableOpacity
                    key={save.id}
                    style={{ width: 180, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5EAF0', marginRight: 12, overflow: 'hidden' }}
                    onPress={() => handleSavePress(save)}
                  >
                    <Image source={{ uri: save.image }} style={{ width: '100%', height: 90, borderTopLeftRadius: 12, borderTopRightRadius: 12 }} />
                    <View style={{ padding: 10 }}>
                      <Text style={{ fontSize: 13, color: '#222', fontWeight: '500' }} numberOfLines={2}>{save.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        {save.type === 'link' && <Ionicons name="link-outline" size={13} color="#007AFF" style={{ marginRight: 4 }} />}
                        {save.type === 'file' && <Ionicons name="document-outline" size={13} color="#007AFF" style={{ marginRight: 4 }} />}
                        {save.type === 'image' && <Ionicons name="image-outline" size={13} color="#007AFF" style={{ marginRight: 4 }} />}
                        {save.tags && save.tags.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {save.tags.slice(0, 2).map((tag, i) => (
                              <View key={tag} style={{ backgroundColor: '#E5F3FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginBottom: 2 }}>
                                <Text style={{ fontSize: 10, color: '#007AFF' }}>#{tag}</Text>
                              </View>
                            ))}
                            {save.tags.length > 2 && (
                              <Text style={{ fontSize: 10, color: '#888' }}>+{save.tags.length - 2}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* Recent Saves */}
            <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#222', fontWeight: '700', fontSize: 17 }}>Recent Saves</Text>
                <TouchableOpacity>
                  <Ionicons name="options-outline" size={20} color="#B0B0B0" />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {recentUploads.map((save, idx) => (
                  <TouchableOpacity
                    key={save.id}
                    style={{ width: '48%', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5EAF0', marginBottom: 12, overflow: 'hidden' }}
                    onPress={() => handleSavePress(save)}
                  >
                    <Image source={{ uri: save.image }} style={{ width: '100%', height: 80, borderTopLeftRadius: 12, borderTopRightRadius: 12 }} />
                    <View style={{ padding: 10 }}>
                      <Text style={{ fontSize: 12, color: '#222', fontWeight: '500' }} numberOfLines={2}>{save.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        {save.type === 'link' && <Ionicons name="link-outline" size={12} color="#007AFF" style={{ marginRight: 4 }} />}
                        {save.type === 'file' && <Ionicons name="document-outline" size={12} color="#007AFF" style={{ marginRight: 4 }} />}
                        {save.type === 'image' && <Ionicons name="image-outline" size={12} color="#007AFF" style={{ marginRight: 4 }} />}
                        {save.tags && save.tags.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {save.tags.slice(0, 2).map((tag, i) => (
                              <View key={tag} style={{ backgroundColor: '#E5F3FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginBottom: 2 }}>
                                <Text style={{ fontSize: 10, color: '#007AFF' }}>#{tag}</Text>
                              </View>
                            ))}
                            {save.tags.length > 2 && (
                              <Text style={{ fontSize: 10, color: '#888' }}>+{save.tags.length - 2}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      {/* Bottom navigation handled by tab navigator */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  profileButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  statsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    alignItems: 'center',
  },
  statCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  promptsContainer: {
    padding: 16,
  },
  promptsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingPromptsText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  promptCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  promptText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginRight: 12,
  },
  promptCardDisabled: {
    opacity: 0.6,
  },
  promptTextDisabled: {
    color: '#999',
  },
  topicsContainer: {
    padding: 16,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  topicEmoji: {
    fontSize: 14,
  },
  topicName: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  recentContainer: {
    padding: 16,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recentCard: {
    width: (width - 44) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recentImage: {
    width: '100%',
    height: 100,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    resizeMode: 'cover',
  },
  recentContent: {
    padding: 12,
  },
  recentTitle: {
    fontSize: 12,
    color: '#333',
    lineHeight: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  tagBadge: {
    padding: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#666',
  },
  moreTagsText: {
    fontSize: 10,
    color: '#666',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    margin: 16,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2264E6',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 0,
    shadowColor: '#2264E6',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  emptyActionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyActionButtonNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F0FF',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 0,
    minWidth: 160,
    shadowColor: '#2264E6',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  emptyActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    // backgroundColor: '#3B82F6', // Remove blue background
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden', // Ensure image is clipped to rounded corners
  },
  emptyActionButtonTextNew: {
    color: '#222',
    fontWeight: '500',
    fontSize: 16,
  },
});

export default HomeScreen;
