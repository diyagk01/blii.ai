import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import EdgeCaseMessageComponent from '../components/EdgeCaseMessage';
import ChatService from '../services/chat';
import EdgeCaseMessagingService, { EdgeCaseAction } from '../services/edge-case-messaging';
import { cleanDisplayTitle } from '../services/html-utils';

const SearchScreen = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [smartPrompts, setSmartPrompts] = useState<string[]>([
    "What do I have saved about travel?",
    "Show me my content about technology",
    "Find my documents about work projects"
  ]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const edgeCaseService = EdgeCaseMessagingService.getInstance();

  const loadSmartPrompts = async () => {
    try {
      setLoadingPrompts(true);
      console.log('🧠 Loading smart prompts for search...');
      
      // Generate content-search specific prompts
      const searchPrompts = [
        "What do I have saved about travel?",
        "Show me my content about technology", 
        "Find my documents about work projects",
        "What articles did I save about AI?",
        "Show me my saved content about health",
        "Find my files about business"
      ];
      
      // Randomly select 3 prompts
      const shuffled = searchPrompts.sort(() => 0.5 - Math.random());
      const selectedPrompts = shuffled.slice(0, 3);
      
      setSmartPrompts(selectedPrompts);
      console.log('✅ Smart search prompts loaded:', selectedPrompts);
    } catch (error) {
      console.error('❌ Error loading smart prompts for search:', error);
      // Keep existing fallback prompts
    } finally {
      setLoadingPrompts(false);
    }
  };

  const loadAndFilterContent = async (query: string = '') => {
    // If no query, don't show results
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      // Use natural language search for comprehensive results
      const searchResult = await ChatService.getInstance().searchContentWithNaturalLanguage(query);
      
      console.log('🔍 Search results:', {
        totalResults: searchResult.results.length,
        keywords: searchResult.keywords,
        summary: searchResult.searchSummary
      });
      
      // Filter for displayable items (images, files, links, and text with extracted content)
      let mediaItems = searchResult.results.filter(msg => {
        return (msg.type === 'image' && msg.file_url) ||
               (msg.type === 'file' && msg.file_url) ||
               (msg.type === 'link' && (msg.file_url || msg.content.includes('http'))) ||
               // Include text messages that might contain relevant content or references
               (msg.type === 'text' && (msg.extracted_text || msg.ai_analysis || msg.content_insights));
      });

      // Process uploads to create display data (exact same as home page)
      const uploads = await Promise.all(
        mediaItems.map(async (msg) => {
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
                  
                  console.log('✅ Generated link preview for search:', {
                    url: msg.file_url,
                    title: previewData.title,
                    hasImage: !!previewData.image
                  });
                } catch (error) {
                  console.error('❌ Failed to generate link preview for search:', error);
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
              content: msg.content,
              // Add extracted content for better search context
              extracted_title: msg.extracted_title,
              extracted_excerpt: msg.extracted_excerpt,
              extracted_author: msg.extracted_author,
              word_count: msg.word_count,
              content_category: msg.content_category,
              originalMessage: msg, // Keep original message for edge case detection
              hasEdgeCase: edgeCaseService.hasEdgeCase(msg),
              edgeCase: edgeCaseService.detectEdgeCase(msg) ? edgeCaseService.getEdgeCaseMessage(edgeCaseService.detectEdgeCase(msg)!) : null
            };
          })
      );

      setSearchResults(uploads);
    } catch (error) {
      console.error('❌ Error performing search:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const performSearch = async (query: string) => {
    await loadAndFilterContent(query);
  };

  const handleSearch = () => {
    performSearch(searchQuery);
  };

  const handleSuggestedAction = (prompt: string) => {
    setSearchQuery(prompt);
    // Navigate to chat with the prompt as initial message
    router.replace({
      pathname: '/chat',
      params: { initialMessage: prompt }
    });
  };

  const handleEdgeCaseAction = (action: EdgeCaseAction, messageId: string) => {
    console.log('🎯 Edge case action triggered:', action.type, 'for message:', messageId);
    
    switch (action.type) {
      case 'note':
        // Navigate to chat with prompt to add note
        router.push({
          pathname: '/chat',
          params: { 
            initialMessage: `Add note to this item`,
            focusedMessageId: messageId
          }
        });
        break;
        
      case 'tag':
        // Navigate to chat with prompt to add tags
        router.push({
          pathname: '/chat',
          params: { 
            initialMessage: `Tag this item`,
            focusedMessageId: messageId
          }
        });
        break;
        
      case 'reminder':
        // Navigate to chat with prompt to set reminder
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
        // Find the result and navigate to media preview
        const result = searchResults.find(r => r.id === messageId);
        if (result) {
          const queryParams = new URLSearchParams({
            type: result.type || 'unknown',
            title: result.title || '',
            content: result.content || '',
            url: result.file_url || '',
            imageUrl: result.image || '',
            summary: '',
            id: result.id || '',
          }).toString();
          router.push(`/media-preview?${queryParams}`);
        }
        break;
        
      case 'organize':
        // Navigate to chat with organization prompt
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

  const toggleFilter = (filterName: string) => {
    // Navigate to all-saves with the filter parameter
    router.push(`/(tabs)/all-saves?filter=${filterName.toLowerCase()}`);
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

  useEffect(() => {
    loadSmartPrompts();
  }, []);

  useEffect(() => {
    // Perform search/filter when query or filters change (debounced)
    const timeoutId = setTimeout(() => {
      loadAndFilterContent(searchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const filters = [
    { name: "Starred", icon: "star" },
    { name: "Images", icon: "image" },
    { name: "Links", icon: "link" },
    { name: "Docs", icon: "document" },
    { name: "Videos", icon: "videocam" }
  ];

  return (
    <SafeAreaView style={styles.container}>

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <TouchableOpacity style={styles.backArrow} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="What do I have saved about..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            autoFocus
          />
        </View>
      </View>

      {!hasSearched ? (
        <>
          {/* Suggested Actions */}
          <View style={styles.suggestedActionsContainer}>
            {loadingPrompts ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading smart prompts...</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }} contentContainerStyle={{ gap: 16 }}>
                {smartPrompts.map((prompt: string, index: number) => (
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
                    onPress={() => handleSuggestedAction(prompt)}
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
            )}
          </View>

          {/* Filters */}
          <View style={styles.filtersContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {filters.map((filter, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.filterButton}
                    onPress={() => toggleFilter(filter.name)}
                  >
                    <Ionicons 
                      name={filter.icon as any} 
                      size={16} 
                      color="#007AFF" 
                    />
                    <Text style={styles.filterText}>{filter.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
          </View>
        </>
      ) : (
        /* Search Results */
        <View style={styles.searchResultsContainer}>
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <ScrollView 
              style={styles.resultsScrollView}
              contentContainerStyle={styles.resultsContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.resultsGrid}>
                {searchResults.map((save, idx) => (
                  <View key={save.id} style={styles.resultItem}>
                    <TouchableOpacity
                      style={styles.gridCard}
                      onPress={() => {
                        const queryParams = new URLSearchParams({
                          type: save.type || 'unknown',
                          title: save.title || '',
                          content: save.content || '',
                          url: save.file_url || '',
                          imageUrl: save.image || '',
                          summary: '',
                          id: save.id || '',
                        }).toString();
                        router.push(`/media-preview?${queryParams}`);
                      }}
                    >
                      {save.type === 'image' ? (
                        <Image source={{ uri: save.image }} style={{ width: '100%', height: '100%', borderRadius: 12, resizeMode: 'cover' }} />
                      ) : (
                        <>
                          <Image source={{ uri: save.image }} style={{ width: '100%', height: 90, borderTopLeftRadius: 12, borderTopRightRadius: 12 }} />
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
                            {/* Show excerpt if available */}
                            {save.extracted_excerpt && (
                              <Text style={{ 
                                fontSize: 10, 
                                color: '#666', 
                                fontFamily: 'SF Pro', 
                                lineHeight: 14, 
                                marginTop: 4
                              }} numberOfLines={2}>{save.extracted_excerpt}</Text>
                            )}
                            {/* Show word count and category if available */}
                            {(save.word_count || save.content_category) && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                                {save.word_count && (
                                  <Text style={{ fontSize: 9, color: '#999', fontFamily: 'SF Pro' }}>
                                    {save.word_count.toLocaleString()} words
                                  </Text>
                                )}
                                {save.content_category && (
                                  <Text style={{ 
                                    fontSize: 9, 
                                    color: '#007AFF', 
                                    fontFamily: 'SF Pro',
                                    backgroundColor: '#F0F8FF',
                                    paddingHorizontal: 4,
                                    paddingVertical: 2,
                                    borderRadius: 4
                                  }}>
                                    {save.content_category}
                                  </Text>
                                )}
                              </View>
                            )}
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    {/* Edge Case Message */}
                    {save.hasEdgeCase && save.edgeCase && (
                      <EdgeCaseMessageComponent
                        edgeCase={save.edgeCase}
                        onActionPress={(action) => handleEdgeCaseAction(action, save.id)}
                        style={styles.edgeCaseMessage}
                      />
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            /* No Results State */
            <View style={styles.noResultsContainer}>
              <View style={styles.loadingIndicator} />
              <Text style={styles.noResultsTitle}>Oops, nothing found!</Text>
              <Text style={styles.noResultsSubtitle}>
                Save it now so it's here next time.
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backArrow: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 8,
  },
  suggestedActionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 10,
  },

  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingIndicator: {
    width: 40,
    height: 2,
    backgroundColor: '#007AFF',
    borderRadius: 1,
    marginBottom: 20,
  },
  noResultsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  noResultsSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resultsScrollView: {
    flex: 1,
  },
  resultsContent: {
    paddingBottom: 20,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  resultItem: {
    width: '48%',
    marginBottom: 16,
  },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    overflow: 'hidden',
  },
  edgeCaseMessage: {
    marginTop: 8,
    marginHorizontal: 0,
  },
});

export default SearchScreen;
