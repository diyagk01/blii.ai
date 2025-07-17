import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing, Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView as RNSafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView as SafeAreaContextView } from 'react-native-safe-area-context';
import ChatService from '../services/chat';
import OpenAIService from '../services/openai';

interface Message {
  id: number;
  content: string;
  type: 'text' | 'image' | 'file' | 'link';
  timestamp: string;
  isBot: boolean;
  url?: string;
  filename?: string;
  tags?: string[];
  // Link preview data
  linkPreview?: {
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
  };
}

const ChatScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const chatService = ChatService.getInstance();
  const openAIService = OpenAIService.getInstance();
  
  // Tag modal state
  const [showTagModal, setShowTagModal] = useState(false);
  const [currentTagInput, setCurrentTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [pendingMessage, setPendingMessage] = useState<Partial<Message> | null>(null);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // AI functionality state
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  // Link preview state
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [currentLinkPreview, setCurrentLinkPreview] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  // Animation values for each message
  const messageAnimations = useRef<{ [key: number]: Animated.Value }>({});
  
  // Unique ID generator
  const messageIdCounter = useRef(1000);
  const generateUniqueId = () => {
    return messageIdCounter.current++;
  };

  // Link detection regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Detect if message contains a URL
  const detectLinks = (text: string): string[] => {
    const matches = text.match(urlRegex);
    return matches || [];
  };

  // Auto-generate link preview as user types (debounced)
  const linkPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    // Clear existing timeout
    if (linkPreviewTimeoutRef.current) {
      clearTimeout(linkPreviewTimeoutRef.current);
    }

    // Check if input contains a link
    const links = detectLinks(inputText);
    
    if (links.length > 0) {
      const url = links[0];
      
      // Only generate preview if URL has changed
      if (url !== previewUrl) {
        setPreviewUrl(url);
        setCurrentLinkPreview(null); // Clear previous preview
        
        // Debounce preview generation (wait 1 second after user stops typing)
        linkPreviewTimeoutRef.current = setTimeout(async () => {
          setLinkPreviewLoading(true);
          try {
            console.log('🔗 Auto-generating preview for:', url);
            const preview = await fetchLinkPreview(url);
            setCurrentLinkPreview(preview);
            console.log('✅ Auto-preview generated');
          } catch (error) {
            console.error('❌ Auto-preview failed:', error);
            setCurrentLinkPreview(null);
          } finally {
            setLinkPreviewLoading(false);
          }
        }, 1000);
      }
    } else {
      // No links found, clear preview
      setPreviewUrl('');
      setCurrentLinkPreview(null);
      setLinkPreviewLoading(false);
    }

    // Cleanup timeout on unmount
    return () => {
      if (linkPreviewTimeoutRef.current) {
        clearTimeout(linkPreviewTimeoutRef.current);
      }
    };
  }, [inputText]);

  // Fetch link preview metadata using enhanced LinkPreviewService
  const fetchLinkPreview = async (url: string) => {
    try {
      console.log('🔗 Fetching enhanced link preview for:', url);
      
      // Import the enhanced LinkPreviewService
      const LinkPreviewService = await import('../services/link-preview');
      const linkPreviewService = LinkPreviewService.default.getInstance();
      
      // Use the enhanced service to generate preview following WhatsApp specs
      const previewData = await linkPreviewService.generatePreview(url);
      
      // Convert to the format expected by the UI
      const preview = {
        title: previewData.title,
        description: previewData.description,
        domain: previewData.domain,
        image: previewData.image,
        keyPoints: [], // Enhanced service doesn't provide keyPoints in the same format
        author: previewData.author,
        publishDate: previewData.publishedTime,
        contentType: previewData.type || 'other'
      };

      console.log('✅ Enhanced link preview generated:', {
        title: preview.title,
        description: preview.description,
        domain: preview.domain,
        contentType: preview.contentType,
        hasImage: !!preview.image
      });

      return preview;
    } catch (error) {
      console.error('❌ Error fetching enhanced link preview:', error);
      
      // Fallback to basic preview
      const domain = new URL(url).hostname?.replace('www.', '') || 'unknown';
      return {
        title: `Link from ${domain}`,
        description: 'Content preview unavailable',
        domain: domain,
        image: 'https://via.placeholder.com/400x300/666/white?text=🔗+Link',
        keyPoints: [],
        contentType: 'other'
      };
    }
  };

  // Generate preview image based on content type
  const generatePreviewImage = (type: string, domain: string): string => {
    const colors = {
      article: '4285f4',
      video: 'FF0000', 
      document: '34A853',
      social: '1da1f2',
      other: '666666'
    };
    
    const icons = {
      article: '📰',
      video: '▶',
      document: '📄',
      social: '💬',
      other: '🔗'
    };
    
    const color = colors[type as keyof typeof colors] || colors.other;
    const icon = icons[type as keyof typeof icons] || icons.other;
    
    return `https://via.placeholder.com/400x300/${color}/white?text=${icon}+${domain}`;
  };

  // Helper function to get current timestamp
  const getCurrentTimestamp = (): string => {
    return new Date().toLocaleTimeString('en-US', { 
      hour12: true, 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  // Predefined tags for quick selection
  const predefinedTags = [
    'Work', 'Personal', 'Important', 'Todo', 'Reference', 
    'Ideas', 'Meeting', 'Project', 'Reminder', 'Document'
  ];

  const getInitialMessages = (): Message[] => [
    {
      id: 1,
      content: "Hi there! 👋",
      type: 'text',
      timestamp: getCurrentTimestamp(),
      isBot: true,
    },
    {
      id: 2,
      content: "Drop links, images, videos, documents or anything you want to keep.",
      type: 'text',
      timestamp: getCurrentTimestamp(),
      isBot: true,
    },
    {
      id: 3,
      content: "I'll save it and make it easy to find later.",
      type: 'text',
      timestamp: getCurrentTimestamp(),
      isBot: true,
    },
    {
      id: 4,
      content: "Go ahead and send your first message!",
      type: 'text',
      timestamp: getCurrentTimestamp(),
      isBot: true,
    },
  ];

  // Load messages from database on component mount
  useEffect(() => {
    loadMessages();
  }, []);

  // Handle initial message from navigation params
  useEffect(() => {
    if (params.initialMessage && typeof params.initialMessage === 'string') {
      // Wait a bit for the component to be fully loaded
      setTimeout(() => {
        setInputText(params.initialMessage as string);
        // Auto-send the message after a short delay
        setTimeout(() => {
          handleSendInitialMessage(params.initialMessage as string);
        }, 500);
      }, 1000);
    }
  }, [params.initialMessage]);

  // Special handler for initial messages to avoid conflicts with regular handleSend
  const handleSendInitialMessage = async (message: string) => {
    if (!message.trim()) return;

    // Clear input immediately
    setInputText('');

    // Create and send the message
    const localMessage: Message = {
      id: generateUniqueId(),
      content: message,
      type: 'text',
      timestamp: getCurrentTimestamp(),
      isBot: false,
    };

    // Add message to local state immediately
    setMessages(prev => [...prev, localMessage]);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Save to Supabase
      await chatService.sendTextMessage(message);
      console.log('Initial message saved to Supabase');
      
      // Always generate AI response for dynamic questions since AI mode is the purpose
      setAiLoading(true);
      try {
        // Generate enhanced AI response with database context
        const aiResponse = await openAIService.generateResponseWithDatabaseContext(message);
        
        // Create AI message for UI
        const aiMessage: Message = {
          id: generateUniqueId(),
          content: aiResponse,
          type: 'text',
          timestamp: getCurrentTimestamp(),
          isBot: true,
        };
        
        // Add AI message to UI
        setMessages(prev => [...prev, aiMessage]);
        
        // Save AI response to database
        await openAIService.sendAIResponse(message);
        
        // Scroll to show AI response
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 300);
        
        console.log('🧠 AI response to dynamic question generated');
      } catch (aiError) {
        console.error('Error generating AI response to initial message:', aiError);
        const fallbackMessage: Message = {
          id: generateUniqueId(),
          content: "Sorry, I'm having trouble processing that question right now. Please try again.",
          type: 'text',
          timestamp: getCurrentTimestamp(),
          isBot: true,
        };
        setMessages(prev => [...prev, fallbackMessage]);
      } finally {
        setAiLoading(false);
      }
    } catch (error) {
      console.error('Error saving initial message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== localMessage.id));
      setAiLoading(false);
    }
  };

  // Load messages from database
  const loadMessages = async () => {
    try {
      console.log('Loading messages from Supabase...');
      const dbMessages = await chatService.getUserMessages();
      
      if (dbMessages.length > 0) {
        // Convert database messages to local format with unique IDs
        const localMessages = dbMessages.map((msg, index) => ({
          ...chatService.convertToLocalMessage(msg),
          id: generateUniqueId(), // Ensure unique ID
        }));
        
        setMessages(localMessages);
        
        // Generate link previews for link messages
        localMessages.forEach(async (message) => {
          if (message.type === 'link' && message.url && !message.linkPreview) {
            try {
              const preview = await fetchLinkPreview(message.url);
              setMessages(prev => prev.map(msg => 
                msg.id === message.id 
                  ? { ...msg, linkPreview: preview }
                  : msg
              ));
            } catch (error) {
              console.error('Error generating link preview:', error);
            }
          }
        });
        
        // Scroll to bottom after loading
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 500);
      } else {
        // Show welcome messages if no messages in database
        showMessagesSequentially();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      // Show welcome messages on error
      showMessagesSequentially();
    }
  };

  // Simple scroll to bottom function
  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const showMessagesSequentially = () => {
    const initialMessages = getInitialMessages();
    initialMessages.forEach((message: Message, index: number) => {
      // Create animation value for this message
      messageAnimations.current[message.id] = new Animated.Value(0);
      
      setTimeout(() => {
        // Add message to state
        setMessages(prev => [...prev, message]);
        
        // Animate message appearance
        Animated.timing(messageAnimations.current[message.id], {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();

        // Scroll to bottom after message appears with longer delay
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 300);
      }, (index + 1) * 1500); // 1.5 second delay between messages
    });
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    // Detect if message contains links
    const links = detectLinks(inputText.trim());
    
    if (links.length > 0) {
      // Handle as link message - show tag modal like images/files
      const url = links[0]; // Use first link found
      
      try {
        // Generate preview first
        const preview = await fetchLinkPreview(url);
        
        // Create pending message for tagging
        const newMessage: Partial<Message> = {
          id: generateUniqueId(),
          content: inputText,
          type: 'link',
          timestamp: getCurrentTimestamp(),
          isBot: false,
          url: url,
          linkPreview: preview,
        };

        setPendingMessage(newMessage);
        setShowTagModal(true);
        setInputText(''); // Clear input when showing modal
      } catch (error) {
        console.error('Error generating link preview:', error);
        Alert.alert('Error', 'Failed to process link. Please try again.');
      }
    } else {
      // Handle as regular text message
      const localMessage: Message = {
        id: generateUniqueId(),
        content: inputText,
        type: 'text',
        timestamp: getCurrentTimestamp(),
        isBot: false,
      };

      // Add message to local state immediately for responsive UI
      setMessages(prev => [...prev, localMessage]);
      setInputText('');

      // Always scroll to bottom when user sends a message
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      try {
        // Save to Supabase
        await chatService.sendTextMessage(inputText);
        console.log('Text message saved to Supabase');
        
        // Generate AI response if AI mode is enabled
        if (aiMode) {
          setAiLoading(true);
          try {
            // Show extraction stats for debugging
            const stats = chatService.getExtractionStats();
            console.log('📊 Content extraction stats:', stats);
            
            // Generate enhanced AI response with full database context
            const aiResponse = await openAIService.generateResponseWithDatabaseContext(inputText);
            
            // Create AI message for UI
            const aiMessage: Message = {
              id: generateUniqueId(),
              content: aiResponse,
              type: 'text',
              timestamp: getCurrentTimestamp(),
              isBot: true,
            };
            
            // Add AI message to UI
            setMessages(prev => [...prev, aiMessage]);
            
            // Save AI response to database
            await openAIService.sendAIResponse(inputText);
            
            // Scroll to show AI response
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 300);
            
            console.log('🧠 Enhanced AI response with database context generated and saved');
          } catch (aiError) {
            console.error('Error generating AI response:', aiError);
            // Show a fallback message
            const fallbackMessage: Message = {
              id: generateUniqueId(),
              content: "Sorry, I'm having trouble accessing your content database right now. Please try again later.",
              type: 'text',
              timestamp: getCurrentTimestamp(),
              isBot: true,
            };
            setMessages(prev => [...prev, fallbackMessage]);
          } finally {
            setAiLoading(false);
          }
        }
      } catch (error) {
        console.error('Error saving text message:', error);
        Alert.alert('Error', 'Failed to save message. Please try again.');
        
        // Remove message from UI on error
        setMessages(prev => prev.filter(msg => msg.id !== localMessage.id));
        setAiLoading(false);
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8, // Reduce quality to ensure smaller file size
      exif: false, // Don't include EXIF data
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      try {
        setUploading(true);
        const asset = result.assets[0];
        
        // Generate a proper filename with the correct extension
        const timestamp = Date.now();
        const extension = asset.uri.split('.').pop() || 'jpg';
        const filename = `image_${timestamp}.${extension}`;
        
        console.log('Picked image:', { 
          uri: asset.uri, 
          filename, 
          type: asset.type,
          width: asset.width,
          height: asset.height
        });
        
        // Create pending message for tagging
        const newMessage: Partial<Message> = {
          id: generateUniqueId(),
          content: 'Image shared',
          type: 'image',
          timestamp: getCurrentTimestamp(),
          isBot: false,
          url: asset.uri,
        };

        setPendingMessage(newMessage);
        setShowTagModal(true);
      } catch (error) {
        console.error('Error processing image:', error);
        Alert.alert('Error', 'Failed to process image');
        setUploading(false);
      }
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setUploading(true);
        const asset = result.assets[0];

        // Create pending message for tagging
        const newMessage: Partial<Message> = {
          id: generateUniqueId(),
          content: 'Document shared',
          type: 'file',
          timestamp: getCurrentTimestamp(),
          isBot: false,
          url: asset.uri,
          filename: asset.name,
        };

        setPendingMessage(newMessage);
        setShowTagModal(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
      setUploading(false);
    }
  };

  // Tag management functions
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      setSelectedTags([...selectedTags, trimmedTag]);
      setCurrentTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputSubmit = () => {
    if (currentTagInput.trim()) {
      addTag(currentTagInput);
    }
  };

  const cancelTagging = () => {
    setShowTagModal(false);
    setSelectedTags([]);
    setCurrentTagInput('');
    setPendingMessage(null);
    setUploading(false);
  };

  const finalizePendingMessage = async () => {
    if (!pendingMessage) return;

    try {
      let savedMessage: any = null;

      // Save to Supabase with content extraction and get the database message
      if (pendingMessage.type === 'image' && pendingMessage.url) {
        savedMessage = await chatService.sendImageMessage(pendingMessage.url, selectedTags);
        console.log('Image message saved to Supabase');
      } else if (pendingMessage.type === 'file' && pendingMessage.url && pendingMessage.filename) {
        // Get file size and type from the original asset
        const fileInfo = await fetch(pendingMessage.url);
        const blob = await fileInfo.blob();
        
        // Use new content extraction method for files
        savedMessage = await chatService.saveMessageWithContentExtraction(
          pendingMessage.content || 'Document shared',
          'file',
          {
            fileUrl: pendingMessage.url,
            filename: pendingMessage.filename,
            fileType: blob.type || 'application/octet-stream',
            fileSize: blob.size,
            tags: selectedTags
          }
        );
        console.log('📄 File message saved with content extraction');
      } else if (pendingMessage.type === 'link' && pendingMessage.url && pendingMessage.content) {
        // Use enhanced link message method with content extraction
        savedMessage = await chatService.sendLinkMessage(
          pendingMessage.content || 'Link shared',
          pendingMessage.url,
          pendingMessage.linkPreview,
          selectedTags
        );
        console.log('🔗 Link message saved with content extraction');
      }

      // Create final message for UI using database data
      const finalMessage: Message = {
        id: generateUniqueId(), // Still need unique ID for React keys
        content: savedMessage?.content || pendingMessage.content || '',
        type: (pendingMessage.type as 'text' | 'image' | 'file' | 'link') || 'text',
        timestamp: savedMessage?.timestamp || getCurrentTimestamp(),
        isBot: false,
        url: pendingMessage.url,
        filename: pendingMessage.filename,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        linkPreview: pendingMessage.linkPreview,
      };
      
      setMessages(prev => [...prev, finalMessage]);
      
      // Auto-scroll to new content
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);

      console.log('Message uploaded and saved successfully');
    } catch (error) {
      console.error('Error uploading message:', error);
      Alert.alert('Error', 'Failed to upload. Please check your connection and try again.');
    }
    
    // Reset modal state
    setShowTagModal(false);
    setSelectedTags([]);
    setCurrentTagInput('');
    setPendingMessage(null);
    setUploading(false);
  };

  // Handle long press on message to show delete option
  const handleMessageLongPress = (message: Message) => {
    if (message.isBot) return; // Don't allow deletion of bot messages
    
    Alert.alert(
      'Delete Message',
      'What would you like to do with this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setMessageToDelete(message);
            setShowDeleteModal(true);
          }
        }
      ]
    );
  };

  // Confirm and delete message
  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;

    setDeleting(true);
    try {
      // Find the corresponding database message by content and type
      const dbMessages = await chatService.getUserMessages();
      const dbMessage = dbMessages.find(msg => 
        msg.content === messageToDelete.content && 
        msg.type === messageToDelete.type &&
        msg.file_url === messageToDelete.url
      );

      if (dbMessage) {
        // Delete from database (this also deletes the file from storage)
        await chatService.deleteMessage(dbMessage.id);
        console.log('Message deleted from database');
      }

      // Remove from local state
      setMessages(prev => prev.filter(msg => msg.id !== messageToDelete.id));
      
      Alert.alert('Success', 'Message deleted successfully');
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setMessageToDelete(null);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setMessageToDelete(null);
  };

  // Clear all chat messages
  const clearAllMessages = () => {
    Alert.alert(
      'Clear All Messages',
      'Are you sure you want to delete all your messages? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            try {
              const dbMessages = await chatService.getUserMessages();
              
              // Delete all messages from database
              for (const msg of dbMessages) {
                await chatService.deleteMessage(msg.id);
              }
              
              // Clear local state
              setMessages([]);
              
              // Show welcome messages again
              showMessagesSequentially();
              
              Alert.alert('Success', 'All messages cleared successfully');
            } catch (error) {
              console.error('Error clearing messages:', error);
              Alert.alert('Error', 'Failed to clear messages. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Ask AI about saved content with full database integration
  const askAIAboutContent = async (query: string) => {
    setAiLoading(true);
    try {
      // Use enhanced database-integrated content analysis
      const response = await openAIService.generateResponseWithDatabaseContext(query);
      
      // Create AI response message
      const aiMessage: Message = {
        id: generateUniqueId(),
        content: response,
        type: 'text',
        timestamp: getCurrentTimestamp(),
        isBot: true,
      };
      
      // Add to UI
      setMessages(prev => [...prev, aiMessage]);
      
      // Scroll to show response
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
      
      console.log('🔍 Database-integrated content analysis completed');
    } catch (error) {
      console.error('Error asking AI about content:', error);
      Alert.alert('Error', 'Failed to analyze your content database. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // Extract content from existing messages that don't have extracted content
  const extractExistingContent = async () => {
    try {
      Alert.alert(
        'Extract Content',
        'This will extract content from your existing links and files. This may take a few minutes.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Extract', 
            onPress: async () => {
              try {
                await chatService.extractContentFromExistingMessages();
                Alert.alert('Success', 'Content extraction completed! Check your database to see the results.');
              } catch (error) {
                console.error('Error extracting content:', error);
                Alert.alert('Error', 'Failed to extract content. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in extract existing content:', error);
    }
  };

  return (
    <RNSafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80}
      >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Chat</Text>
          {aiMode && <Text style={styles.aiModeIndicator}>AI Mode</Text>}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={[styles.aiToggle, aiMode && styles.aiToggleActive]} 
            onPress={() => setAiMode(!aiMode)}
          >
            <Ionicons 
              name="sparkles" 
              size={16} 
              color={aiMode ? "#fff" : "#666"} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={async () => {
              // Test content extraction with a sample URL
              await chatService.testContentExtraction('https://www.paulgraham.com/read.html');
            }}
          >
            <Ionicons name="flask" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={async () => {
              // Display database extracted_text in console
              await chatService.displayDatabaseExtractedText();
            }}
          >
            <Ionicons name="document-text" size={20} color="#FF9500" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearButton} onPress={extractExistingContent}>
            <Ionicons name="refresh" size={20} color="#34C759" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={clearAllMessages}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Welcome Message */}
      <View style={styles.welcomeContainer}>
        {aiLoading && (
          <View style={styles.aiLoadingContainer}>
            <Text style={styles.aiLoadingText}>🤖 Bill is thinking...</Text>
          </View>
        )}
        
        {/* No empty state image. Only show welcome text and action buttons for consistency. */}
      </View>

      {/* Messages */}
      <View style={styles.messagesContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          alwaysBounceVertical={true}
          scrollEventThrottle={16}
        >
          {messages.map((message, index) => (
            <TouchableOpacity
              key={`message-${index}-${message.id}`}
              style={[styles.messageContainer, message.isBot ? styles.botMessageContainer : styles.userMessageContainer]}
              onLongPress={() => handleMessageLongPress(message)}
              delayLongPress={500}
              activeOpacity={0.7}
            >
              <View style={[styles.messageBubble, message.isBot ? styles.botMessage : styles.userMessage]}>
                {/* Only show text for non-image messages */}
                {message.type !== 'image' && message.type !== 'link' && (
                  <Text style={[styles.messageText, message.isBot ? styles.botMessageText : styles.userMessageText]}>{message.content}</Text>
                )}
                {/* For link messages, strip out '[Content extracted: ...]' from the display */}
                {message.type === 'link' && (
                  <Text style={[styles.messageText, message.isBot ? styles.botMessageText : styles.userMessageText]}>
                    {message.content.replace(/\[Content extracted:.*?\]/, '').trim()}
                  </Text>
                )}
                {/* For image messages, only show the image (and tags below) */}
                {message.type === 'image' && message.url && (
                  <Image 
                    source={{ uri: message.url }} 
                    style={styles.imageMessage}
                  />
                )}
                {message.type === 'file' && (
                  <View style={styles.fileMessage}>
                    <Text style={styles.fileMessageText}>{message.filename}</Text>
                    <Ionicons name="document" size={20} color="#666" />
                  </View>
                )}
                {message.type === 'link' && message.linkPreview && (
                  <TouchableOpacity 
                    style={styles.linkPreview}
                    onPress={() => {
                      // Open link in browser
                      if (message.url) {
                        console.log('Opening link:', message.url);
                        Linking.openURL(message.url);
                      }
                    }}
                  >
                    {message.linkPreview.image && (
                      <Image 
                        source={{ uri: message.linkPreview.image }} 
                        style={styles.linkPreviewImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.linkPreviewContent}>
                      <Text style={styles.linkPreviewTitle} numberOfLines={2}>
                        {message.linkPreview.title || 'Link'}
                      </Text>
                      {message.linkPreview.description && (
                        <Text style={styles.linkPreviewDescription} numberOfLines={2}>
                          {message.linkPreview.description}
                        </Text>
                      )}
                      <Text style={styles.linkPreviewDomain}>
                        {message.linkPreview.domain || 'Link'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                {/* Display tags */}
                {message.tags && message.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {message.tags.map((tag, tagIndex) => (
                      <View key={`tag-${index}-${tagIndex}-${tag}`} style={[
                        styles.tagBadge, 
                        message.isBot ? styles.tagBadgeBot : styles.tagBadgeUser
                      ]}>
                        <Text style={[
                          styles.tagText,
                          message.isBot ? styles.tagTextBot : styles.tagTextUser
                        ]}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <Text style={[styles.timestamp, message.isBot ? styles.botTimestamp : styles.userTimestamp]}>{message.timestamp}</Text>
            </TouchableOpacity>
          ))}

        </ScrollView>
      </View>

      {/* Action Buttons */}
      {messages.length <= 4 && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <Ionicons name="camera" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Send an image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={pickDocument}>
            <Ionicons name="document" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Upload a doc</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Link Preview Above Input (WhatsApp-style) */}
      {(currentLinkPreview || linkPreviewLoading) && (
        <View style={styles.inputLinkPreviewContainer}>
          {linkPreviewLoading ? (
            <View style={styles.linkPreviewLoading}>
              <Text style={styles.linkPreviewLoadingText}>🔗 Generating preview...</Text>
            </View>
          ) : currentLinkPreview ? (
            <View style={styles.inputLinkPreview}>
              <TouchableOpacity 
                style={styles.inputLinkPreviewContent}
                onPress={() => {
                  if (previewUrl) {
                    Linking.openURL(previewUrl);
                  }
                }}
              >
                {currentLinkPreview.image && (
                  <Image 
                    source={{ uri: currentLinkPreview.image }} 
                    style={styles.inputLinkPreviewImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.inputLinkPreviewText}>
                  <Text style={styles.inputLinkPreviewTitle} numberOfLines={1}>
                    {currentLinkPreview.title}
                  </Text>
                  {currentLinkPreview.description && (
                    <Text style={styles.inputLinkPreviewDescription} numberOfLines={2}>
                      {currentLinkPreview.description}
                    </Text>
                  )}
                  <Text style={styles.inputLinkPreviewDomain}>
                    {currentLinkPreview.domain}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.inputLinkPreviewClose}
                onPress={() => {
                  setCurrentLinkPreview(null);
                  setPreviewUrl('');
                  setLinkPreviewLoading(false);
                }}
              >
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {/* Input Area */}
      <SafeAreaContextView edges={['bottom']} style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity 
            style={styles.attachmentButton} 
            onPress={() => {
              Alert.alert(
                'Add Attachment',
                'Choose what to attach',
                [
                  { text: 'Photo', onPress: pickImage },
                  { text: 'Document', onPress: pickDocument },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
          >
            <Ionicons name="add" size={24} color="#666" />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Message"
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => {
              setTimeout(() => scrollToBottom(), 300);
            }}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, inputText.trim() && styles.sendButtonActive]}
            onPress={handleSend}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={inputText.trim() ? "#007AFF" : "#999"} 
            />
          </TouchableOpacity>
        </View>
      </SafeAreaContextView>

      {/* Tag Modal */}
      <Modal
        visible={showTagModal}
        animationType="slide"
        transparent={true}
        onRequestClose={cancelTagging}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Tags</Text>
              <TouchableOpacity onPress={cancelTagging} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Tag input */}
            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                placeholder="Enter a tag..."
                value={currentTagInput}
                onChangeText={setCurrentTagInput}
                onSubmitEditing={handleTagInputSubmit}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={handleTagInputSubmit}
                disabled={!currentTagInput.trim()}
              >
                <Ionicons 
                  name="add" 
                  size={20} 
                  color={currentTagInput.trim() ? "#007AFF" : "#999"} 
                />
              </TouchableOpacity>
            </View>

            {/* Predefined tags */}
            <View style={styles.predefinedTagsContainer}>
              <Text style={styles.predefinedTagsTitle}>Quick Tags:</Text>
              <View style={styles.predefinedTagsGrid}>
                {predefinedTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.predefinedTag,
                      selectedTags.includes(tag) && styles.predefinedTagSelected
                    ]}
                    onPress={() => addTag(tag)}
                    disabled={selectedTags.includes(tag)}
                  >
                    <Text style={[
                      styles.predefinedTagText,
                      selectedTags.includes(tag) && styles.predefinedTagTextSelected
                    ]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Selected tags */}
            {selectedTags.length > 0 && (
              <View style={styles.selectedTagsContainer}>
                <Text style={styles.selectedTagsTitle}>Selected Tags:</Text>
                <View style={styles.selectedTagsGrid}>
                  {selectedTags.map((tag) => (
                    <View key={tag} style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>#{tag}</Text>
                      <TouchableOpacity
                        onPress={() => removeTag(tag)}
                        style={styles.removeTagButton}
                      >
                        <Ionicons name="close-circle" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Modal actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={cancelTagging}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={finalizePendingMessage}
              >
                <Text style={styles.modalSaveText}>
                  {selectedTags.length > 0 ? `Save with ${selectedTags.length} tag(s)` : 'Save without tags'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={cancelDelete}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteContent}>
            <View style={styles.deleteHeader}>
              <Ionicons name="warning" size={32} color="#FF3B30" />
              <Text style={styles.deleteTitle}>Delete Message</Text>
            </View>
            
            <Text style={styles.deleteText}>Are you sure you want to delete this message?</Text>
            
            {messageToDelete && (
              <View style={styles.deletePreview}>
                <Text style={styles.deletePreviewText} numberOfLines={3}>
                  "{messageToDelete.content}"
                </Text>
                {messageToDelete.type === 'image' && (
                  <Text style={styles.deleteFileType}>📷 Image</Text>
                )}
                {messageToDelete.type === 'file' && (
                  <Text style={styles.deleteFileType}>📄 {messageToDelete.filename}</Text>
                )}
              </View>
            )}
            
            <Text style={styles.deleteWarning}>This action cannot be undone.</Text>
            
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={cancelDelete}
                disabled={deleting}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteDeleteButton, deleting && styles.deleteButtonDisabled]}
                onPress={confirmDeleteMessage}
                disabled={deleting}
              >
                {deleting ? (
                  <Text style={styles.deleteDeleteText}>Deleting...</Text>
                ) : (
                  <Text style={styles.deleteDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </RNSafeAreaView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000',
  },
  clearButton: {
    padding: 5,
  },
  welcomeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  folderIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  emptyStateImage: {
    width: 120,
    height: 120,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  hintText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
    flexGrow: 1,
  },

  messageContainer: {
    marginBottom: 16,
  },
  botMessageContainer: {
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  botMessage: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  userMessage: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  botMessageText: {
    color: '#000',
  },
  userMessageText: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  botTimestamp: {
    color: '#999',
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  userTimestamp: {
    color: '#999',
    alignSelf: 'flex-end',
    marginRight: 4,
  },
  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  fileMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginTop: 8,
  },
  fileMessageText: {
    flex: 1,
    color: '#000000',
    marginRight: 8,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8f8f8',
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  attachmentButton: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
    borderRadius: 20,
  },
  sendButtonActive: {
    backgroundColor: '#e3f2fd',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    paddingTop: 6,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
  },
  tagBadgeBot: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  tagBadgeUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagTextBot: {
    color: '#007AFF',
  },
  tagTextUser: {
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalCloseButton: {
    padding: 4,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  tagInput: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    fontSize: 16,
  },
  addTagButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  predefinedTagsContainer: {
    marginBottom: 20,
  },
  predefinedTagsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  predefinedTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  predefinedTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    backgroundColor: '#f8f8f8',
  },
  predefinedTagSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  predefinedTagText: {
    fontSize: 14,
    color: '#666',
  },
  predefinedTagTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  selectedTagsContainer: {
    marginBottom: 20,
  },
  selectedTagsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  selectedTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    gap: 6,
  },
  selectedTagText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  removeTagButton: {
    padding: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalSaveButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scrollToBottomText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
  },
  deleteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 12,
  },
  deleteText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  deletePreview: {
    marginBottom: 20,
  },
  deletePreviewText: {
    fontSize: 16,
    color: '#000',
  },
  deleteFileType: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  deleteWarning: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  deleteActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  deleteDeleteButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  deleteDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  linkPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  linkPreviewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  linkPreviewContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  linkPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    lineHeight: 20,
  },
  linkPreviewDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 18,
  },
  linkPreviewDomain: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    textTransform: 'lowercase',
  },
  // AI-related styles
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  aiModeIndicator: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiToggle: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  aiToggleActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  aiLoadingContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  aiLoadingText: {
    fontSize: 12,
    color: '#007AFF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Input link preview styles (WhatsApp-style)
  inputLinkPreviewContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#ffffff',
  },
  linkPreviewLoading: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  linkPreviewLoadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  inputLinkPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputLinkPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
  inputLinkPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  inputLinkPreviewText: {
    flex: 1,
    justifyContent: 'space-between',
  },
  inputLinkPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    lineHeight: 18,
  },
  inputLinkPreviewDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    lineHeight: 16,
  },
  inputLinkPreviewDomain: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500',
    textTransform: 'lowercase',
  },
  inputLinkPreviewClose: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatScreen;
