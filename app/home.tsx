import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Dimensions,
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

const HomeScreen = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const stats = [
    { icon: 'image-outline', label: 'Images', count: 24 },
    { icon: 'link-outline', label: 'Links', count: 12 },
    { icon: 'document-text-outline', label: 'Docs', count: 18 },
    { icon: 'videocam-outline', label: 'Videos', count: 3 },
  ];

  const smartPrompts = [
    "What did I save about Goa trip?",
    "Summarize the collagen diet article"
  ];

  const topics = [
    { name: 'Health', color: '#4CAF50', emoji: '🍃' },
    { name: 'Work', color: '#424242', emoji: '💼' },
    { name: 'Travel', color: '#2196F3', emoji: '✈️' },
    { name: 'To Read', color: '#9E9E9E', emoji: '📖' },
  ];

  const recentSaves = [
    {
      id: 1,
      title: 'Collagen Diet: Benefits, How to Get...',
      type: 'article',
      image: 'https://via.placeholder.com/150x100/4CAF50/white?text=Health',
    },
    {
      id: 2,
      title: 'Meal Plan 7days_Veg.pdf',
      type: 'pdf',
      image: 'https://via.placeholder.com/150x100/FF9800/white?text=PDF',
    },
    {
      id: 3,
      title: 'Where should AI sit in your UI?',
      type: 'article',
      image: 'https://via.placeholder.com/150x100/2196F3/white?text=UI/UX',
    },
    {
      id: 4,
      title: 'The UX butterfly effect',
      type: 'article',
      image: 'https://via.placeholder.com/150x100/FFC107/white?text=Design',
    },
    {
      id: 5,
      title: 'Travel Itinerary 10d_10_Goa.pdf',
      type: 'pdf',
      image: 'https://via.placeholder.com/150x100/9C27B0/white?text=Travel',
    },
    {
      id: 6,
      title: 'Meal Plan 7days_Veg.pdf',
      type: 'pdf',
      image: 'https://via.placeholder.com/150x100/FF5722/white?text=Food',
    },
  ];

  const handleSearch = () => {
    console.log('Search:', searchQuery);
  };

  const handlePromptPress = (prompt: string) => {
    console.log('Prompt pressed:', prompt);
  };

  const handleTopicPress = (topic: string) => {
    console.log('Topic pressed:', topic);
  };

  const handleSavePress = (save: any) => {
    console.log('Save pressed:', save.title);
  };

  const handleChatPress = () => {
    router.push('/chat-screen');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#666" />
        </TouchableOpacity>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
        </View>
        
        <TouchableOpacity style={styles.micButton}>
          <Ionicons name="mic-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statItem}>
              <Ionicons name={stat.icon as any} size={24} color="#666" />
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statCount}>{stat.count}</Text>
            </View>
          ))}
        </View>

        {/* Smart Prompts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Smart Prompts</Text>
            <Ionicons name="add" size={20} color="#007AFF" />
          </View>
          
          <View style={styles.promptsContainer}>
            {smartPrompts.map((prompt, index) => (
              <TouchableOpacity
                key={index}
                style={styles.promptButton}
                onPress={() => handlePromptPress(prompt)}
              >
                <Text style={styles.promptText}>{prompt}</Text>
                <Ionicons name="arrow-forward" size={16} color="#007AFF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* By Topic */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>By Topic</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.topicsContainer}>
            {topics.map((topic, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.topicButton, { backgroundColor: topic.color }]}
                onPress={() => handleTopicPress(topic.name)}
              >
                <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                <Text style={styles.topicText}>{topic.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Content Grid */}
        <View style={styles.contentGrid}>
          {recentSaves.slice(0, 4).map((save, index) => (
            <TouchableOpacity
              key={save.id}
              style={styles.contentCard}
              onPress={() => handleSavePress(save)}
            >
              <View style={styles.contentImageContainer}>
                <Image source={{ uri: save.image }} style={styles.contentImage} />
              </View>
              <Text style={styles.contentTitle} numberOfLines={2}>
                {save.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Saves */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Saves</Text>
          
          <View style={styles.recentSavesGrid}>
            {recentSaves.slice(4).map((save, index) => (
              <TouchableOpacity
                key={save.id}
                style={styles.recentSaveCard}
                onPress={() => handleSavePress(save)}
              >
                <View style={styles.recentSaveImageContainer}>
                  <Image source={{ uri: save.image }} style={styles.recentSaveImage} />
                </View>
                <Text style={styles.recentSaveTitle} numberOfLines={2}>
                  {save.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom Padding for tab bar */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="home" size={24} color="#007AFF" />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={handleChatPress}>
          <Ionicons name="chatbubbles-outline" size={24} color="#8E8E93" />
          <Text style={styles.tabLabel}>Chat</Text>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuButton: {
    padding: 8,
    marginRight: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  micButton: {
    padding: 8,
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  promptsContainer: {
    gap: 8,
  },
  promptButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  promptText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginRight: 12,
  },
  topicsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  topicButton: {
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
  topicText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  contentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  contentCard: {
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
  contentImageContainer: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  contentImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentTitle: {
    fontSize: 12,
    color: '#333',
    padding: 12,
    lineHeight: 16,
  },
  recentSavesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recentSaveCard: {
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
  recentSaveImageContainer: {
    width: '100%',
    height: 100,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  recentSaveImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  recentSaveTitle: {
    fontSize: 12,
    color: '#333',
    padding: 12,
    lineHeight: 16,
  },
  bottomPadding: {
    height: 100,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 5,
    paddingBottom: 5,
    height: 60,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    color: '#8E8E93',
  },
  tabLabelActive: {
    color: '#007AFF',
  },
});

export default HomeScreen; 