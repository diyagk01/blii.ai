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
  TouchableOpacity,
  View
} from 'react-native';
import EdgeCaseMessageComponent from '../components/EdgeCaseMessage';
import ChatService from '../services/chat';
import EdgeCaseMessagingService, { EdgeCaseAction } from '../services/edge-case-messaging';
import { cleanDisplayTitle } from '../services/html-utils';
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
  originalMessage?: any;
  hasEdgeCase?: boolean;
  edgeCase?: any;
}

const HomeScreen = () => {
  const router = useRouter();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [user, setUser] = useState<any>(null);
  const sidebarAnim = useRef(new Animated.Value(-280)).current;
  const edgeCaseService = EdgeCaseMessagingService.getInstance();

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
      // Get more messages to ensure we capture all uploads (50 messages should cover most cases)
      const allMessages = await ChatService.getInstance().getUserMessages(50);
      
      // Filter for images, files, and links first, then get the most recent ones
      const uploadMessages = allMessages
        .filter(msg => {
          // Include all images, files, and links that have proper URLs or are link type
          const isValidUpload = (
            (msg.type === 'image' && msg.file_url) ||
            (msg.type === 'file' && msg.file_url) ||
            (msg.type === 'link' && (msg.file_url || msg.content.includes('http')))
          );
          
          console.log(`Checking message ${msg.id}: type=${msg.type}, has_file_url=${!!msg.file_url}, is_valid=${isValidUpload}`);
          return isValidUpload;
        })
        .slice(0, 20); // Take the 20 most recent uploads
      
      console.log(`Found ${uploadMessages.length} valid uploads out of ${allMessages.length} total messages`);
      
      // Process uploads to create display data
      const uploads: RecentUpload[] = await Promise.all(
        uploadMessages.map(async (msg) => {
            let imageUrl = '';
            let title = '';

            if (msg.type === 'image') {
              imageUrl = msg.file_url!;
              title = msg.filename || msg.content;
            } else if (msg.type === 'file') {
              // Check if it's a PDF with a preview image
              if (msg.filename && msg.filename.toLowerCase().endsWith('.pdf') && (msg as any).preview_image) {
                imageUrl = (msg as any).preview_image;
              } else {
                imageUrl = getFileTypeImage(msg.filename);
              }
              title = msg.filename || msg.content;
            } else if (msg.type === 'link') {
              // For links, prioritize stored extracted data, fallback to generating preview
              if (msg.extracted_title) {
                // Use stored extracted title (will be cleaned by cleanDisplayTitle)
                title = msg.extracted_title;
                // Use stored preview image if available
                imageUrl = (msg as any).preview_image || getLinkPreviewImage(msg.file_url || '');
              } else {
                // Fallback: generate new preview for links without extracted data
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
                  // Final fallback
                  imageUrl = getLinkPreviewImage(msg.file_url || '');
                  title = msg.content;
                }
              }
            }

            return {
              id: msg.id,
              title: cleanDisplayTitle(title),
              type: msg.type as 'image' | 'file' | 'link',
              image: imageUrl,
              file_url: msg.file_url,
              created_at: msg.created_at,
              tags: msg.tags,
              originalMessage: msg,
              hasEdgeCase: edgeCaseService.hasEdgeCase(msg),
              edgeCase: edgeCaseService.detectEdgeCase(msg) ? edgeCaseService.getEdgeCaseMessage(edgeCaseService.detectEdgeCase(msg)!) : null
            };
          })
      );

      // Only take the first 6 after processing
      setRecentUploads(uploads.slice(0, 6));
      
      // Update stats using allMessages for accurate counts
      const imageCount = allMessages.filter(msg => msg.type === 'image').length;
      const fileCount = allMessages.filter(msg => msg.type === 'file').length;
      const linkCount = allMessages.filter(msg => msg.type === 'link').length;
      
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
      return `https://via.placeholder.com/150x100/808080/white?text=🔗+${encodeURIComponent(domain.substring(0, 10))}`;
    } catch {
      return 'https://via.placeholder.com/150x100/808080/white?text=��+Link';
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

  const handleEdgeCaseAction = (action: EdgeCaseAction, messageId: string) => {
    console.log('🎯 Edge case action triggered in home:', action.type, 'for message:', messageId);
    
    switch (action.type) {
      case 'note':
        router.push({
          pathname: '/chat',
          params: { 
            initialMessage: `Add note to this item`,
            focusedMessageId: messageId
          }
        });
        break;
        
      case 'tag':
        router.push({
          pathname: '/chat',
          params: { 
            initialMessage: `Tag this item`,
            focusedMessageId: messageId
          }
        });
        break;
        
      case 'reminder':
        router.push({
          pathname: '/chat',
          params: { 
            initialMessage: `Remind me about this`,
            focusedMessageId: messageId
          }
        });
        break;
        
      case 'open':
      case 'view':
        // Find the upload and navigate to media preview
        const upload = recentUploads.find(u => u.id === messageId);
        if (upload) {
          const queryParams = new URLSearchParams({
            type: upload.type || 'unknown',
            title: upload.title || '',
            content: '',
            url: upload.file_url || '',
            imageUrl: upload.image || '',
            summary: '',
            id: upload.id || '',
          }).toString();
          router.push(`/media-preview?${queryParams}`);
        }
        break;
        
      case 'organize':
        router.push({
          pathname: '/chat',
          params: { 
            initialMessage: `Organize this item`,
            focusedMessageId: messageId
          }
        });
        break;
        
      default:
        console.log('Unknown action type:', action.type);
    }
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
    // Navigate to media preview with the save data
    const queryParams = new URLSearchParams({
      type: save.type || 'unknown',
      title: save.title || '',
      content: '', // Could be populated from save data if available
      url: save.file_url || '',
      imageUrl: save.image || '',
      summary: '', // Could be populated from save data if available
      id: save.id || '',
    }).toString();
    
    router.push(`/media-preview?${queryParams}`);
  };

  const handleMediaTypePress = (mediaType: string) => {
    console.log('Media type pressed:', mediaType);
    console.log('Navigating to all-saves with filter:', mediaType);
    // Navigate to All Saves with the media type filter
    router.push(`/(tabs)/all-saves?filter=${mediaType}`);
  };

  // Function to get relevant emoji for a tag
  const getTagEmoji = (tag: string): string => {
    const lowerTag = tag.toLowerCase();
    
    // Health & Wellness
    if (lowerTag.includes('health') || lowerTag.includes('medical') || lowerTag.includes('doctor')) return '🏥';
    if (lowerTag.includes('fitness') || lowerTag.includes('workout') || lowerTag.includes('gym') || lowerTag.includes('exercise')) return '💪';
    if (lowerTag.includes('wellness') || lowerTag.includes('mental health') || lowerTag.includes('therapy')) return '🧘';
    if (lowerTag.includes('food') || lowerTag.includes('recipe') || lowerTag.includes('cooking') || lowerTag.includes('nutrition')) return '🍽️';
    if (lowerTag.includes('diet') || lowerTag.includes('weight') || lowerTag.includes('calories')) return '🥗';
    if (lowerTag.includes('sleep') || lowerTag.includes('rest') || lowerTag.includes('bed')) return '😴';
    
    // Work & Business
    if (lowerTag.includes('work') || lowerTag.includes('job') || lowerTag.includes('career') || lowerTag.includes('business')) return '💼';
    if (lowerTag.includes('meeting') || lowerTag.includes('conference') || lowerTag.includes('presentation')) return '📊';
    if (lowerTag.includes('finance') || lowerTag.includes('money') || lowerTag.includes('budget') || lowerTag.includes('investment')) return '💰';
    if (lowerTag.includes('salary') || lowerTag.includes('income') || lowerTag.includes('pay')) return '💵';
    if (lowerTag.includes('project') || lowerTag.includes('task') || lowerTag.includes('deadline')) return '📋';
    if (lowerTag.includes('team') || lowerTag.includes('colleague') || lowerTag.includes('office')) return '👥';
    
    // Technology
    if (lowerTag.includes('tech') || lowerTag.includes('software') || lowerTag.includes('code') || lowerTag.includes('programming')) return '💻';
    if (lowerTag.includes('ai') || lowerTag.includes('artificial intelligence') || lowerTag.includes('machine learning')) return '🤖';
    if (lowerTag.includes('app') || lowerTag.includes('mobile') || lowerTag.includes('ios') || lowerTag.includes('android')) return '📱';
    if (lowerTag.includes('web') || lowerTag.includes('website') || lowerTag.includes('internet')) return '🌐';
    if (lowerTag.includes('data') || lowerTag.includes('analytics') || lowerTag.includes('stats')) return '📈';
    if (lowerTag.includes('cybersecurity') || lowerTag.includes('security') || lowerTag.includes('hack')) return '🔒';
    
    // Education & Learning
    if (lowerTag.includes('education') || lowerTag.includes('learning') || lowerTag.includes('study') || lowerTag.includes('course')) return '📚';
    if (lowerTag.includes('research') || lowerTag.includes('science') || lowerTag.includes('academic')) return '🔬';
    if (lowerTag.includes('book') || lowerTag.includes('reading') || lowerTag.includes('article')) return '📖';
    if (lowerTag.includes('university') || lowerTag.includes('college') || lowerTag.includes('school')) return '🎓';
    if (lowerTag.includes('tutorial') || lowerTag.includes('guide') || lowerTag.includes('how-to')) return '📝';
    if (lowerTag.includes('language') || lowerTag.includes('vocabulary') || lowerTag.includes('grammar')) return '🗣️';
    
    // Travel & Places
    if (lowerTag.includes('travel') || lowerTag.includes('trip') || lowerTag.includes('vacation') || lowerTag.includes('holiday')) return '✈️';
    if (lowerTag.includes('hotel') || lowerTag.includes('accommodation') || lowerTag.includes('booking')) return '🏨';
    if (lowerTag.includes('restaurant') || lowerTag.includes('cafe') || lowerTag.includes('dining')) return '🍴';
    if (lowerTag.includes('beach') || lowerTag.includes('ocean') || lowerTag.includes('sea')) return '🏖️';
    if (lowerTag.includes('mountain') || lowerTag.includes('hiking') || lowerTag.includes('climbing')) return '⛰️';
    if (lowerTag.includes('city') || lowerTag.includes('urban') || lowerTag.includes('downtown')) return '🏙️';
    
    // Entertainment & Media
    if (lowerTag.includes('movie') || lowerTag.includes('film') || lowerTag.includes('cinema')) return '🎬';
    if (lowerTag.includes('music') || lowerTag.includes('song') || lowerTag.includes('album') || lowerTag.includes('concert')) return '🎵';
    if (lowerTag.includes('game') || lowerTag.includes('gaming') || lowerTag.includes('video game')) return '🎮';
    if (lowerTag.includes('art') || lowerTag.includes('design') || lowerTag.includes('creative')) return '🎨';
    if (lowerTag.includes('podcast') || lowerTag.includes('audio') || lowerTag.includes('radio')) return '🎧';
    if (lowerTag.includes('tv') || lowerTag.includes('television') || lowerTag.includes('show')) return '📺';
    if (lowerTag.includes('comedy') || lowerTag.includes('funny') || lowerTag.includes('humor')) return '😄';
    
    // Shopping & Products
    if (lowerTag.includes('shopping') || lowerTag.includes('buy') || lowerTag.includes('purchase') || lowerTag.includes('product')) return '🛒';
    if (lowerTag.includes('fashion') || lowerTag.includes('clothing') || lowerTag.includes('style')) return '👗';
    if (lowerTag.includes('home') || lowerTag.includes('house') || lowerTag.includes('furniture') || lowerTag.includes('decor')) return '🏠';
    if (lowerTag.includes('gift') || lowerTag.includes('present') || lowerTag.includes('birthday')) return '🎁';
    if (lowerTag.includes('sale') || lowerTag.includes('discount') || lowerTag.includes('deal')) return '🏷️';
    if (lowerTag.includes('amazon') || lowerTag.includes('ebay') || lowerTag.includes('online')) return '📦';
    
    // Personal & Lifestyle
    if (lowerTag.includes('personal') || lowerTag.includes('life') || lowerTag.includes('lifestyle')) return '🌟';
    if (lowerTag.includes('hobby') || lowerTag.includes('interest') || lowerTag.includes('passion')) return '🎯';
    if (lowerTag.includes('family') || lowerTag.includes('kids') || lowerTag.includes('children')) return '👨‍👩‍👧‍👦';
    if (lowerTag.includes('relationship') || lowerTag.includes('dating') || lowerTag.includes('love')) return '💕';
    if (lowerTag.includes('goal') || lowerTag.includes('target') || lowerTag.includes('achievement')) return '🎯';
    if (lowerTag.includes('motivation') || lowerTag.includes('inspiration') || lowerTag.includes('success')) return '💪';
    
    // Nature & Environment
    if (lowerTag.includes('nature') || lowerTag.includes('environment') || lowerTag.includes('outdoor')) return '🌿';
    if (lowerTag.includes('weather') || lowerTag.includes('climate')) return '🌤️';
    if (lowerTag.includes('animal') || lowerTag.includes('pet') || lowerTag.includes('wildlife')) return '🐾';
    if (lowerTag.includes('plant') || lowerTag.includes('garden') || lowerTag.includes('flower')) return '🌸';
    if (lowerTag.includes('ocean') || lowerTag.includes('sea') || lowerTag.includes('water')) return '🌊';
    if (lowerTag.includes('forest') || lowerTag.includes('tree') || lowerTag.includes('wood')) return '🌲';
    
    // Sports & Activities
    if (lowerTag.includes('sport') || lowerTag.includes('football') || lowerTag.includes('basketball') || lowerTag.includes('soccer')) return '⚽';
    if (lowerTag.includes('running') || lowerTag.includes('marathon') || lowerTag.includes('jogging')) return '🏃';
    if (lowerTag.includes('yoga') || lowerTag.includes('meditation') || lowerTag.includes('mindfulness')) return '🧘';
    if (lowerTag.includes('swimming') || lowerTag.includes('pool') || lowerTag.includes('water')) return '🏊';
    if (lowerTag.includes('cycling') || lowerTag.includes('bike') || lowerTag.includes('bicycle')) return '🚴';
    if (lowerTag.includes('tennis') || lowerTag.includes('golf') || lowerTag.includes('baseball')) return '🎾';
    
    // News & Information
    if (lowerTag.includes('news') || lowerTag.includes('current events') || lowerTag.includes('politics')) return '📰';
    if (lowerTag.includes('important') || lowerTag.includes('urgent') || lowerTag.includes('priority')) return '⚡';
    if (lowerTag.includes('update') || lowerTag.includes('latest') || lowerTag.includes('trending')) return '📢';
    if (lowerTag.includes('breaking') || lowerTag.includes('alert') || lowerTag.includes('emergency')) return '🚨';
    
    // Finance & Money
    if (lowerTag.includes('stock') || lowerTag.includes('market') || lowerTag.includes('trading')) return '📈';
    if (lowerTag.includes('crypto') || lowerTag.includes('bitcoin') || lowerTag.includes('blockchain')) return '₿';
    if (lowerTag.includes('saving') || lowerTag.includes('budget') || lowerTag.includes('expense')) return '💳';
    
    // Social Media & Communication
    if (lowerTag.includes('social') || lowerTag.includes('media') || lowerTag.includes('network')) return '📱';
    if (lowerTag.includes('email') || lowerTag.includes('mail') || lowerTag.includes('inbox')) return '📧';
    if (lowerTag.includes('message') || lowerTag.includes('chat') || lowerTag.includes('text')) return '💬';
    
    // Time & Organization
    if (lowerTag.includes('schedule') || lowerTag.includes('calendar') || lowerTag.includes('appointment')) return '📅';
    if (lowerTag.includes('reminder') || lowerTag.includes('alarm') || lowerTag.includes('notification')) return '⏰';
    if (lowerTag.includes('todo') || lowerTag.includes('task') || lowerTag.includes('checklist')) return '✅';
    
    // Default fallback
    return '🏷️';
  };

  // Function to get color for a tag
  const getTagColor = (tag: string): string => {
    const lowerTag = tag.toLowerCase();
    
    // Use a variety of non-green colors
    if (lowerTag.includes('health') || lowerTag.includes('medical') || lowerTag.includes('fitness')) return '#FFE5E5'; // Light red
    if (lowerTag.includes('work') || lowerTag.includes('business') || lowerTag.includes('career')) return '#E5F0FF'; // Light blue
    if (lowerTag.includes('tech') || lowerTag.includes('code') || lowerTag.includes('ai')) return '#F0E5FF'; // Light purple
    if (lowerTag.includes('travel') || lowerTag.includes('trip') || lowerTag.includes('vacation')) return '#FFF5E5'; // Light orange
    if (lowerTag.includes('education') || lowerTag.includes('learning') || lowerTag.includes('book')) return '#E5F5FF'; // Light cyan
    if (lowerTag.includes('entertainment') || lowerTag.includes('movie') || lowerTag.includes('music')) return '#FFE5F5'; // Light pink
    if (lowerTag.includes('shopping') || lowerTag.includes('product') || lowerTag.includes('buy')) return '#F5E5FF'; // Light lavender
    if (lowerTag.includes('food') || lowerTag.includes('recipe') || lowerTag.includes('cooking')) return '#FFF0E5'; // Light peach
    
    // Default light blue
    return '#E5F3FF';
  };

  // Collect all unique tags from recentUploads for By Topic
  const allTags = Array.from(new Set(recentUploads.flatMap(u => u.tags || [])));
  
  // Calculate tag frequency to determine most used topic
  const tagFrequency: { [key: string]: number } = {};
  recentUploads.forEach(upload => {
    if (upload.tags) {
      upload.tags.forEach(tag => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });
    }
  });
  
  // Find the most used tag
  const mostUsedTag = Object.keys(tagFrequency).length > 0 
    ? Object.keys(tagFrequency).reduce((a, b) => tagFrequency[a] > tagFrequency[b] ? a : b)
    : null;
  
  // No default topic selection - users should see all sources first
  
  // Map tags to topic objects with relevant emojis and colors
  const tagTopics = allTags.map(tag => ({
    name: tag, // Use exact tag name as entered by user
    color: getTagColor(tag),
    emoji: getTagEmoji(tag),
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
                onMenuItemPress={() => setDrawerVisible(false)}
              />
            </Animated.View>
            <View style={{ flex: 1 }} />
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Main Content */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
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
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 12 }}
              onPress={() => router.push('/search')}
            >
              <Text style={{ fontSize: 16, color: '#B0B0B0' }}>
                Send message to save...
              </Text>
            </TouchableOpacity>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 0, marginBottom: 8 }}>
              {[0, 1].map(row => (
                <View key={row} style={{ flexDirection: 'row', width: '100%', marginBottom: 10 }}>
                  {[0, 1].map(col => {
                    const idx = row * 2 + col;
                    const stat = stats[idx];
                    if (!stat) return <View key={col} style={{ flex: 1, marginHorizontal: 4 }} />;
                    return (
                      <TouchableOpacity
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
                        onPress={() => handleMediaTypePress(stat.label.toLowerCase())}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={stat.icon as any} size={22} color="#222" style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: 15, color: '#4E4E4E', fontWeight: '400', fontFamily: 'SF Pro', lineHeight: 20, letterSpacing: -0.23, flex: 1 }}>{stat.label}</Text>
                        <Text style={{ fontSize: 16, color: '#B0B0B0', fontWeight: '600', marginLeft: 8 }}>{stat.count}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
            {/* Smart Prompts */}
            <View style={{ paddingHorizontal: 16, marginTop: 0, marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11 }}>
                <Text style={{ color: '#2264E6', fontWeight: '600', fontSize: 13, fontFamily: 'SF Pro Semibold', lineHeight: 18, letterSpacing: -0.08 }}>Smart Prompts</Text>
                <Image source={require('../assets/animations/47fa01cd0bd79a66b5ad97cdc5f4c41dd0caf508.gif')} style={{ width: 25, height: 25, marginLeft: 6, resizeMode: 'contain' }} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }} contentContainerStyle={{ gap: 16 }}>
                {smartPrompts.map((prompt, idx) => (
                  <TouchableOpacity
                    key={prompt}
                    style={{
                      backgroundColor: 'transparent',
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      marginRight: 0,
                      width: 240,
                      borderWidth: 1.2,
                      borderColor: 'rgba(162,89,255,0.18)', // subtle purple
                      justifyContent: 'center',
                    }}
                    onPress={() => handlePromptPress(prompt)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#171717', fontSize: 12, flex: 1, fontWeight: '400', textAlign: 'left', fontFamily: 'SF Pro', lineHeight: 16, letterSpacing: 0 }} numberOfLines={2}>{prompt}</Text>
                      <View style={{ marginLeft: 12, width: 16, height: 16, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                        {/* Horizontal line */}
                        <View style={{ 
                          position: 'absolute',
                          width: 12, 
                          height: 1.5, 
                          backgroundColor: '#7B61FF',
                          left: 2,
                          top: 7.25
                        }} />
                        {/* Arrow head */}
                        <View style={{ 
                          position: 'absolute',
                          width: 6, 
                          height: 6, 
                          borderRightWidth: 1.5, 
                          borderTopWidth: 1.5, 
                          borderColor: '#7B61FF', 
                          transform: [{ rotate: '45deg' }],
                          right: 2,
                          top: 5
                        }} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* By Topic */}
            <View style={{ paddingHorizontal: 16, marginTop: 0, marginBottom: 19 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' }}>
                <Text style={{
                  color: '#171717',
                  fontWeight: '600',
                  fontSize: 16,
                  fontFamily: 'SF Pro',
                  letterSpacing: -0.31,
                  lineHeight: 21
                }}>By Topic</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/all-saves')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#0065FF', fontWeight: '600', fontFamily: 'SF Pro Semibold', fontSize: 13, lineHeight: 18, letterSpacing: -0.08, marginRight: 2 }}>See all</Text>
                  <Ionicons name="chevron-forward" size={17} color="#1877F2" />
                </TouchableOpacity>

              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {tagTopics.map((topic, idx) => {
                  const isSelected = selectedTopic === topic.name;
                  return (
                    <TouchableOpacity
                      key={`topic-${idx}-${topic.name}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1.2,
                        borderColor: isSelected ? '#90C2FF' : '#E5EAF0',
                        backgroundColor: isSelected ? '#F5FAFF' : '#fff',
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
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
                    style={{ width: 154, height: 142, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5EAF0', marginRight: 12, overflow: 'hidden' }}
                    onPress={() => handleSavePress(save)}
                  >
                    {save.type === 'image' ? (
                      <Image source={{ uri: save.image }} style={{ width: '100%', height: '100%', borderRadius: 8, resizeMode: 'cover' }} />
                    ) : (
                      <>
                        <Image source={{ uri: save.image }} style={{ width: '100%', height: 80, borderTopLeftRadius: 8, borderTopRightRadius: 8 }} />
                        <View style={{ paddingTop: 10, paddingLeft: 10, paddingRight: 10, paddingBottom: 9 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                            {save.type === 'link' && <Image source={require('../assets/images/link-2.png')} style={{ width: 12, height: 12, marginRight: 6, marginTop: 2, resizeMode: 'contain' }} />}
                            {save.type === 'file' && <Image source={require('../assets/images/PDF.png')} style={{ width: 12, height: 12, marginRight: 6, marginTop: 2, resizeMode: 'contain' }} />}
                            <Text style={{ 
                              fontSize: 12, 
                              color: '#3E3E3E', 
                              fontWeight: '400', 
                              fontFamily: 'SF Pro', 
                              lineHeight: 16, 
                              letterSpacing: 0, 
                              flex: 1
                            }} numberOfLines={2}>{save.title}</Text>
                          </View>
                          {/* Tags for Topic Cards - Hidden but kept for filtering */}
                          {/* {save.tags && save.tags.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                              {save.tags.slice(0, 2).map((tag, tagIndex) => (
                                <View key={`topic-tag-${save.id}-${tagIndex}-${tag}`} style={{
                                  height: 18,
                                  paddingHorizontal: 5,
                                  paddingVertical: 1,
                                  borderRadius: 5,
                                  backgroundColor: '#ffffff',
                                  borderWidth: 1,
                                  borderColor: '#E0E0E0',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <Text style={{
                                    fontSize: 9,
                                    color: '#666666',
                                    fontWeight: '400',
                                  }}>
                                    {getTagEmoji(tag)} {tag}
                                  </Text>
                                </View>
                              ))}
                              {save.tags.length > 2 && (
                                <View style={{
                                  height: 18,
                                  paddingHorizontal: 5,
                                  paddingVertical: 1,
                                  borderRadius: 5,
                                  backgroundColor: '#f5f5f5',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <Text style={{
                                    fontSize: 9,
                                    color: '#999',
                                    fontWeight: '400',
                                  }}>
                                    +{save.tags.length - 2}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )} */}
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* Recent Saves */}
            <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#222', fontWeight: '600', fontFamily: 'SF Pro Semibold', fontSize: 16, lineHeight: 21, letterSpacing: -0.31 }}>Recent Saves</Text>
                <TouchableOpacity>
                  <Ionicons name="options-outline" size={20} color="#B0B0B0" />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {recentUploads.map((save, idx) => (
                  <View key={save.id} style={{ width: (width - 44) / 2, marginRight: idx % 2 === 0 ? 12 : 0, marginBottom: 14 }}>
                    <TouchableOpacity
                      style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5EAF0', overflow: 'hidden', height: save.type === 'image' ? 140 : 160 }}
                      onPress={() => handleSavePress(save)}
                    >
                    {save.type === 'image' ? (
                      <Image source={{ uri: save.image }} style={{ width: '100%', height: 140, borderRadius: 12, resizeMode: 'cover' }} />
                    ) : (
                      <>
                        <Image source={{ uri: save.image }} style={{ width: '100%', height: 90, borderTopLeftRadius: 12, borderTopRightRadius: 12, resizeMode: 'cover' }} />
                        <View style={{ padding: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                            {save.type === 'link' && <Image source={require('../assets/images/link-2.png')} style={{ width: 12, height: 12, marginRight: 6, marginTop: 2, resizeMode: 'contain' }} />}
                            {save.type === 'file' && <Image source={require('../assets/images/PDF.png')} style={{ width: 12, height: 12, marginRight: 6, marginTop: 2, resizeMode: 'contain' }} />}
                            <Text style={{ 
                              fontSize: 12, 
                              color: '#3E3E3E', 
                              fontWeight: '400', 
                              fontFamily: 'SF Pro', 
                              lineHeight: 16, 
                              letterSpacing: 0, 
                              flex: 1
                            }} numberOfLines={2}>{save.title}</Text>
                          </View>
                          {/* Tags for Recent Saves - Hidden but kept for filtering */}
                          {/* {save.tags && save.tags.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {save.tags.slice(0, 2).map((tag, tagIndex) => (
                                <View key={`tag-${save.id}-${tagIndex}-${tag}`} style={{
                                  height: 20,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  backgroundColor: '#ffffff',
                                  borderWidth: 1,
                                  borderColor: '#E0E0E0',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <Text style={{
                                    fontSize: 10,
                                    color: '#666666',
                                    fontWeight: '400',
                                  }}>
                                    {getTagEmoji(tag)} {tag}
                                  </Text>
                                </View>
                              ))}
                              {save.tags.length > 2 && (
                                <View style={{
                                  height: 20,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  backgroundColor: '#f5f5f5',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <Text style={{
                                    fontSize: 10,
                                    color: '#999',
                                    fontWeight: '400',
                                  }}>
                                    +{save.tags.length - 2}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )} */}
                        </View>
                      </>
                    )}
                    </TouchableOpacity>
                    
                    {/* Edge Case Message */}
                    {save.hasEdgeCase && save.edgeCase && (
                      <EdgeCaseMessageComponent
                        edgeCase={save.edgeCase}
                        onActionPress={(action) => handleEdgeCaseAction(action, save.id)}
                        style={{ marginTop: 8, marginHorizontal: 0 }}
                      />
                    )}
                  </View>
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
