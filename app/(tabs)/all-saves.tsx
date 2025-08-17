import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChatService from '../../services/chat';
import { cleanDisplayTitle } from '../../services/html-utils';

// Predefined tags for quick selection with emojis
const predefinedTags = [
  { name: 'Health', emoji: '🍃' },
  { name: 'Work', emoji: '💼' }, 
  { name: 'Fitness', emoji: '💪' },
  { name: 'Travel', emoji: '✈️' },
  { name: 'To Read', emoji: '📖' },
];

// Helper function to get emoji for a tag - both predefined and smart-generated
const getTagEmoji = (tagName: string): string => {
  // Check predefined tags first
  const predefinedTag = predefinedTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
  if (predefinedTag) {
    return predefinedTag.emoji;
  }
  
  // Smart emoji assignment for generated tags
  return getSmartTagEmoji(tagName);
};

// Smart emoji assignment based on tag content
const getSmartTagEmoji = (tagName: string): string => {
  const lowerTag = tagName.toLowerCase();
  
  // Technology & Programming
  if (lowerTag.match(/\b(technology|programming|development|coding|software|app|tech|digital|automation|ai|artificial|machine|algorithm|data|analytics|startup|innovation|react|javascript|python|github|opensource|tutorial|code)\b/)) {
    return '💻';
  }
  
  // Business & Finance
  if (lowerTag.match(/\b(business|finance|investment|portfolio|strategy|entrepreneur|marketing|sales|revenue|profit|economy|market|corporate|professional|career|jobsearch|interview|resume|linkedin)\b/)) {
    return '💼';
  }
  
  // Health & Medical
  if (lowerTag.match(/\b(health|medical|wellness|nutrition|diet|doctor|hospital|medicine|therapy|mental|psychology|healthcare)\b/)) {
    return '🏥';
  }
  
  // Education & Learning
  if (lowerTag.match(/\b(education|learning|study|course|tutorial|university|school|research|academic|knowledge|skill|training|guide|instruction|reference)\b/)) {
    return '📚';
  }
  
  // Science & Research
  if (lowerTag.match(/\b(science|research|experiment|discovery|analysis|physics|biology|chemistry|climate|environment|space|laboratory)\b/)) {
    return '🔬';
  }
  
  // Design & Creative
  if (lowerTag.match(/\b(design|creative|art|visual|graphics|aesthetic|photography|video|image|figma|dribbble|brand|logo)\b/)) {
    return '🎨';
  }
  
  // Productivity & Tools
  if (lowerTag.match(/\b(productivity|efficiency|workflow|organize|method|system|process|optimize|tool|notion)\b/)) {
    return '⚡';
  }
  
  // Communication & Social
  if (lowerTag.match(/\b(social|discussion|community|communication|message|chat|forum|twitter|reddit|conversation)\b/)) {
    return '💬';
  }
  
  // Travel & Places
  if (lowerTag.match(/\b(travel|trip|vacation|hotel|flight|booking|destination|explore|adventure|journey)\b/)) {
    return '✈️';
  }
  
  // Food & Cooking
  if (lowerTag.match(/\b(cooking|recipe|food|kitchen|meal|nutrition|restaurant|chef|ingredient)\b/)) {
    return '🍳';
  }
  
  // Sports & Fitness
  if (lowerTag.match(/\b(fitness|workout|exercise|gym|sport|training|athlete|running|yoga|health)\b/)) {
    return '💪';
  }
  
  // Entertainment & Media
  if (lowerTag.match(/\b(video|movie|entertainment|youtube|music|gaming|streaming|podcast|media|review)\b/)) {
    return '🎬';
  }
  
  // Documents & Files
  if (lowerTag.match(/\b(document|pdf|file|report|spreadsheet|presentation|manual|documentation)\b/)) {
    return '📄';
  }
  
  // News & Updates
  if (lowerTag.match(/\b(news|update|announcement|breaking|politics|current|events|journalism)\b/)) {
    return '📰';
  }
  
  // Shopping & Commerce
  if (lowerTag.match(/\b(shopping|purchase|product|review|ecommerce|retail|store|marketplace)\b/)) {
    return '🛒';
  }
  
  // Home & Lifestyle
  if (lowerTag.match(/\b(home|lifestyle|interior|furniture|garden|decoration|diy|organization)\b/)) {
    return '🏠';
  }
  
  // Photography & Visual
  if (lowerTag.match(/\b(photography|photo|visual|camera|image|picture|memories|gallery)\b/)) {
    return '📸';
  }
  
  // Money & Expenses
  if (lowerTag.match(/\b(finance|money|expense|budget|invoice|receipt|bill|payment|banking)\b/)) {
    return '💰';
  }
  
  // Nature & Environment
  if (lowerTag.match(/\b(nature|environment|climate|green|sustainability|eco|organic|planet)\b/)) {
    return '�';
  }
  
  // Transportation
  if (lowerTag.match(/\b(transport|car|vehicle|driving|traffic|uber|taxi|public|transit)\b/)) {
    return '🚗';
  }
  
  // Events & Calendar
  if (lowerTag.match(/\b(event|meeting|calendar|schedule|appointment|conference|webinar|seminar)\b/)) {
    return '📅';
  }
  
  // Books & Reading
  if (lowerTag.match(/\b(book|reading|literature|novel|author|publication|library|article|blog)\b/)) {
    return '📖';
  }
  
  // Security & Privacy
  if (lowerTag.match(/\b(security|privacy|password|encryption|safety|protection|cybersecurity)\b/)) {
    return '�';
  }
  
  // Communication Platforms
  if (lowerTag.match(/\b(email|message|communication|slack|teams|zoom|meeting|call)\b/)) {
    return '✉️';
  }
  
  // Goal-specific tags
  if (lowerTag.includes('goal') || lowerTag.includes('objective') || lowerTag.includes('target')) {
    return '🎯';
  }
  
  // Time-related tags
  if (lowerTag.includes('time') || lowerTag.includes('schedule') || lowerTag.includes('deadline')) {
    return '⏰';
  }
  
  // Location-based tags
  if (lowerTag.includes('location') || lowerTag.includes('place') || lowerTag.includes('address')) {
    return '📍';
  }
  
  // Tag based on common suffixes/patterns
  if (lowerTag.endsWith('ing') || lowerTag.includes('process')) {
    return '⚙️';
  }
  
  if (lowerTag.includes('quick') || lowerTag.includes('fast') || lowerTag.includes('rapid')) {
    return '⚡';
  }
  
  if (lowerTag.includes('important') || lowerTag.includes('urgent') || lowerTag.includes('priority')) {
    return '❗';
  }
  
  if (lowerTag.includes('idea') || lowerTag.includes('inspiration') || lowerTag.includes('creative')) {
    return '�';
  }
  
  if (lowerTag.includes('question') || lowerTag.includes('help') || lowerTag.includes('support')) {
    return '❓';
  }
  
  // Default emojis based on general categories
  if (lowerTag.length > 8) { // Longer, more specific terms
    return '🔖';
  }
  
  // Default fallback
  return '🏷️';
};

export default function AllSavesScreen() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showStarred, setShowStarred] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const params = useLocalSearchParams();
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string | null>(null);
  const [showAllItems, setShowAllItems] = useState(true);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isMediaTypeDropdownVisible, setIsMediaTypeDropdownVisible] = useState(false);
  
  // Filter state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContentType, setSelectedContentType] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  const [selectedFileSize, setSelectedFileSize] = useState<string>('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get all unique tags from materials - handle both array and string formats
  const allUniqueTags = Array.from(new Set(materials.flatMap(m => {
    if (!m.tags) return [];
    // Handle case where tags might be stored as a string
    if (typeof m.tags === 'string') {
      try {
        return JSON.parse(m.tags);
      } catch {
        return [m.tags]; // Single tag as string
      }
    }
    // Tags are already an array
    return Array.isArray(m.tags) ? m.tags : [];
  }))).filter(tag => tag !== 'starred');
  
  // Debug logging
  console.log('🏷️ All Saves Debug - Materials count:', materials.length);
  console.log('🏷️ Materials with tags:', materials.filter(m => m.tags && m.tags.length > 0).length);
  console.log('🏷️ Sample material tags:', materials.slice(0, 3).map(m => ({ id: m.id, tags: m.tags })));
  console.log('🏷️ All unique tags found:', allUniqueTags);

  // Filter functions
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const applyFilters = () => {
    // Apply content type filter
    if (selectedContentType !== 'all') {
      setMediaTypeFilter(selectedContentType);
      setShowAllItems(false);
    } else {
      setMediaTypeFilter(null);
      setShowAllItems(true);
    }
    
    // Apply starred filter
    setShowStarred(showStarredOnly);
    
    // Clear the old selectedTag since we're using the new tag system
    setSelectedTag(null);
    
    // Close modal
    setIsFilterModalVisible(false);
  };

  const resetFilters = () => {
    setSelectedTags([]);
    setSelectedContentType('all');
    setSelectedDateFilter('');
    setSelectedFileSize('');
    setShowStarredOnly(false);
    setShowAllTags(false);
    setMediaTypeFilter(null);
    setShowAllItems(true);
    setShowStarred(false);
    setSelectedTag(null);
  };

  const handleMediaTypeSelect = (mediaType: string) => {
    console.log('🎯 Media type selected:', mediaType);
    if (mediaType === 'all') {
      setMediaTypeFilter(null);
      setSelectedContentType('all');
    } else {
      setMediaTypeFilter(mediaType);
      setSelectedContentType(mediaType);
    }
    setIsMediaTypeDropdownVisible(false);
    console.log('🔍 Updated mediaTypeFilter to:', mediaType === 'all' ? null : mediaType);
  };

  const closeDropdown = () => {
    setIsMediaTypeDropdownVisible(false);
  };

  // Handle filter parameter from URL
  useEffect(() => {
    console.log('🔍 Current params.filter:', params.filter);
    console.log('🔍 All params:', params);
    if (params.filter) {
      const filter = params.filter as string;
      setMediaTypeFilter(filter);
      setShowAllItems(false);
      console.log('🔍 Setting media type filter:', filter);
    } else {
      // Reset filter when no filter parameter is present
      setMediaTypeFilter(null);
      setShowAllItems(true);
      console.log('🔍 Resetting media type filter');
    }
  }, [params.filter]);

  // Handle openFilter parameter to automatically open filter modal
  useEffect(() => {
    if (params.openFilter === 'true') {
      console.log('🔍 Opening filter modal from parameter');
      setIsFilterModalVisible(true);
    }
  }, [params.openFilter]);

  // Reset filter when screen is focused (to clear any persistent state)
  useFocusEffect(
    useCallback(() => {
      console.log('🔍 Screen focused, params.filter:', params.filter);
      // Always reset filter when screen is focused, unless there's an explicit filter parameter
      if (!params.filter) {
        setMediaTypeFilter(null);
        setShowAllItems(true);
        console.log('🔍 Resetting media type filter on focus');
      }
    }, [])
  );

  // Additional reset when component mounts
  useEffect(() => {
    console.log('🔍 Component mounted, params.filter:', params.filter);
    // Reset filter on mount if no filter parameter
    if (!params.filter) {
      setMediaTypeFilter(null);
      setShowAllItems(true);
      console.log('🔍 Resetting media type filter on mount');
    }
  }, []);

  // Force reset when navigating to this screen without filter
  useFocusEffect(
    useCallback(() => {
      // If we're navigating to this screen and there's no filter parameter, 
      // we should clear any existing filter state
      if (!params.filter) {
        setMediaTypeFilter(null);
        setShowAllItems(true);
        console.log('🔍 Force resetting media type filter - no filter in URL');
      }
    }, [params.filter])
  );

  // Aggressive reset - clear filter every time screen is focused without explicit filter
  useFocusEffect(
    useCallback(() => {
      // Clear filter state every time screen is focused, unless there's an explicit filter
      if (!params.filter) {
        setTimeout(() => {
          setMediaTypeFilter(null);
          setShowAllItems(true);
          console.log('🔍 Aggressive reset - cleared filter state');
        }, 100);
      }
    }, [])
  );

  // Refresh materials when screen comes into focus to sync starred status
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 All-saves screen focused, refreshing materials...');
      fetchMaterials();
    }, [])
  );

  // Fetch all user materials on mount and when screen is focused
  const fetchMaterials = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const chatService = ChatService.getInstance();
      console.log('🔄 Fetching messages for all-saves...');
      const msgs = await chatService.getMessagesWithContent(200); // Increased limit to get more data
      
      console.log(`📊 Fetched ${msgs.length} messages from database`);
      
      // Filter out bot messages and only include user content
      const userMessages = msgs.filter((msg: any) => !msg.is_bot && (msg.type === 'file' || msg.type === 'image' || msg.type === 'link'));
      console.log(`👤 Found ${userMessages.length} user content messages`);
      
      // Process messages to add proper preview images for links and starred status
      const processedMsgs = await Promise.all(
        userMessages.map(async (msg: any) => {
          // Ensure starred status is properly set from tags
          const isStarred = msg.tags?.includes('starred') || false;
          
          if (msg.type === 'link' && msg.file_url) {
            try {
              // Use cached preview data if available
              if (msg.preview_image && msg.preview_title) {
                return {
                  ...msg,
                  preview_image: msg.preview_image,
                  preview_title: msg.preview_title
                };
              }
              
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
      
      // Sort by creation date (newest first)
      const sortedMsgs = processedMsgs.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || a.timestamp);
        const dateB = new Date(b.created_at || b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log(`✅ Processed ${sortedMsgs.length} messages for display`);
      console.log('🏷️ Sample processed messages with tags:', sortedMsgs.slice(0, 3).map(m => ({ 
        id: m.id, 
        type: m.type, 
        tags: m.tags,
        content: m.content?.substring(0, 50) + '...'
      })));
      setMaterials(sortedMsgs);
      
      // Update starred IDs from the starred tags or starred property
      const starredMessages = sortedMsgs.filter((m: any) => {
        return m.starred || (m.tags && m.tags.includes('starred'));
      });
      setStarredIds(new Set(starredMessages.map((m: any) => m.id)));
      
      console.log(`⭐ Found ${starredMessages.length} starred messages`);
    } catch (e) {
      console.error('❌ Error fetching materials:', e);
      setMaterials([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Generate better link preview image based on domain (fallback function)
  const getLinkPreviewImage = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return `https://via.placeholder.com/400x300/808080/white?text=🔗+${encodeURIComponent(domain.substring(0, 15))}`;
    } catch {
      return 'https://via.placeholder.com/400x300/808080/white?text=��+Link';
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

  // Refresh data when screen comes into focus and reset filter if no explicit params
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 All-saves screen focused, refreshing data...');
      
      // Reset filter when focusing the screen via tab navigation (no filter params)
      if (!params.filter) {
        setMediaTypeFilter(null);
        setShowAllItems(true);
        console.log('🔍 Resetting media type filter on focus');
      }
      
      fetchMaterials();
    }, [params.filter])
  );

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    console.log('🔄 Pull-to-refresh triggered');
    fetchMaterials(true);
  }, []);

  // Filtered materials
  let filtered = materials.filter((m: any) =>
    (m.type === 'file' || m.type === 'image' || m.type === 'link') && !m.isBot
  );
  let filteredBeforeStarred = filtered;
  
  console.log('🔍 Current filter state:', {
    mediaTypeFilter,
    materialsCount: materials.length,
    initialFilteredCount: filtered.length,
    materialTypes: materials.map(m => m.type).filter((type, index, arr) => arr.indexOf(type) === index)
  });
  
  // Apply media type filter if set
  if (mediaTypeFilter && mediaTypeFilter !== 'all') {
    console.log('🔍 Applying filter - mediaTypeFilter:', mediaTypeFilter);
    const filterMap: { [key: string]: string } = {
      'image': 'image',
      'link': 'link', 
      'file': 'file',
      'video': 'video'
    };
    const targetType = filterMap[mediaTypeFilter.toLowerCase()];
    console.log('🔍 Filter mapping - input:', mediaTypeFilter, 'targetType:', targetType);
    if (targetType) {
      const beforeCount = filtered.length;
      filtered = filtered.filter((m: any) => m.type === targetType);
      filteredBeforeStarred = filtered;
      console.log(`🔍 Filtering by media type: ${mediaTypeFilter} -> ${targetType}, before: ${beforeCount}, after: ${filtered.length} items`);
      console.log('🔍 Filtered items:', filtered.map(m => ({ id: m.id, type: m.type, content: m.content?.substring(0, 30) })));
    }
  }
  
  // Apply selected topic tag filter (from horizontal chips)
  if (selectedTag) {
    filtered = filtered.filter((m: any) => {
      if (!m.tags) return false;
      // Handle both array and string formats
      let tags = m.tags;
      if (typeof tags === 'string') {
        try {
          tags = JSON.parse(tags);
        } catch {
          tags = [tags]; // Single tag as string
        }
      }
      return Array.isArray(tags) && tags.includes(selectedTag);
    });
    filteredBeforeStarred = filtered;
    console.log(`🔍 Filtering by selected topic tag: ${selectedTag}, found ${filtered.length} items`);
  }

  // Apply selected tags filter (from modal filters)
  if (selectedTags.length > 0) {
    filtered = filtered.filter((m: any) => {
      if (!m.tags) return false;
      // Handle both array and string formats
      let tags = m.tags;
      if (typeof tags === 'string') {
        try {
          tags = JSON.parse(tags);
        } catch {
          tags = [tags]; // Single tag as string
        }
      }
      return Array.isArray(tags) && selectedTags.some(tag => tags.includes(tag));
    });
    filteredBeforeStarred = filtered;
    console.log(`🔍 Filtering by selected tags: ${selectedTags.join(', ')}, found ${filtered.length} items`);
  }
  
  // Apply date filter
  if (selectedDateFilter) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    filtered = filtered.filter((m: any) => {
      const itemDate = new Date(m.created_at);
      switch (selectedDateFilter) {
        case 'today':
          return itemDate >= today;
        case 'week':
          return itemDate >= weekAgo;
        case 'month':
          return itemDate >= monthAgo;
        default:
          return true;
      }
    });
    filteredBeforeStarred = filtered;
    console.log(`🔍 Filtering by date: ${selectedDateFilter}, found ${filtered.length} items`);
  }
  
  // Apply file size filter (placeholder - would need actual file size data)
  if (selectedFileSize) {
    // This would need actual file size data from the backend
    // For now, we'll just log it
    console.log(`🔍 File size filter selected: ${selectedFileSize} (not implemented yet)`);
  }
  
  if (selectedTag) {
    filtered = filtered.filter((m: any) => m.tags && m.tags.includes(selectedTag));
    filteredBeforeStarred = filtered;
  }
  if (showStarred) {
    filtered = filtered.filter((m: any) => starredIds.has(m.id));
  }

  // Filter data
  const contentTypes = [
    { id: 'all', label: 'All Media', count: filteredBeforeStarred.length },
    { id: 'image', label: 'Images', count: materials.filter(m => m.type === 'image').length },
    { id: 'link', label: 'Links', count: materials.filter(m => m.type === 'link').length },
    { id: 'file', label: 'Docs', count: materials.filter(m => m.type === 'file').length },
    { id: 'video', label: 'Videos', count: materials.filter(m => m.type === 'video').length },
  ];

  const dateFilters = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Last 7 Days' },
    { id: 'month', label: 'Last Month' },
  ];

  const fileSizeFilters = [
    { id: 'small', label: 'Small (<5MB)' },
    { id: 'medium', label: 'Medium (5-50MB)' },
    { id: 'large', label: 'Large (>50MB)' },
  ];

  // Toggle star for a material
  const toggleStar = async (id: string) => {
    const wasStarred = starredIds.has(id);
    const willBeStarred = !wasStarred;
    
    // Update UI immediately for responsiveness
    setStarredIds(prev => {
      const newSet = new Set(prev);
      if (wasStarred) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    
    // Update local materials array immediately
    setMaterials(prev => prev.map(item => {
      if (item.id === id) {
        const updatedTags = item.tags ? [...item.tags] : [];
        if (willBeStarred && !updatedTags.includes('starred')) {
          updatedTags.push('starred');
        } else if (!willBeStarred && updatedTags.includes('starred')) {
          const starredIndex = updatedTags.indexOf('starred');
          updatedTags.splice(starredIndex, 1);
        }
        return { ...item, tags: updatedTags, starred: willBeStarred };
      }
      return item;
    }));
    
    // Persist to backend
    try {
      const chatService = ChatService.getInstance();
      await chatService.updateMessageStarred(id, willBeStarred);
      console.log(`⭐ Message ${id} starred status updated to: ${willBeStarred}`);
    } catch (e) {
      console.error('❌ Error updating starred status:', e);
      // Revert UI changes on error
      setStarredIds(prev => {
        const newSet = new Set(prev);
        if (willBeStarred) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
      
      // Revert materials array
      setMaterials(prev => prev.map(item => {
        if (item.id === id) {
          const updatedTags = item.tags ? [...item.tags] : [];
          if (!willBeStarred && !updatedTags.includes('starred')) {
            updatedTags.push('starred');
          } else if (willBeStarred && updatedTags.includes('starred')) {
            const starredIndex = updatedTags.indexOf('starred');
            updatedTags.splice(starredIndex, 1);
          }
          return { ...item, tags: updatedTags, starred: !willBeStarred };
        }
        return item;
      }));
    }
  };

  // Delete individual item
  const handleDeleteItem = (item: any) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const chatService = ChatService.getInstance();
              await chatService.deleteMessage(item.id);
              console.log('✅ Item deleted successfully');
              
              // Remove from local state
              setMaterials(prev => prev.filter(m => m.id !== item.id));
              setStarredIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(item.id);
                return newSet;
              });
            } catch (error) {
              console.error('❌ Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Share individual item
  const handleShareItem = async (item: any) => {
    try {
      let shareContent = '';
      let shareTitle = '';
      
      if (item.type === 'link') {
        shareTitle = cleanDisplayTitle(item.preview_title || item.content) || 'Shared link from Blii';
        shareContent = `${shareTitle}\n\n${item.file_url}`;
      } else if (item.type === 'file') {
        shareTitle = cleanDisplayTitle(item.filename || item.content) || 'Shared file from Blii';
        shareContent = `${shareTitle}\n\nShared from Blii`;
      } else if (item.type === 'image') {
        shareTitle = cleanDisplayTitle(item.filename || item.content) || 'Shared image from Blii';
        shareContent = shareTitle;
      } else {
        shareTitle = 'Shared from Blii';
        shareContent = item.content || shareTitle;
      }

      await Share.share({
        message: shareContent,
        title: shareTitle,
        url: item.type === 'link' ? item.file_url : undefined,
      });
    } catch (error) {
      console.error('❌ Error sharing item:', error);
      Alert.alert('Error', 'Failed to share item. Please try again.');
    }
  };

  // Delete all messages with confirmation
  const handleDeleteAllMessages = () => {
    Alert.alert(
      'Delete All Messages',
      'Are you sure you want to delete all your saved messages? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: deleteAllMessages,
        },
      ]
    );
  };

  const deleteAllMessages = async () => {
    setIsDeleting(true);
    try {
      const chatService = ChatService.getInstance();
      await chatService.deleteAllMessages();
      
      // Clear local state
      setMaterials([]);
      setStarredIds(new Set());
      
      console.log('🗑️ All messages deleted successfully');
      
      // Show success message
      Alert.alert('Success', 'All messages have been deleted.');
    } catch (error) {
      console.error('❌ Error deleting all messages:', error);
      Alert.alert('Error', 'Failed to delete messages. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      {/* Header - match Chat header style, but only search button and lower on screen */}
      <View style={styles.headerRowCustom}> 
        <TouchableOpacity style={styles.headerIconLeftAbsolute} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitleCenteredAbsolute}>
          {mediaTypeFilter ? `${mediaTypeFilter.charAt(0).toUpperCase() + mediaTypeFilter.slice(1)}` : 'All Saves'}
        </Text>
        <View style={styles.headerIconsRightAbsolute}>
          <TouchableOpacity style={styles.headerIconButton} onPress={handleDeleteAllMessages} disabled={isDeleting || materials.length === 0}>
            <Ionicons 
              name="trash-outline" 
              size={18} 
              color={materials.length === 0 ? '#CCC' : '#FF3B30'} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons name="search" size={18} color="#7A869A" />
          </TouchableOpacity>
        </View>
      </View>
      {/* Tag Chips - horizontal pill style, compact spacing */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicsScroll} contentContainerStyle={styles.topicsRow}>
        <TouchableOpacity
          style={[styles.topicChip, !selectedTag && styles.topicChipSelected]}
          onPress={() => setSelectedTag(null)}
        >
          <Text style={[styles.topicChipText, !selectedTag && styles.topicChipTextSelected]}>All</Text>
        </TouchableOpacity>
        {allUniqueTags.map((tag) => {
          const selected = selectedTag === tag;
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.topicChip, selected ? styles.topicChipSelected : styles.topicChipUnselected]}
              onPress={() => setSelectedTag(tag)}
              activeOpacity={0.85}
            >
              <Text style={[styles.topicChipEmoji, selected ? styles.topicChipEmojiSelected : styles.topicChipEmojiUnselected]}>{getTagEmoji(tag)}</Text>
              <Text style={[styles.topicChipText, selected ? styles.topicChipTextSelected : styles.topicChipTextUnselected]}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* Filters Row - exact pill style, flat, with precise spacing */}
      <View style={styles.filtersRow}>
        <TouchableOpacity 
          style={[styles.filterButton, !showStarred && styles.filterButtonSelected]} 
          onPress={() => setIsMediaTypeDropdownVisible(!isMediaTypeDropdownVisible)}
        >
          <Text style={[styles.filterButtonText, !showStarred && styles.filterButtonTextSelected]}>
            {mediaTypeFilter ? `${mediaTypeFilter.charAt(0).toUpperCase() + mediaTypeFilter.slice(1)}` : 'All Media'} ({filtered.length})
          </Text>
          <Ionicons 
            name={isMediaTypeDropdownVisible ? "chevron-up" : "chevron-down"} 
            size={16} 
            color={!showStarred ? '#fff' : '#7A869A'} 
            style={styles.filterButtonIcon} 
          />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterButton, showStarred && styles.filterButtonSelected]} onPress={() => setShowStarred(true)}>
          <Ionicons name={showStarred ? 'star' : 'star-outline'} size={16} color={showStarred ? '#fff' : '#7A869A'} style={styles.filterButtonIcon} />
          <Text style={[styles.filterButtonText, showStarred && styles.filterButtonTextSelected]}>Starred</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={() => setIsFilterModalVisible(true)}>
          <Ionicons name="options-outline" size={16} color="#7A869A" style={styles.filterButtonIcon} />
        </TouchableOpacity>
      </View>
      
      {/* Media Type Dropdown */}
      {isMediaTypeDropdownVisible && (
        <>
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={closeDropdown}
          />
          <View style={styles.dropdownContainer}>
            {contentTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.dropdownItem,
                  (mediaTypeFilter === type.id || (!mediaTypeFilter && type.id === 'all')) && styles.dropdownItemSelected
                ]}
                onPress={() => handleMediaTypeSelect(type.id)}
              >
                <Text style={[
                  styles.dropdownItemText,
                  (mediaTypeFilter === type.id || (!mediaTypeFilter && type.id === 'all')) && styles.dropdownItemTextSelected
                ]}>
                  {type.label} ({type.count})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      {/* Filter Status Indicator */}
      {mediaTypeFilter && (
        <View style={styles.filterStatusContainer}>
          <Text style={styles.filterStatusText}>
            Showing {filtered.length} of {materials.length} items
          </Text>
          <TouchableOpacity onPress={() => handleMediaTypeSelect('all')}>
            <Text style={styles.clearFilterText}>Clear Filter</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Saves List */}
      {loading || isDeleting ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
          {isDeleting && (
            <Text style={{ marginTop: 16, color: '#007AFF', fontSize: 16 }}>
              Deleting all messages...
            </Text>
          )}
        </View>
      ) : (
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24, marginTop: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
              title="Pull to refresh"
              titleColor="#007AFF"
            />
          }
        >
          {filtered.map((item: any) => {
            // Determine the image to show
            let imageUrl = '';
            let title = '';
            
            if (item.type === 'image' && item.file_url) {
              imageUrl = item.file_url;
              title = item.filename || item.content;
            } else if (item.type === 'file' && item.filename) {
              // Check if it's a PDF with a preview image
              if (item.filename.toLowerCase().endsWith('.pdf') && (item as any).preview_image) {
                imageUrl = (item as any).preview_image;
              } else {
                imageUrl = getFileTypeImage(item.filename);
              }
              title = item.filename || item.content;
            } else if (item.type === 'link') {
              imageUrl = item.preview_image || getLinkPreviewImage(item.file_url || '');
              // Prioritize extracted title over preview title for better accuracy
              title = item.extracted_title || item.preview_title || item.content;
            } else {
              title = item.content || item.filename || 'Untitled';
            }

            return (
              <View key={item.id} style={styles.card}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.cardImage} />
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  {item.type === 'link' && <Image source={require('../../assets/images/link-2.png')} style={{ width: 16, height: 16, marginRight: 6, marginTop: 2, resizeMode: 'contain' }} />}
                  {item.type === 'file' && <Image source={require('../../assets/images/PDF.png')} style={{ width: 16, height: 16, marginRight: 6, marginTop: 2, resizeMode: 'contain' }} />}
                  {item.type === 'link' ? (
                    <TouchableOpacity onPress={() => Linking.openURL(item.file_url || '')}>
                      <Text style={[styles.cardTitle, styles.linkTitle]} numberOfLines={2}>{cleanDisplayTitle(title)}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.cardTitle} numberOfLines={2}>{cleanDisplayTitle(title)}</Text>
                  )}
                </View>
                {/* Action buttons container */}
                <View style={styles.actionButtonsRow}>
                  {/* Star button */}
                  <TouchableOpacity
                    style={styles.actionButtonSmall}
                    onPress={() => toggleStar(item.id)}
                  >
                    <Ionicons
                      name={starredIds.has(item.id) ? 'star' : 'star-outline'}
                      size={18}
                      color={starredIds.has(item.id) ? '#FFD700' : '#B0B0B0'}
                    />
                  </TouchableOpacity>
                  
                  {/* Share button */}
                  <TouchableOpacity
                    style={styles.actionButtonSmall}
                    onPress={() => handleShareItem(item)}
                  >
                    <Ionicons
                      name="share-outline"
                      size={18}
                      color="#007AFF"
                    />
                  </TouchableOpacity>
                  
                  {/* Delete button */}
                  <TouchableOpacity
                    style={styles.actionButtonSmall}
                    onPress={() => handleDeleteItem(item)}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#FF3B30"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {filtered.length === 0 && !loading && (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 }}>
              <Ionicons name="folder-open-outline" size={64} color="#ccc" />
              <Text style={{ color: '#888', textAlign: 'center', marginTop: 16, fontSize: 16 }}>
                {materials.length === 0 
                  ? 'No saved content yet'
                  : selectedTag 
                    ? `No content tagged with "${selectedTag}"`
                    : showStarred 
                      ? 'No starred content'
                      : 'No content found'
                }
              </Text>
              {materials.length === 0 && (
                <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 8, fontSize: 14 }}>
                  Save images, links, and documents in chat to see them here
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Filter Modal */}
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setIsFilterModalVisible(false)}
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalDragHandle} />
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>Filters</Text>
                <TouchableOpacity style={styles.modalDoneButton} onPress={applyFilters}>
                  <Image source={require('../../assets/images/tick-circle.png')} style={{ width: 30, height: 30, flexShrink: 0 }} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Tags Section */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Tags</Text>
                <View style={styles.tagsContainer}>
                  {(showAllTags ? allUniqueTags : allUniqueTags.slice(0, 6)).map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.filterChip,
                        selectedTags.includes(tag) && styles.filterChipSelected
                      ]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text style={styles.filterChipEmoji}>{getTagEmoji(tag)}</Text>
                      <Text style={[
                        styles.filterChipText,
                        selectedTags.includes(tag) && styles.filterChipTextSelected
                      ]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {allUniqueTags.length > 6 && (
                  <TouchableOpacity 
                    style={styles.seeAllButton} 
                    onPress={() => setShowAllTags(!showAllTags)}
                  >
                    <Text style={styles.seeAllText}>
                      {showAllTags ? 'Show less' : `See all (${allUniqueTags.length})`}
                    </Text>
                    <Ionicons 
                      name={showAllTags ? "chevron-up" : "chevron-down"} 
                      size={16} 
                      color="#007AFF" 
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Content Type Section */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Content Type</Text>
                <View style={styles.contentTypeContainer}>
                  {contentTypes.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.filterChip,
                        selectedContentType === type.id && styles.filterChipSelected
                      ]}
                      onPress={() => setSelectedContentType(type.id)}
                    >
                      <Text style={[
                        styles.filterChipText,
                        selectedContentType === type.id && styles.filterChipTextSelected
                      ]}>
                        {type.label} ({type.count})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Date Section */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Date</Text>
                <View style={styles.dateContainer}>
                  {dateFilters.map((filter) => (
                    <TouchableOpacity
                      key={filter.id}
                      style={[
                        styles.filterChip,
                        selectedDateFilter === filter.id && styles.filterChipSelected
                      ]}
                      onPress={() => setSelectedDateFilter(filter.id)}
                    >
                      <Text style={[
                        styles.filterChipText,
                        selectedDateFilter === filter.id && styles.filterChipTextSelected
                      ]}>
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* File Size Section */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>File Size</Text>
                <View style={styles.fileSizeContainer}>
                  {fileSizeFilters.map((filter) => (
                    <TouchableOpacity
                      key={filter.id}
                      style={[
                        styles.filterChip,
                        selectedFileSize === filter.id && styles.filterChipSelected
                      ]}
                      onPress={() => setSelectedFileSize(filter.id)}
                    >
                      <Text style={[
                        styles.filterChipText,
                        selectedFileSize === filter.id && styles.filterChipTextSelected
                      ]}>
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Starred Section */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Starred</Text>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    showStarredOnly && styles.filterChipSelected
                  ]}
                  onPress={() => setShowStarredOnly(!showStarredOnly)}
                >
                  <Ionicons 
                    name={showStarredOnly ? 'star' : 'star-outline'} 
                    size={16} 
                    color={showStarredOnly ? '#fff' : '#7A869A'} 
                    style={styles.filterChipIcon}
                  />
                  <Text style={[
                    styles.filterChipText,
                    showStarredOnly && styles.filterChipTextSelected
                  ]}>
                    Starred Messages
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Reset Button */}
              <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                <Text style={styles.resetButtonText}>Reset All Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    lineHeight: 22,
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
    display: 'flex',
    padding: 6,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: '#FDFDFD',
    marginBottom: 14,
    shadowColor: 'rgba(0, 15, 175, 0.04)',
    shadowOffset: {
      width: 0,
      height: 1.5,
    },
    shadowOpacity: 1,
    shadowRadius: 6,
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
    flex: 1,
    color: '#3E3E3E',
    fontSize: 15,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.23,
  },
  linkTitle: {
    textDecorationLine: 'underline',
    color: '#007AFF',
  },
  starButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
    zIndex: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  actionButtonSmall: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
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
  headerIconsRightAbsolute: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    zIndex: 2,
  },
  headerIconButton: {
    padding: 8,
    marginLeft: 4,
  },
  modalContainer: {
    width: '100%',
    height: 600,
    flexShrink: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: '#FAFAFC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 100,
    elevation: 5,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  modalHeader: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 10,
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: {
    color: '#000',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
    marginBottom: 36.5,
  },
  modalDoneButton: {
    padding: 5,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    color: '#6C6C6C',
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99C1FE',
    backgroundColor: '#FFFFFF',
  },
  filterChipSelected: {
    backgroundColor: '#EBF3FF',
    borderColor: '#99C1FE',
  },
  filterChipEmoji: {
    fontSize: 14,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#99C1FE',
  },
  filterChipTextSelected: {
    color: '#007AFF',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginRight: 5,
  },
  contentTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fileSizeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChipIcon: {
    marginRight: 8,
  },
  resetButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  resetButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  // Dropdown styles
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#f8f9fa',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  dropdownItemTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  filterStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterStatusText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  clearFilterText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
