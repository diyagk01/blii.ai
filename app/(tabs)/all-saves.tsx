import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChatService from '../../services/chat';

// Optionally, map emojis to common tags
const tagEmojis: Record<string, string> = {
  Health: '🍃',
  Work: '💼',
  Travel: '✈️',
  'To Read': '📖',
};

export default function AllSavesScreen() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showStarred, setShowStarred] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Fetch all user materials on mount and when screen is focused
  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const chatService = ChatService.getInstance();
      const msgs = await chatService.getMessagesWithContent(100);
      
      // Process messages to add proper preview images for links
      const processedMsgs = await Promise.all(
        msgs.map(async (msg: any) => {
          if (msg.type === 'link' && msg.file_url) {
            try {
              // Generate proper link preview image
              const LinkPreviewService = await import('../../services/link-preview');
              const linkPreviewService = LinkPreviewService.default.getInstance();
              const previewData = await linkPreviewService.generatePreview(msg.file_url);
              
              return {
                ...msg,
                preview_image: previewData.image,
                preview_title: previewData.title
              };
            } catch (error) {
              console.error('❌ Failed to generate link preview for all-saves:', error);
              // Fallback to basic preview
              return {
                ...msg,
                preview_image: getLinkPreviewImage(msg.file_url),
                preview_title: msg.content
              };
            }
          }
          return msg;
        })
      );
      
      setMaterials(processedMsgs);
      setStarredIds(new Set(processedMsgs.filter((m: any) => m.starred).map((m: any) => m.id)));
    } catch (e) {
      setMaterials([]);
    }
    setLoading(false);
  };

  // Generate better link preview image based on domain (fallback function)
  const getLinkPreviewImage = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        return 'https://via.placeholder.com/400x300/FF0000/white?text=▶️+YouTube';
      } else if (domain.includes('github.com')) {
        return 'https://via.placeholder.com/400x300/24292e/white?text=📁+GitHub';
      } else if (domain.includes('medium.com')) {
        return 'https://via.placeholder.com/400x300/00ab6c/white?text=📰+Medium';
      } else if (domain.includes('techcrunch.com')) {
        return 'https://via.placeholder.com/400x300/0f9d58/white?text=🚀+Tech';
      } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
        return 'https://via.placeholder.com/400x300/1da1f2/white?text=🐦+X';
      } else if (domain.includes('linkedin.com')) {
        return 'https://via.placeholder.com/400x300/0077b5/white?text=💼+LinkedIn';
      } else {
        return 'https://via.placeholder.com/400x300/4285f4/white?text=🔗+Link';
      }
    } catch {
      return 'https://via.placeholder.com/400x300/4285f4/white?text=🔗+Link';
    }
  };

  // Generate placeholder image for file types
  const getFileTypeImage = (filename?: string) => {
    if (!filename) return 'https://via.placeholder.com/400x300/666/white?text=File';
    
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'https://via.placeholder.com/400x300/FF5722/white?text=📄+PDF';
      case 'doc':
      case 'docx':
        return 'https://via.placeholder.com/400x300/2196F3/white?text=📝+DOC';
      case 'xls':
      case 'xlsx':
        return 'https://via.placeholder.com/400x300/4CAF50/white?text=📊+XLS';
      case 'ppt':
      case 'pptx':
        return 'https://via.placeholder.com/400x300/FF9800/white?text=📊+PPT';
      default:
        return 'https://via.placeholder.com/400x300/666/white?text=📄+FILE';
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchMaterials();
    }, [])
  );

  // Extract all unique tags
  const allTags = Array.from(new Set(materials.flatMap((m: any) => m.tags || [])));

  // Filtered materials
  let filtered = materials.filter((m: any) =>
    (m.type === 'file' || m.type === 'image' || m.type === 'link') && !m.isBot
  );
  let filteredBeforeStarred = filtered;
  if (selectedTag) {
    filtered = filtered.filter((m: any) => m.tags && m.tags.includes(selectedTag));
    filteredBeforeStarred = filtered;
  }
  if (showStarred) {
    filtered = filtered.filter((m: any) => starredIds.has(m.id));
  }

  // Toggle star for a material
  const toggleStar = async (id: string) => {
    setStarredIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    // Persist to backend
    try {
      const chatService = ChatService.getInstance();
      const item = materials.find((m: any) => m.id === id);
      if (item) {
        await chatService.updateMessageStarred(id, !starredIds.has(id));
      }
    } catch (e) {
      // Optionally: revert UI if error
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      {/* Header - match Chat header style, but only search button and lower on screen */}
      <View style={styles.headerRowCustom}> 
        <TouchableOpacity style={styles.headerIconLeftAbsolute} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitleCenteredAbsolute}>All Saves</Text>
        <TouchableOpacity style={styles.headerIconRightAbsolute}>
          <Ionicons name="search" size={18} color="#7A869A" />
        </TouchableOpacity>
      </View>
      {/* Tag Chips - horizontal pill style, compact spacing */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicsScroll} contentContainerStyle={styles.topicsRow}>
        <TouchableOpacity
          style={[styles.topicChip, !selectedTag && styles.topicChipSelected]}
          onPress={() => setSelectedTag(null)}
        >
          <Text style={[styles.topicChipText, !selectedTag && styles.topicChipTextSelected]}>All</Text>
        </TouchableOpacity>
        {allTags.map((tag) => {
          const selected = selectedTag === tag;
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.topicChip, selected ? styles.topicChipSelected : styles.topicChipUnselected]}
              onPress={() => setSelectedTag(tag)}
              activeOpacity={0.85}
            >
              <Text style={[styles.topicChipEmoji, selected ? styles.topicChipEmojiSelected : styles.topicChipEmojiUnselected]}>{tagEmojis[tag] || '🏷️'}</Text>
              <Text style={[styles.topicChipText, selected ? styles.topicChipTextSelected : styles.topicChipTextUnselected]}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* Filters Row - exact pill style, flat, with precise spacing */}
      <View style={styles.filtersRow}>
        <TouchableOpacity style={[styles.filterButton, !showStarred && styles.filterButtonSelected]} onPress={() => setShowStarred(false)}>
          <Text style={[styles.filterButtonText, !showStarred && styles.filterButtonTextSelected]}>All Media ({filteredBeforeStarred.length})</Text>
          <Ionicons name="chevron-down" size={16} color={!showStarred ? '#fff' : '#7A869A'} style={styles.filterButtonIcon} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterButton, showStarred && styles.filterButtonSelected]} onPress={() => setShowStarred(true)}>
          <Ionicons name={showStarred ? 'star' : 'star-outline'} size={16} color={showStarred ? '#fff' : '#7A869A'} style={styles.filterButtonIcon} />
          <Text style={[styles.filterButtonText, showStarred && styles.filterButtonTextSelected]}>Starred</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="options-outline" size={16} color="#7A869A" style={styles.filterButtonIcon} />
        </TouchableOpacity>
      </View>
      {/* Saves List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24, marginTop: 8 }}>
          {filtered.map((item: any) => {
            // Determine the image to show
            let imageUrl = '';
            let title = '';
            
            if (item.type === 'image' && item.file_url) {
              imageUrl = item.file_url;
              title = item.filename || item.content;
            } else if (item.type === 'file' && item.filename) {
              imageUrl = getFileTypeImage(item.filename);
              title = item.filename || item.content;
            } else if (item.type === 'link') {
              imageUrl = item.preview_image || getLinkPreviewImage(item.file_url || '');
              title = item.preview_title || item.content;
            } else {
              title = item.content || item.filename || 'Untitled';
            }

            return (
              <View key={item.id} style={styles.card}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.cardImage} />
                ) : null}
                <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
                {/* Show tags */}
                {item.tags && item.tags.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                    {item.tags.map((tag: string) => (
                      <View key={tag} style={{ backgroundColor: '#E5F3FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginBottom: 2 }}>
                        <Text style={{ fontSize: 10, color: '#007AFF' }}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {/* Star icon button */}
                <TouchableOpacity
                  style={styles.starButton}
                  onPress={() => toggleStar(item.id)}
                >
                  <Ionicons
                    name={starredIds.has(item.id) ? 'star' : 'star-outline'}
                    size={22}
                    color={starredIds.has(item.id) ? '#FFD700' : '#B0B0B0'}
                  />
                </TouchableOpacity>
              </View>
            );
          })}
          {filtered.length === 0 && (
            <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No materials found.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 0,
    minHeight: 56,
    height: 56,
  },
  // Custom header for All Saves
  headerRowCustom: {
    height: 64,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    position: 'relative',
    justifyContent: 'center',
  },
  headerIconLeft: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 0,
  },
  headerIconsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 64,
  },
  headerIconsRightCustom: {
    position: 'absolute',
    right: 12,
    top: 0, // align with new header position
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 32,
  },
  headerCircleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(60,60,67,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  headerTitleCentered: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '700',
    color: '#222',
    letterSpacing: 0.1,
  },
  headerTitleCenteredAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '700',
    color: '#222',
    letterSpacing: 0.1,
    zIndex: 0,
  },
  topicsScroll: {
    backgroundColor: '#fff',
    minHeight: 44,
    maxHeight: 44,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 12, // add more space below the header line
  },
  topicsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 6,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    minWidth: 44,
    minHeight: 36,
    borderWidth: 1.2,
    justifyContent: 'center',
  },
  topicChipSelected: {
    backgroundColor: '#F5FAFF',
    borderColor: '#90C2FF',
    shadowColor: '#90C2FF',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  topicChipUnselected: {
    backgroundColor: '#fff',
    borderColor: '#E5EAF0',
  },
  topicChipText: {
    fontSize: 13,
    fontWeight: '400',
    marginLeft: 2,
    color: '#444',
    fontFamily: 'System',
  },
  topicChipTextSelected: {
    color: '#222',
    fontWeight: '400',
  },
  topicChipTextUnselected: {
    color: '#444',
    fontWeight: '400',
  },
  topicChipEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  topicChipEmojiSelected: {
    color: '#222',
  },
  topicChipEmojiUnselected: {
    color: '#444',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingBottom: 0,
    paddingTop: 0,
    backgroundColor: '#fff',
    minHeight: 40,
    maxHeight: 40,
    marginBottom: 18,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(60, 60, 67, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginRight: 0,
    minHeight: 36,
    maxHeight: 36,
  },
  filterButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 15,
    color: '#7A869A',
    fontWeight: '400',
    marginRight: 4,
  },
  filterButtonTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  filterButtonIcon: {
    marginLeft: 2,
    marginRight: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 14,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    position: 'relative',
    minHeight: 60,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
  },
  starButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
    zIndex: 2,
  },
  headerIconLeftAbsolute: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    height: 64,
    width: 40,
    zIndex: 2,
  },
  headerIconRightAbsolute: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    height: 64,
    width: 40,
    zIndex: 2,
  },
});
