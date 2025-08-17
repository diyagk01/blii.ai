import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
    View
} from 'react-native';
import { SafeAreaView as SafeAreaContextView } from 'react-native-safe-area-context';
import ChatService from '../services/chat';
import { cleanDisplayTitle } from '../services/html-utils';
import OpenAIService from '../services/openai';

// Global flag to prevent duplicate welcome messages across component re-mounts
let globalWelcomeMessagesShown = false;

// Typing indicator component
const TypingIndicator = () => {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <View style={styles.typingIndicator}>
      <Text style={styles.typingText}>{dots}</Text>
    </View>
  );
};

// ClickableText component for making links clickable in AI messages
const ClickableText = ({ text, style }: { text: string; style?: any }) => {
  const detectLinks = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  const renderTextWithLinks = () => {
    const links = detectLinks(text);
    if (links.length === 0) {
      return <Text style={style}>{text}</Text>;
    }

    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    return (
      <Text style={style}>
        {parts.map((part, index) => {
          if (links.includes(part)) {
            return (
              <Text
                key={index}
                style={[style, { color: '#007AFF', textDecorationLine: 'underline' }]}
                onPress={() => Linking.openURL(part)}
              >
                {part}
              </Text>
            );
          }
          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    );
  };

  return renderTextWithLinks();
};

interface Message {
  id: number;
  content: string;
  type: 'text' | 'image' | 'file' | 'link';
  timestamp: string;
  isBot: boolean;
  url?: string;
  filename?: string;
  file_type?: string;
  file_size?: number;
  tags?: string[];

  // AI Analysis fields
  ai_analysis?: string;
  content_insights?: string;
  visual_description?: string;
  document_summary?: string;
  
  // Content extraction fields
  extracted_text?: string;
  extracted_title?: string;
  extracted_author?: string;
  extracted_excerpt?: string;
  word_count?: number;
  content_category?: string;
  extraction_status?: string;

  // Link preview data
  linkPreview?: {
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
  };
  // Referenced content for AI messages
  referencedContent?: {
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
    url?: string;
  };
  // Reply information
  replyTo?: Message;
}

const ChatScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingFileType, setUploadingFileType] = useState<string>('');
  const scrollViewRef = useRef<ScrollView>(null);
  const chatService = ChatService.getInstance();
  const openAIService = OpenAIService.getInstance();
  
  // Tag modal state
  const [showTagModal, setShowTagModal] = useState(false);
  const [currentTagInput, setCurrentTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [pendingMessage, setPendingMessage] = useState<Partial<Message> | null>(null);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  
  // Tag suggestions bottom sheet state
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [currentMessageForTagging, setCurrentMessageForTagging] = useState<Message | null>(null);
  

  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Clear chat loading state
  const [clearingMessages, setClearingMessages] = useState(false);
  const [deletingProgress, setDeletingProgress] = useState(0);
  const [deletingText, setDeletingText] = useState('Preparing to delete...');
  
  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set());
  
  // AI functionality state - Enable by default so bot responds to questions
  const [aiMode, setAiMode] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingMessage, setAiLoadingMessage] = useState('');
  
  // Link preview state
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [currentLinkPreview, setCurrentLinkPreview] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  // Reply preview state
  const [replyPreview, setReplyPreview] = useState<Message | null>(null);
  
  // Message loading state
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  
  // Animation values for each message
  const messageAnimations = useRef<{ [key: number]: Animated.Value }>({});
  
  // Animation for delete loading spinner
  const deleteSpinValue = useRef(new Animated.Value(0)).current;
  
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
        image: `https://via.placeholder.com/400x300/808080/white?text=🔗+${encodeURIComponent(domain.substring(0, 15))}`,
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

  // Helper function to format file details dynamically - MEMOIZED to prevent infinite loops
  const getFileDetails = useCallback((message: Message): string => {
    const filename = message.filename || '';
    const fileType = message.file_type || '';
    const fileSize = message.file_size || 0;
    
    // Only log in development to reduce console spam
    if (__DEV__) {
      console.log('📄 getFileDetails called for:', {
        filename,
        fileType,
        fileSize,
        messageId: message.id
      });
    }
    
    // Determine file type from filename or file_type
    let type = 'Document';
    if (filename.toLowerCase().endsWith('.pdf') || fileType.toLowerCase().includes('pdf')) {
      type = 'PDF';
    } else if (filename.toLowerCase().endsWith('.doc') || filename.toLowerCase().endsWith('.docx') || fileType.toLowerCase().includes('word')) {
      type = 'Word';
    } else if (filename.toLowerCase().endsWith('.xls') || filename.toLowerCase().endsWith('.xlsx') || fileType.toLowerCase().includes('excel')) {
      type = 'Excel';
    } else if (filename.toLowerCase().endsWith('.ppt') || filename.toLowerCase().endsWith('.pptx') || fileType.toLowerCase().includes('powerpoint')) {
      type = 'PowerPoint';
    } else if (filename.toLowerCase().endsWith('.txt') || fileType.toLowerCase().includes('text')) {
      type = 'Text';
    } else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg') || filename.toLowerCase().endsWith('.png') || fileType.toLowerCase().includes('image')) {
      type = 'Image';
    }
    
    // Format file size
    let sizeText = '';
    if (fileSize && fileSize > 0) {
      if (fileSize < 1024) {
        sizeText = `${fileSize} B`;
      } else if (fileSize < 1024 * 1024) {
        sizeText = `${(fileSize / 1024).toFixed(1)} KB`;
      } else {
        sizeText = `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
      }
    } else {
      // Try to get file size from URL if available
      if (message.url && message.url.startsWith('file://')) {
        sizeText = 'Calculating...';
        // We could add async file size calculation here in the future
      } else {
        sizeText = 'Unknown size';
      }
    }
    
    if (__DEV__) {
      console.log('📄 File details result:', `${type} • ${sizeText}`);
    }
    
    // For now, we'll show just the type and size since page count requires PDF parsing
    // In the future, you could add page_count to the message object and use it here
    return `${type} • ${sizeText}`;
  }, []);

  // Helper function to get emoji for a tag - consistent with message creation
  const getTagEmoji = (tagName: string): string => {
    // Check predefined tags first
    const predefinedTag = predefinedTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (predefinedTag) {
      return predefinedTag.emoji;
    }
    
    // Use the same logic as getEmojiForTag for consistency
    return getEmojiForTag(tagName);
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
      return '🌱';
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
      return '🔒';
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
      return '💡';
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

  // Predefined tags for quick selection with emojis
  const predefinedTags = [
    { name: 'Health', emoji: '🍃' },
    { name: 'Work', emoji: '💼' }, 
    { name: 'Fitness', emoji: '💪' },
    { name: 'Travel', emoji: '✈️' },
    { name: 'To Read', emoji: '📖' },

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
  const loadMessages = async (retryCount = 0) => {
    // Prevent multiple simultaneous loads
    if (loadingMessages) {
      console.log('🔄 Already loading messages, skipping...');
      return;
    }
    
    try {
      setLoadingMessages(true);
      console.log(`🔄 Loading messages from Supabase... (attempt ${retryCount + 1})`);
      const dbMessages = await chatService.getUserMessages();
      
      console.log(`📊 Found ${dbMessages.length} messages in database`);
      
      if (dbMessages.length > 0) {
        console.log('✅ Converting database messages to local format...');
        // Convert database messages to local format with preserved IDs and starred status
        const localMessages = dbMessages.map((msg, index) => ({
          ...chatService.convertToLocalMessage(msg),
          starred: msg.tags?.includes('starred') || false, // Add starred property for consistency
        }));
        
        console.log(`✅ Setting ${localMessages.length} messages to state`);
        setMessages(localMessages);
        setHasLoadedMessages(true);
        
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
        console.log('📝 No messages found in database, showing welcome messages');
        // Show welcome messages if no messages in database
        showMessagesSequentially();
        setHasLoadedMessages(true);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      
      // Retry logic for authentication or connection issues
      if (retryCount < 2) {
        console.log(`🔄 Retrying message load in 1 second... (attempt ${retryCount + 1})`);
        setTimeout(() => {
          loadMessages(retryCount + 1);
        }, 1000);
      } else {
        console.log('❌ Max retries reached, showing welcome messages');
        // Show welcome messages on error after max retries
        showMessagesSequentially();
        setHasLoadedMessages(true);
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  // Simple scroll to bottom function
  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const showMessagesSequentially = () => {
    console.log('🔍 showMessagesSequentially called - messages.length:', messages.length, 'globalWelcomeMessagesShown:', globalWelcomeMessagesShown);
    
    // Prevent duplicate welcome messages using global flag
    if (globalWelcomeMessagesShown) {
      console.log('🔄 Global flag: Welcome messages already shown, skipping...');
      return;
    }
    
    // Prevent duplicate welcome messages by checking if messages already exist
    if (messages.length > 0) {
      console.log('🔄 Messages already exist, skipping welcome messages...');
      return;
    }
    
    console.log('🎬 Showing welcome messages sequentially...');
    globalWelcomeMessagesShown = true;
    
    const initialMessages = getInitialMessages();
    initialMessages.forEach((message: Message, index: number) => {
      // Create animation value for this message
      messageAnimations.current[message.id] = new Animated.Value(0);
      
      setTimeout(() => {
        // Add message to state
        console.log('➕ Adding welcome message:', message.content);
        setMessages(prev => {
          console.log('📝 Current messages before adding:', prev.length);
          const newMessages = [...prev, message];
          console.log('📝 Messages after adding:', newMessages.length);
          return newMessages;
        });
        
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

  // Debug function to test document extraction
  const debugDocumentExtraction = async () => {
    try {
      console.log('🧪 Debugging document extraction...');
      const debugResult = await chatService.debugExtractedContent();
      console.log('📊 Debug result:', JSON.stringify(debugResult, null, 2));
      
      // Show debug info in an alert
      const message = `Debug Results:
Total Messages: ${debugResult.totalMessages}
With Extracted Text: ${debugResult.withExtractedText}
Without Extracted Text: ${debugResult.withoutExtractedText}

Messages with extracted text:
${debugResult.messagesWithExtractedText?.map((msg: any) => 
  `- ${msg.type}: ${msg.filename} (${msg.extractedTextLength} chars, ${msg.wordCount} words)`
).join('\n') || 'None'}`;
      
      Alert.alert('Document Extraction Debug', message);
    } catch (error) {
      console.error('❌ Debug failed:', error);
      Alert.alert('Debug Error', 'Failed to debug document extraction');
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    // Check if this is a reply to a specific message
    const isReply = replyPreview !== null;
    const originalMessage = inputText;

    // Detect if message contains links
    const links = detectLinks(inputText.trim());
    
    if (links.length > 0) {
      // Handle as link message - show tag modal like images/files
      const url = links[0]; // Use first link found
      
      try {
        // Generate preview first
        const preview = await fetchLinkPreview(url);
        
        // Generate automatic tags for the link
        const newMessage: Partial<Message> = {
          id: generateUniqueId(),
          content: inputText,
          type: 'link',
          timestamp: getCurrentTimestamp(),
          isBot: false,
          url: url,
          linkPreview: preview,
        };

        // Generate automatic tags using improved AI tag generation
        let autoTags: string[] = [];
        try {
          if (preview && (preview.title || preview.description)) {
            const contentToAnalyze = `${preview.title || ''} ${preview.description || ''}`.trim();
            if (contentToAnalyze) {
              // Use OpenAI service for better, single tag generation
              const aiTags = await openAIService.generateTagSuggestions(contentToAnalyze);
              // Apply emoji formatting to the AI-generated tag
              autoTags = aiTags.map(tag => {
                // Check if tag already starts with an emoji (comprehensive emoji detection)
                const trimmedTag = tag.trim();
                const startsWithEmoji = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u.test(trimmedTag);
                
                if (startsWithEmoji) {
                  console.log('🏷️ Tag already has emoji:', trimmedTag);
                  return trimmedTag; // Return as-is if already has emoji
                }
                
                const emoji = getEmojiForTag(trimmedTag);
                const formattedTag = emoji ? `${emoji} ${trimmedTag}` : trimmedTag;
                console.log('🏷️ Formatted tag:', formattedTag, 'Original:', trimmedTag, 'Emoji:', emoji);
                return formattedTag;
              });
              console.log('🤖 AI-generated tags for link:', autoTags);
            }
          }
          // Fallback to local generation if AI fails
          if (autoTags.length === 0) {
            const fallbackTags = generateTagSuggestions(newMessage);
            // Apply emoji formatting to fallback tags too
            autoTags = fallbackTags.map(tag => {
              const trimmedTag = tag.trim();
              const startsWithEmoji = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u.test(trimmedTag);
              
              if (startsWithEmoji) {
                console.log('🏷️ Fallback tag already has emoji:', trimmedTag);
                return trimmedTag;
              }
              
              const emoji = getEmojiForTag(trimmedTag);
              const formattedTag = emoji ? `${emoji} ${trimmedTag}` : trimmedTag;
              console.log('🏷️ Formatted fallback tag:', formattedTag, 'Original:', trimmedTag);
              return formattedTag;
            });
          }
        } catch (error) {
          console.warn('AI tag generation failed, using fallback:', error);
          const fallbackTags = generateTagSuggestions(newMessage);
          // Apply emoji formatting to fallback tags too
          autoTags = fallbackTags.map(tag => {
            const trimmedTag = tag.trim();
            const startsWithEmoji = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u.test(trimmedTag);
            
            if (startsWithEmoji) {
              console.log('🏷️ Error fallback tag already has emoji:', trimmedTag);
              return trimmedTag;
            }
            
            const emoji = getEmojiForTag(trimmedTag);
            const formattedTag = emoji ? `${emoji} ${trimmedTag}` : trimmedTag;
            console.log('🏷️ Formatted error fallback tag:', formattedTag, 'Original:', trimmedTag);
            return formattedTag;
          });
        }
        
        // Save link with automatic tags
        const savedMessage = await chatService.sendLinkMessage(
          inputText,
          url,
          preview,
          autoTags
        );
        
        // Create final message for UI
        const finalMessage: Message = {
          id: generateUniqueId(),
          content: savedMessage?.content || inputText,
          type: 'link',
          timestamp: savedMessage?.timestamp || getCurrentTimestamp(),
          isBot: false,
          url: url,
          linkPreview: preview,
          tags: autoTags,
        };
        
        setMessages(prev => [...prev, finalMessage]);
        setInputText(''); // Clear input
        setReplyPreview(null); // Clear reply preview
        
        // Auto-scroll to new content
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 300);
        
        console.log('Link uploaded with automatic tags:', autoTags);
      } catch (error) {
        console.error('Error processing link:', error);
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
        replyTo: isReply && replyPreview ? replyPreview : undefined,
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
        await chatService.sendTextMessage(originalMessage);
        console.log('Text message saved to Supabase');
        
        // Generate AI response if AI mode is enabled
        if (aiMode) {
          setAiLoading(true);
          setAiLoadingMessage('Reading what you saved...');
          
          // Add typing indicator message
          const typingMessage: Message = {
            id: generateUniqueId(),
            content: '...',
            type: 'text',
            timestamp: getCurrentTimestamp(),
            isBot: true,
          };
          setMessages(prev => [...prev, typingMessage]);
          
          // Scroll to show typing indicator
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
          
          try {
            let aiResponse: string;
            
            if (isReply && replyPreview) {
              // Generate focused response based on the specific message being replied to
              console.log('🎯 Generating focused reply response for specific content...');
              aiResponse = await generateFocusedReplyResponse(originalMessage, replyPreview);
            } else {
              // Show extraction stats for debugging
              const stats = chatService.getExtractionStats();
              console.log('📊 Content extraction stats:', stats);
              
              // Generate enhanced AI response with full database context
              aiResponse = await openAIService.generateResponseWithDatabaseContext(originalMessage);
            }
            
            // Get referenced content for the AI response
            const referencedContent = await getReferencedContent(originalMessage);
            
            // Remove typing indicator and add actual response
            setMessages(prev => {
              // Remove the typing indicator (last message with "..." content)
              const withoutTyping = prev.filter(msg => !(msg.isBot && msg.content === '...'));
              
              // Add the actual AI response
              const aiMessage: Message = {
                id: generateUniqueId(),
                content: aiResponse,
                type: 'text',
                timestamp: getCurrentTimestamp(),
                isBot: true,
                referencedContent: referencedContent,
                replyTo: isReply && replyPreview ? replyPreview : undefined,
              };
              
              return [...withoutTyping, aiMessage];
            });
            
            // Save AI response to database
            await openAIService.sendAIResponse(originalMessage);
            
            // Clear reply preview after successful response
            setReplyPreview(null);
            
            // Scroll to show AI response
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 300);
            
            console.log('🧠 AI response generated and saved');
          } catch (aiError) {
            console.error('Error generating AI response:', aiError);
            
            // Get referenced content for fallback message
            const referencedContent = await getReferencedContent(originalMessage);
            
            // Remove typing indicator and show fallback message
            setMessages(prev => {
              // Remove the typing indicator (last message with "..." content)
              const withoutTyping = prev.filter(msg => !(msg.isBot && msg.content === '...'));
              
              // Add fallback message
              const fallbackMessage: Message = {
                id: generateUniqueId(),
                content: "Sorry, I'm having trouble accessing your content database right now. Please try again later.",
                type: 'text',
                timestamp: getCurrentTimestamp(),
                isBot: true,
                referencedContent: referencedContent,
              };
              
              return [...withoutTyping, fallbackMessage];
            });
            
            // Clear reply preview on error too
            setReplyPreview(null);
          } finally {
            setAiLoading(false);
          }
        } else {
          // Clear reply preview even if AI mode is off
          setReplyPreview(null);
        }
      } catch (error) {
        console.error('Error saving text message:', error);
        Alert.alert('Error', 'Failed to save message. Please try again.');
        
        // Remove message from UI on error
        setMessages(prev => prev.filter(msg => msg.id !== localMessage.id));
        setAiLoading(false);
        setReplyPreview(null);
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
          setUploadingFileType('image');
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
        
        // Generate automatic tags for the image
        const newMessage: Partial<Message> = {
          id: generateUniqueId(),
          content: 'Image shared',
          type: 'image',
          timestamp: getCurrentTimestamp(),
          isBot: false,
          url: asset.uri,
        };

        // Save image - AI analysis will generate tags automatically
        try {
          const savedMessage = await chatService.sendImageMessage(asset.uri);
          
          // Create final message for UI using AI-generated tags
          const finalMessage: Message = {
            id: generateUniqueId(),
            content: savedMessage?.content || 'Image shared',
            type: 'image',
            timestamp: savedMessage?.timestamp || getCurrentTimestamp(),
            isBot: false,
            url: asset.uri,
            tags: savedMessage?.tags || [], // Use AI-generated tags from analysis
          };
          
          setMessages(prev => [...prev, finalMessage]);
          
          // Auto-scroll to new content
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 300);
          
          console.log('Image uploaded with AI-generated tags:', savedMessage?.tags);
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload image. Please try again.');
        }
              } catch (error) {
          console.error('Error processing image:', error);
          Alert.alert('Error', 'Failed to process image');
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
        // Determine file type based on filename
        const filename = result.assets[0].name.toLowerCase();
        const isPDF = filename.endsWith('.pdf');
        setUploadingFileType(isPDF ? 'PDF' : 'document');
        const asset = result.assets[0];

        // Generate automatic tags for the document
        const newMessage: Partial<Message> = {
          id: generateUniqueId(),
          content: asset.name, // Use filename instead of "Document shared"
          type: 'file',
          timestamp: getCurrentTimestamp(),
          isBot: false,
          url: asset.uri,
          filename: asset.name,
        };

        // Generate automatic tags for document
        const autoTags = generateTagSuggestions(newMessage);
        
        // Save document with automatic tags
        try {
          const savedMessage = await chatService.saveMessageWithContentExtraction(
            asset.name, // Use filename instead of "Document shared"
            'file',
            {
              fileUrl: asset.uri,
              filename: asset.name,
              fileType: asset.mimeType || 'application/octet-stream',
              fileSize: asset.size || 0,
              tags: autoTags
            }
          );
          
          // Create final message for UI
          const finalMessage: Message = {
            id: generateUniqueId(),
            content: savedMessage?.content || asset.name, // Use filename instead of "Document shared"
            type: 'file',
            timestamp: savedMessage?.timestamp || getCurrentTimestamp(),
            isBot: false,
            url: asset.uri,
            filename: asset.name,
            file_size: asset.size || 0,
            file_type: asset.mimeType || 'application/octet-stream',
            tags: savedMessage?.tags || autoTags, // Use saved tags or fallback to generated ones
          };
          
          setMessages(prev => [...prev, finalMessage]);
          
          // Auto-scroll to new content
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 300);
          
          console.log('Document uploaded with tags:', savedMessage?.tags || autoTags);
        } catch (error) {
          console.error('Error uploading document:', error);
          Alert.alert('Error', 'Failed to upload document. Please try again.');
        } finally {
          // Always reset uploading state when done
          setUploading(false);
          setUploadingFileType('');
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
      // Reset uploading state on error
      setUploading(false);
      setUploadingFileType('');
    }
  };

  // Tag management functions
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && trimmedTag.length > 0) {
      if (selectedTags.includes(trimmedTag)) {
        // If tag is already selected, remove it (toggle behavior)
        setSelectedTags(selectedTags.filter(t => t !== trimmedTag));
        console.log('✅ Tag removed:', trimmedTag);
      } else {
        // Add the tag to selected tags (this will make it appear blue)
        setSelectedTags([...selectedTags, trimmedTag]);
        setCurrentTagInput('');
        console.log('✅ Tag added:', trimmedTag);
      }
    } else {
      console.log('❌ Tag not added:', trimmedTag, 'Reason: empty');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputSubmit = () => {
    console.log('🔄 Tag input submit triggered with:', currentTagInput);
    if (currentTagInput.trim()) {
      addTag(currentTagInput);
    } else {
      console.log('❌ Empty tag input, not adding');
    }
  };

  const cancelTagging = () => {
    setShowTagModal(false);
    setSelectedTags([]);
    setCurrentTagInput('');
    setPendingMessage(null);
    setUploading(false);
    setUploadingFileType('');
  };

  const handleAddTagToMessage = async (message: Message) => {
    // Toggle functionality: if clicking the same message, hide the sublist
    if (currentMessageForTagging?.id === message.id && showTagSuggestions) {
      setShowTagSuggestions(false);
      setCurrentMessageForTagging(null);
      return;
    }
    
    // Set the current message for tagging
    setCurrentMessageForTagging(message);
    
    // Generate comprehensive tag suggestions including AI tags
    let suggestions: string[] = [];
    
    try {
      if (message.type === 'link' && message.referencedContent) {
        // For links, generate multiple AI suggestions to ensure we get variety
        const contentToAnalyze = `${message.referencedContent.title || ''} ${message.referencedContent.description || ''}`.trim();
        if (contentToAnalyze) {
          const aiTags = await openAIService.generateMultipleTagSuggestions(contentToAnalyze, 3);
          suggestions.push(...aiTags);
        }
        // Add contextual fallback suggestions
        suggestions.push('Innovation', 'Technology', 'Research', 'Digital');
      } else if (message.type === 'image') {
        // For images, generate contextual suggestions
        suggestions.push('Photography', 'Visual', 'Creative', 'Media', 'Design', 'Art');
      } else if (message.type === 'file') {
        // For files, use existing logic
        suggestions = generateTagSuggestions(message);
        // Add additional contextual suggestions
        suggestions.push('Document', 'Reference', 'Archive', 'Important');
      }
      
      // Remove duplicates and existing tags, limit to exactly 1 additional AI suggestion
      const existingTags = message.tags || [];
      const filteredSuggestions = suggestions
        .filter(tag => !existingTags.some(existing => 
          existing.toLowerCase().trim() === tag.toLowerCase().trim()
        ))
        .slice(0, 1); // Limit to exactly 1 additional AI suggestion for inline
      
      // Ensure we have at least 1 suggestion, add fallback if needed
      if (filteredSuggestions.length === 0) {
        const fallbackTags = ['Innovation', 'Technology', 'Important', 'Research'];
        const fallbackTag = fallbackTags.find(tag => 
          !existingTags.some(existing => existing.toLowerCase().trim() === tag.toLowerCase().trim())
        );
        if (fallbackTag) {
          filteredSuggestions.push(fallbackTag);
        }
      }
      
      console.log('🏷️ Inline suggestions generated:', {
        allSuggestions: suggestions,
        existingTags: existingTags,
        filteredSuggestions: filteredSuggestions
      });
      
      setSuggestedTags(filteredSuggestions);
    } catch (error) {
      console.warn('Failed to generate AI suggestions, using fallback:', error);
      suggestions = generateTagSuggestions(message);
      const fallbackFiltered = suggestions.slice(0, 1);
      console.log('🏷️ Using fallback suggestions:', fallbackFiltered);
      setSuggestedTags(fallbackFiltered); // Limit to exactly 1 for inline consistency
    }
    
    // Show tag suggestions
    setShowTagSuggestions(true);
  };

  const handleTagSuggestionSelect = async (tag: string) => {
    if (!currentMessageForTagging) return;
    
    // Add the selected tag to the message
    const updatedTags = [...(currentMessageForTagging.tags || []), tag];
    
    // Update the message in the local state
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === currentMessageForTagging.id 
          ? { ...msg, tags: updatedTags }
          : msg
      )
    );
    
    // Hide the tag suggestions
    setShowTagSuggestions(false);
    setCurrentMessageForTagging(null);
    
    // Show visual feedback for successful tag addition
    console.log('✅ Tag added successfully:', tag);
    console.log('📋 Message now has tags:', updatedTags);
    
    // TODO: Update the message in the database
    console.log('Added tag to message:', tag);
  };

  const handleCustomTagClick = async () => {
    if (!currentMessageForTagging) return;
    
    // Set up the tag modal with the current message
    setPendingMessage(currentMessageForTagging);
    setSelectedTags(currentMessageForTagging.tags || []);
    
    // Generate exactly 2 AI suggestions for the modal
    let modalSuggestions: string[] = [];
    
    try {
      // Generate 2 AI tags based on content, including both existing and new
      if (currentMessageForTagging.type === 'link' && currentMessageForTagging.referencedContent) {
        const contentToAnalyze = `${currentMessageForTagging.referencedContent.title || ''} ${currentMessageForTagging.referencedContent.description || ''}`.trim();
        if (contentToAnalyze) {
          const aiTags = await openAIService.generateMultipleTagSuggestions(contentToAnalyze, 3);
          
          // Include the existing AI tag if it exists
          const existingAITag = currentMessageForTagging.tags?.[0];
          if (existingAITag) {
            modalSuggestions.push(existingAITag);
          }
          
          // Add additional AI tags that are different from existing
          const newAITags = aiTags.filter(tag => tag !== existingAITag);
          modalSuggestions.push(...newAITags);
        }
      } else if (currentMessageForTagging.type === 'image') {
        // For images, include existing + generate new contextual tags
        const existingAITag = currentMessageForTagging.tags?.[0];
        if (existingAITag) {
          modalSuggestions.push(existingAITag);
        }
        const imageTags = ['Visual', 'Creative', 'Photography', 'Media', 'Art', 'Design'];
        const newImageTags = imageTags.filter(tag => tag !== existingAITag);
        modalSuggestions.push(...newImageTags.slice(0, 2));
      } else if (currentMessageForTagging.type === 'file') {
        // For files, include existing + generate new contextual tags
        const existingAITag = currentMessageForTagging.tags?.[0];
        if (existingAITag) {
          modalSuggestions.push(existingAITag);
        }
        const fileTags = generateTagSuggestions(currentMessageForTagging);
        const newFileTags = fileTags.filter(tag => tag !== existingAITag);
        modalSuggestions.push(...newFileTags.slice(0, 2));
      }
      
      // Ensure we have exactly 2 unique suggestions
      const uniqueSuggestions = [...new Set(modalSuggestions)].slice(0, 2);
      
      // If we still don't have 2 suggestions, add fallback
      if (uniqueSuggestions.length < 2) {
        const fallbackTags = ['Technology', 'Innovation', 'Research', 'Important'];
        const existingAITag = currentMessageForTagging.tags?.[0];
        const additionalTags = fallbackTags.filter(tag => 
          tag !== existingAITag && !uniqueSuggestions.includes(tag)
        );
        uniqueSuggestions.push(...additionalTags.slice(0, 2 - uniqueSuggestions.length));
      }
      
      setSuggestedTags(uniqueSuggestions.slice(0, 2));
    } catch (error) {
      console.warn('Failed to generate modal suggestions:', error);
      // Fallback: use existing tag + one contextual suggestion
      const existingTag = currentMessageForTagging.tags?.[0];
      const fallbackSuggestions = existingTag ? [existingTag, 'Technology'] : ['Technology', 'Important'];
      setSuggestedTags(fallbackSuggestions.slice(0, 2));
    }
    
    // Hide tag suggestions and show the modal
    setShowTagSuggestions(false);
    setShowTagModal(true);
  };

  const finalizePendingMessage = async () => {
    if (!pendingMessage) return;

    try {
      // Check if this is an existing message (has an id that's not a generated one)
      const isExistingMessage = pendingMessage.id && typeof pendingMessage.id === 'number' && pendingMessage.id > 1000;
      
      if (isExistingMessage) {
        // Update existing message tags in the database
        console.log('🏷️ Updating tags for existing message:', { tags: selectedTags });
        
        // Find the corresponding database message to get the correct UUID
        const dbMessages = await chatService.getUserMessages();
        const dbMessage = dbMessages.find(msg => 
          msg.content === pendingMessage.content && 
          msg.type === pendingMessage.type &&
          msg.file_url === pendingMessage.url
        );

        if (dbMessage) {
          await chatService.updateMessageTags(
            dbMessage.id, // Use the database UUID instead of local ID
            selectedTags
          );
        } else {
          console.error('❌ Could not find database message for local message:', pendingMessage.id);
          Alert.alert('Error', 'Could not find the message in the database. Please try again.');
          return;
        }
        
        // Update the message in the UI
        setMessages(prev => prev.map(msg => 
          msg.id === pendingMessage.id 
            ? { ...msg, tags: selectedTags }
            : msg
        ));
        
        console.log('✅ Message tags updated successfully!');
        console.log(`📋 Final tags (${selectedTags.length}):`, selectedTags);
      } else {
        // This should not happen with the new flow, but keeping for safety
        console.log('Unexpected: finalizePendingMessage called for new message');
      }
    } catch (error) {
      console.error('Error updating message tags:', error);
      Alert.alert('Error', 'Failed to update tags. Please try again.');
    }
    
    // Reset modal state
    setShowTagModal(false);
    setSelectedTags([]);
    setCurrentTagInput('');
    setPendingMessage(null);
    setUploading(false);
    setUploadingFileType('');
  };

  // Handle long press on message to show context menu
  const handleMessageLongPress = (message: Message, event: any) => {
    if (message.isBot) return; // Don't allow context menu for bot messages
    
    // Get touch position for context menu placement
    const { pageX, pageY } = event.nativeEvent;
    
    setContextMenuMessage(message);
    setContextMenuPosition({ x: pageX, y: pageY });
    setShowContextMenu(true);
  };

  // Context menu actions
  const handleReply = () => {
    if (!contextMenuMessage) return;
    
    // Set the reply preview to show above input
    setReplyPreview(contextMenuMessage);
    setInputText('');
    setShowContextMenu(false);
    setContextMenuMessage(null);
  };

  const handleStar = async () => {
    if (!contextMenuMessage) return;
    
    try {
      // Find the corresponding database message
      const dbMessages = await chatService.getUserMessages();
      const dbMessage = dbMessages.find(msg => 
        msg.content === contextMenuMessage.content && 
        msg.type === contextMenuMessage.type &&
        msg.file_url === contextMenuMessage.url
      );

      if (dbMessage) {
        // Check if message is currently starred
        const isCurrentlyStarred = contextMenuMessage.tags?.includes('starred') || false;
        
        // Toggle starred status
        await chatService.updateMessageStarred(dbMessage.id, !isCurrentlyStarred);
        
        // Update local message state to reflect the change
        setMessages(prevMessages => 
          prevMessages.map(msg => {
            if (msg.id === contextMenuMessage.id) {
              const currentTags = msg.tags || [];
              if (isCurrentlyStarred) {
                // Remove 'starred' tag
                return { ...msg, tags: currentTags.filter(tag => tag !== 'starred') };
              } else {
                // Add 'starred' tag
                return { ...msg, tags: [...currentTags, 'starred'] };
              }
            }
            return msg;
          })
        );
        
        console.log(`⭐ Message ${isCurrentlyStarred ? 'unstarred' : 'starred'}:`, dbMessage.id);
      }
    } catch (error) {
      console.error('Error toggling star status:', error);
    }
    
    setShowContextMenu(false);
    setContextMenuMessage(null);
  };

  const handleShare = async () => {
    if (!contextMenuMessage) return;
    
    try {
      // Create share content based on message type
      let shareContent = '';
      
      switch (contextMenuMessage.type) {
        case 'text':
          shareContent = contextMenuMessage.content;
          break;
        case 'link':
          shareContent = `${contextMenuMessage.content}\n\n${contextMenuMessage.url}`;
          break;
        case 'file':
          shareContent = `Document: ${contextMenuMessage.filename}`;
          break;
        case 'image':
          shareContent = 'Image shared from Blii';
          break;
      }
      
      console.log('📤 Sharing content:', shareContent);
      
      // Try to use React Native's Share API first (works in development builds)
      try {
        const { Share } = require('react-native');
        
        const result = await Share.share({
          message: shareContent,
          title: 'Shared from Blii',
        });
        
        if (result.action === Share.sharedAction) {
          console.log('📤 Content shared successfully via React Native Share');
        } else if (result.action === Share.dismissedAction) {
          console.log('📤 Share dismissed');
        }
      } catch (shareError) {
        console.log('📤 React Native Share not available, falling back to clipboard');
        
        // Fallback to clipboard using Expo Clipboard
        try {
          const Clipboard = require('expo-clipboard');
          await Clipboard.setStringAsync(shareContent);
          
          Alert.alert(
            'Content Copied',
            'The content has been copied to your clipboard. You can now paste it in any app like Messages, Mail, Notes, etc.',
            [{ text: 'OK' }]
          );
          
          console.log('📤 Content copied to clipboard successfully');
        } catch (clipboardError) {
          console.error('Clipboard error:', clipboardError);
          
          // Final fallback - show content in alert with copy option
          Alert.alert(
            'Share Content',
            shareContent,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Copy Text', 
                onPress: () => {
                  // Manual copy instruction
                  Alert.alert(
                    'Copy Manually',
                    'Please manually copy this text:\n\n' + shareContent,
                    [{ text: 'OK' }]
                  );
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error in share handler:', error);
      Alert.alert('Error', 'Unable to share content. Please try again.');
    }
    
    setShowContextMenu(false);
    setContextMenuMessage(null);
  };

  const handleContextDelete = () => {
    if (!contextMenuMessage) return;
    
    setMessageToDelete(contextMenuMessage);
    setShowDeleteModal(true);
    setShowContextMenu(false);
    setContextMenuMessage(null);
  };

  const handleSelect = () => {
    if (!contextMenuMessage) return;
    
    // Enable selection mode and select the current message
    setSelectionMode(true);
    setSelectedMessages(new Set([contextMenuMessage.id]));
    
    setShowContextMenu(false);
    setContextMenuMessage(null);
  };

  // Selection mode functions
  const toggleMessageSelection = (messageId: number) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedMessages(new Set());
  };

  const handleSelectionAddTag = () => {
    if (selectedMessages.size === 0) return;
    
    // Get the first selected message to generate suggestions from
    const firstSelectedId = Array.from(selectedMessages)[0];
    const firstSelectedMessage = messages.find(m => m.id === firstSelectedId);
    
    if (firstSelectedMessage) {
      // Generate smart tag suggestions based on the first selected message
      const suggestions = generateTagSuggestions(firstSelectedMessage);
      setSuggestedTags(suggestions);
    } else {
      setSuggestedTags([]);
    }
    
    // Show tag modal for selected messages
    setShowTagModal(true);
  };

  const handleSelectionDelete = () => {
    if (selectedMessages.size === 0) return;
    
    Alert.alert(
      'Delete Messages',
      `Are you sure you want to delete ${selectedMessages.size} message${selectedMessages.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Get all messages to find database IDs
              const dbMessages = await chatService.getUserMessages();
              
              // Delete each selected message
              for (const messageId of selectedMessages) {
                const message = messages.find(m => m.id === messageId);
                if (message) {
                  const dbMessage = dbMessages.find(msg => 
                    msg.content === message.content && 
                    msg.type === message.type &&
                    msg.file_url === message.url
                  );
                  
                  if (dbMessage) {
                    await chatService.deleteMessage(dbMessage.id);
                  }
                }
              }
              
              // Remove from local state
              setMessages(prev => prev.filter(msg => !selectedMessages.has(msg.id)));
              
              // Exit selection mode
              exitSelectionMode();
              
              Alert.alert('Success', `${selectedMessages.size} message${selectedMessages.size > 1 ? 's' : ''} deleted successfully`);
            } catch (error) {
              console.error('Error deleting selected messages:', error);
              Alert.alert('Error', 'Failed to delete messages. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Close context menu when tapping outside
  const closeContextMenu = () => {
    setShowContextMenu(false);
    setContextMenuMessage(null);
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
            setClearingMessages(true);
            setDeletingProgress(0);
            setDeletingText('Preparing to delete...');
            
            // Start spinning animation
            Animated.loop(
              Animated.timing(deleteSpinValue, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
              })
            ).start();
            
            try {
              const dbMessages = await chatService.getUserMessages();
              const totalMessages = dbMessages.length;
              
              if (totalMessages === 0) {
                setDeletingText('No messages to delete');
                setTimeout(() => {
                  setClearingMessages(false);
                  Alert.alert('Info', 'No messages to delete');
                }, 1000);
                return;
              }
              
              // Delete all messages from database with progress tracking
              for (let i = 0; i < dbMessages.length; i++) {
                const msg = dbMessages[i];
                const progressPercentage = ((i + 1) / totalMessages) * 100;
                
                setDeletingText(`Deleting message ${i + 1} of ${totalMessages}...`);
                setDeletingProgress(progressPercentage);
                
                await chatService.deleteMessage(msg.id);
                
                // Small delay to show progress animation
                await new Promise(resolve => setTimeout(resolve, 50));
              }
              
              setDeletingText('Finishing up...');
              setDeletingProgress(100);
              
              // Clear local state
              setMessages([]);
              
              // Small delay before hiding overlay
              await new Promise(resolve => setTimeout(resolve, 500));
              
              setClearingMessages(false);
              
              // Stop spinning animation
              deleteSpinValue.stopAnimation();
              deleteSpinValue.setValue(0);
              
              // Reset global flag and show welcome messages again
              globalWelcomeMessagesShown = false;
              showMessagesSequentially();
              
              Alert.alert('Success', 'All messages cleared successfully');
            } catch (error) {
              console.error('Error clearing messages:', error);
              setClearingMessages(false);
              setDeletingProgress(0);
              
              // Stop spinning animation on error
              deleteSpinValue.stopAnimation();
              deleteSpinValue.setValue(0);
              
              Alert.alert('Error', 'Failed to clear messages. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Get referenced content from database based on query
  const getReferencedContent = async (query: string) => {
    try {
      // Get all user messages from database
      const dbMessages = await chatService.getUserMessages();
      
      console.log('🔍 Total messages in database:', dbMessages.length);
      console.log('🔍 Query:', query);
      
      // Extract keywords from query for matching
      const keywords = query.toLowerCase().split(' ').filter(word => word.length > 3);
      console.log('🔍 Keywords:', keywords);
      
      // Find most relevant content based on query
      const relevantMessages = dbMessages.filter(msg => {
        if (!msg.extracted_text && !msg.extracted_title) return false;
        
        const searchText = (
          (msg.extracted_text || '') + ' ' + 
          (msg.extracted_title || '') + ' ' + 
          (msg.content || '')
        ).toLowerCase();
        
        return keywords.some(keyword => searchText.includes(keyword));
      });
      
      console.log('🔍 Relevant messages found:', relevantMessages.length);
      
      // Sort by relevance and recency
      const sortedMessages = relevantMessages.sort((a, b) => {
        const aDate = new Date(a.created_at).getTime();
        const bDate = new Date(b.created_at).getTime();
        return bDate - aDate; // Most recent first
      });
      
      // Get the most relevant message
      const mostRelevant = sortedMessages[0];
      
      if (mostRelevant) {
        let imageUrl: string | undefined;
        
        // Get appropriate image based on content type
        if (mostRelevant.type === 'link' && mostRelevant.file_url) {
          // For links, try to get the actual preview image
          try {
            const LinkPreviewService = await import('../services/link-preview');
            const linkPreviewService = LinkPreviewService.default.getInstance();
            const previewData = await linkPreviewService.generatePreview(mostRelevant.file_url);
            imageUrl = previewData.image;
          } catch (error) {
            console.log('Failed to get link preview image, using fallback');
            imageUrl = generatePreviewImage('article', new URL(mostRelevant.file_url).hostname);
          }
        } else if (mostRelevant.type === 'image' && mostRelevant.file_url) {
          // For images, use the actual image URL
          imageUrl = mostRelevant.file_url;
        } else if (mostRelevant.type === 'file' && mostRelevant.filename) {
          // For files, generate a document preview
          const fileExt = mostRelevant.filename.split('.').pop()?.toLowerCase() || 'document';
          const domain = 'Document';
          imageUrl = generatePreviewImage('document', domain);
        } else {
          // Fallback for other types
          imageUrl = generatePreviewImage('other', 'Content');
        }
        
        // Create a better title based on available data
        console.log('🔍 Referenced content data:', {
          extracted_title: mostRelevant.extracted_title,
          filename: mostRelevant.filename,
          content: mostRelevant.content?.substring(0, 100),
          type: mostRelevant.type,
          extracted_text: mostRelevant.extracted_text?.substring(0, 100)
        });
        
        let title = mostRelevant.extracted_title;
        if (!title && mostRelevant.filename) {
          // Remove file extension for cleaner display
          title = mostRelevant.filename.replace(/\.[^/.]+$/, '');
        }
        if (!title && mostRelevant.content) {
          // Use first line of content as title
          title = mostRelevant.content.split('\n')[0].substring(0, 50);
        }
        if (!title && mostRelevant.extracted_text) {
          // Use first line of extracted text as title
          title = mostRelevant.extracted_text.split('\n')[0].substring(0, 50);
        }
        if (!title) {
          title = mostRelevant.type === 'file' ? 'Document' :
                 mostRelevant.type === 'image' ? 'Image' :
                 mostRelevant.type === 'link' ? 'Web Page' : 'Content';
        }
        
        console.log('📝 Final title:', title);
        
        return {
          title: cleanDisplayTitle(title),
          description: mostRelevant.extracted_excerpt || mostRelevant.extracted_text?.substring(0, 150) || 'Content from your saved items',
          image: imageUrl,
          domain: mostRelevant.type === 'link' && mostRelevant.file_url ? new URL(mostRelevant.file_url).hostname : 
                 mostRelevant.type === 'file' ? 'Document' :
                 mostRelevant.type === 'image' ? 'Image' : 'Saved Content',
          url: mostRelevant.file_url || undefined,
        };
      }
      
      // Fallback: return most recent content if no keyword match
      const recentContent = dbMessages
        .filter(msg => msg.extracted_text || msg.extracted_title)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 1)[0];
      
      if (recentContent) {
        let imageUrl: string | undefined;
        
        // Get appropriate image based on content type
        if (recentContent.type === 'link' && recentContent.file_url) {
          // For links, try to get the actual preview image
          try {
            const LinkPreviewService = await import('../services/link-preview');
            const linkPreviewService = LinkPreviewService.default.getInstance();
            const previewData = await linkPreviewService.generatePreview(recentContent.file_url);
            imageUrl = previewData.image;
          } catch (error) {
            console.log('Failed to get link preview image, using fallback');
            imageUrl = generatePreviewImage('article', new URL(recentContent.file_url).hostname);
          }
        } else if (recentContent.type === 'image' && recentContent.file_url) {
          // For images, use the actual image URL
          imageUrl = recentContent.file_url;
        } else if (recentContent.type === 'file' && recentContent.filename) {
          // For files, generate a document preview
          const fileExt = recentContent.filename.split('.').pop()?.toLowerCase() || 'document';
          const domain = 'Document';
          imageUrl = generatePreviewImage('document', domain);
        } else {
          // Fallback for other types
          imageUrl = generatePreviewImage('other', 'Content');
        }
        
        // Create a better title based on available data
        console.log('🔍 Fallback referenced content data:', {
          extracted_title: recentContent.extracted_title,
          filename: recentContent.filename,
          content: recentContent.content?.substring(0, 100),
          type: recentContent.type,
          extracted_text: recentContent.extracted_text?.substring(0, 100)
        });
        
        let title = recentContent.extracted_title;
        if (!title && recentContent.filename) {
          // Remove file extension for cleaner display
          title = recentContent.filename.replace(/\.[^/.]+$/, '');
        }
        if (!title && recentContent.content) {
          // Use first line of content as title
          title = recentContent.content.split('\n')[0].substring(0, 50);
        }
        if (!title && recentContent.extracted_text) {
          // Use first line of extracted text as title
          title = recentContent.extracted_text.split('\n')[0].substring(0, 50);
        }
        if (!title) {
          title = recentContent.type === 'file' ? 'Document' :
                 recentContent.type === 'image' ? 'Image' :
                 recentContent.type === 'link' ? 'Web Page' : 'Content';
        }
        
        console.log('📝 Fallback final title:', title);
        
        return {
          title: title,
          description: recentContent.extracted_excerpt || recentContent.extracted_text?.substring(0, 150) || 'Content from your saved items',
          image: imageUrl,
          domain: recentContent.type === 'link' && recentContent.file_url ? new URL(recentContent.file_url).hostname : 
                 recentContent.type === 'file' ? 'Document' :
                 recentContent.type === 'image' ? 'Image' : 'Saved Content',
          url: recentContent.file_url || undefined,
        };
      }
      
      return undefined;
    } catch (error) {
      console.error('Error getting referenced content:', error);
      return undefined;
    }
  };

  // Ask AI about saved content with full database integration
  const askAIAboutContent = async (query: string) => {
    setAiLoading(true);
    try {
      // Use enhanced database-integrated content analysis
      const response = await openAIService.generateResponseWithDatabaseContext(query);
      
      // Get referenced content from the database
      const referencedContent = await getReferencedContent(query);
      
      // Create AI response message
      const aiMessage: Message = {
        id: generateUniqueId(),
        content: response,
        type: 'text',
        timestamp: getCurrentTimestamp(),
        isBot: true,
        referencedContent: referencedContent,
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

  // Update file sizes for existing messages
  const updateFileSizes = async () => {
    try {
      Alert.alert(
        'Update File Sizes',
        'This will update file sizes for existing documents. This may take a few minutes.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Update', 
            onPress: async () => {
              try {
                // Get all messages from database
                const dbMessages = await chatService.getUserMessages();
                const fileMessages = dbMessages.filter(msg => msg.type === 'file' && (!msg.file_size || msg.file_size === 0));
                
                if (fileMessages.length === 0) {
                  Alert.alert('Info', 'No messages need file size updates.');
                  return;
                }
                
                console.log(`📄 Found ${fileMessages.length} messages that need file size updates`);
                
                // For now, we'll just reload messages to get updated data
                // In the future, we could implement actual file size calculation
                await loadMessages();
                Alert.alert('Success', `Updated ${fileMessages.length} file messages.`);
              } catch (error) {
                console.error('Error updating file sizes:', error);
                Alert.alert('Error', 'Failed to update file sizes. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in update file sizes:', error);
    }
  };



  // Get emoji for tag - comprehensive emoji mapping
  const getEmojiForTag = (tag: string): string => {
    const t = (tag || '').toLowerCase().trim();
    
    // Comprehensive emoji mappings
    const mapping: Record<string, string> = {
      // Technology & AI
      'artificial intelligence': '🤖', 'ai': '🤖', 'machine learning': '🧠', 'web development': '💻',
      'technology': '💻', 'tech': '💻', 'software': '💻', 'programming': '👨‍💻',
      'innovation': '💡', 'innovative': '💡', 'startup': '🚀', 'digital': '📱',
      'automation': '⚙️', 'robotics': '🤖', 'coding': '💻', 'algorithm': '🔢',
      
      // Business & Finance
      'business': '📈', 'finance': '💰', 'investment': '📊', 'marketing': '📢',
      'startup': '🚀', 'entrepreneurship': '🚀', 'venture capital': '💰',
      
      // Education & Learning
      'education': '🎓', 'learning': '📚', 'tutorial': '📖', 'guide': '📋',
      'research': '🔬', 'study': '📝', 'course': '🎓',
      
      // News & Current Events
      'news': '📰', 'current events': '📰', 'politics': '🏛️', 'breaking news': '📰',
      
      // Health & Wellness
      'health': '🩺', 'fitness': '💪', 'nutrition': '🥗', 'wellness': '🌱',
      
      // Creative & Entertainment
      'art': '🎨', 'music': '🎵', 'entertainment': '🎭', 'gaming': '🎮',
      'photography': '📸', 'design': '🎨', 'creative': '🎨',
      
      // Lifestyle
      'travel': '✈️', 'food': '🍽️', 'cooking': '👨‍🍳', 'recipes': '🍳',
      'fashion': '👗', 'home': '🏠', 'lifestyle': '🌟',
      
      // Professional
      'career': '💼', 'job': '💼', 'workplace': '🏢', 'productivity': '⚡',
      
      // Content types
      'review': '⭐', 'analysis': '📊', 'opinion': '💭', 'tutorial': '📖',
      'tips': '💡', 'advice': '💡', 'how to': '🔧'
    };
    
    // Direct match
    if (mapping[t]) return mapping[t];
    
    // Pattern matching for common cases
    if (t.includes('ai') || t.includes('artificial')) return '🤖';
    if (t.includes('tech') || t.includes('software')) return '💻';
    if (t.includes('business') || t.includes('finance')) return '💰';
    if (t.includes('health') || t.includes('medical')) return '🩺';
    if (t.includes('education') || t.includes('learn')) return '🎓';
    if (t.includes('news') || t.includes('article')) return '📰';
    if (t.includes('travel') || t.includes('trip')) return '✈️';
    if (t.includes('food') || t.includes('recipe')) return '🍽️';
    if (t.includes('review') || t.includes('opinion')) return '⭐';
    
    return '';
  };

  // Generate smart tag suggestions based on content
  const generateTagSuggestions = (message: Partial<Message>): string[] => {
    if (!message) return [];
    
    const suggestions: string[] = [];
    
    if (message.type === 'image') {
      // For images, use AI-generated tags from the analysis
      // These will be provided by the FastImageAnalyzer in sendImageMessage
      // For now, return basic tags that will be replaced by AI analysis
      return ['AI Analysis...'];
    } else if (message.type === 'file') {
      const filename = message.filename?.toLowerCase() || '';
      
      // Extract meaningful keywords from filename
      const filenameWords = filename
        .replace(/\.[^/.]+$/, '') // Remove extension
        .split(/[-_\s]+/) // Split on dashes, underscores, spaces
        .filter(word => word.length > 2) // Only words longer than 2 chars
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)); // Capitalize

      suggestions.push(...filenameWords.slice(0, 3));
      
      // Add content-specific suggestions based on filename patterns
      if (filename.includes('invoice') || filename.includes('receipt') || filename.includes('bill')) {
        suggestions.push('Finance', 'Expenses');
      } else if (filename.includes('resume') || filename.includes('cv')) {
        suggestions.push('Career', 'JobSearch');
      } else if (filename.includes('recipe') || filename.includes('cooking')) {
        suggestions.push('Cooking', 'Recipes');
      } else if (filename.includes('manual') || filename.includes('guide')) {
        suggestions.push('Reference', 'Instructions');
      } else if (filename.includes('contract') || filename.includes('agreement')) {
        suggestions.push('Legal', 'Contracts');
      } else if (filename.includes('presentation') || filename.includes('slides')) {
        suggestions.push('Business', 'Presentation');
      } else if (filename.includes('report') || filename.includes('analysis')) {
        suggestions.push('Business', 'Report');
      } else if (filename.includes('photo') || filename.includes('image')) {
        suggestions.push('Photography', 'Visual');
      } else if (filename.includes('tax') || filename.includes('irs')) {
        suggestions.push('Tax', 'Finance');
      } else if (filename.includes('insurance') || filename.includes('policy')) {
        suggestions.push('Insurance', 'Legal');
      } else if (filename.includes('medical') || filename.includes('health')) {
        suggestions.push('Medical', 'Health');
      } else if (filename.includes('school') || filename.includes('education')) {
        suggestions.push('Education', 'Academic');
      } else if (filename.includes('travel') || filename.includes('trip')) {
        suggestions.push('Travel', 'Vacation');
      } else if (filename.includes('bank') || filename.includes('statement')) {
        suggestions.push('Banking', 'Finance');
      } else if (filename.includes('certificate') || filename.includes('diploma')) {
        suggestions.push('Certificate', 'Achievement');
      } else if (filename.includes('budget') || filename.includes('financial')) {
        suggestions.push('Budget', 'Finance');
      }
    } else if (message.type === 'link') {
      // Generate content-specific tags from actual article content
      if (message.linkPreview) {
        const { title, description, domain } = message.linkPreview;
        const combinedText = `${title || ''} ${description || ''}`;
        
        // Extract intelligent, content-specific keywords
        const contentKeywords = extractIntelligentKeywords(combinedText);
        suggestions.push(...contentKeywords);
        
        // Add industry/topic-specific tags based on content analysis
        const topicTags = analyzeContentForTopics(combinedText);
        suggestions.push(...topicTags);
        
        // Add platform-specific context that's meaningful
        if (domain) {
          const platformContext = getPlatformSpecificTags(domain, title || '');
          suggestions.push(...platformContext);
        }
        
        // Add content type tags based on domain and title
        const contentTypeTags = getContentTypeTags(domain, title, description);
        suggestions.push(...contentTypeTags);
      } else {
        // Fallback: extract from URL structure
        const url = message.url || '';
        const urlKeywords = extractUrlKeywords(url);
        suggestions.push(...urlKeywords);
      }
    }
    
    // Advanced filtering and ranking - return only 1 tag for autogenerated content
    const filteredSuggestions = filterAndRankSuggestions(suggestions);
    return filteredSuggestions.slice(0, 1); // Limit to 1 autogenerated tag
  };

  // Get content type tags based on domain and content
  const getContentTypeTags = (domain?: string, title?: string, description?: string): string[] => {
    const tags: string[] = [];
    const lowerTitle = (title || '').toLowerCase();
    const lowerDescription = (description || '').toLowerCase();
    const lowerDomain = (domain || '').toLowerCase();
    
    // News and media
    if (lowerDomain.includes('news') || lowerTitle.includes('news') || lowerDescription.includes('news')) {
      tags.push('News', 'Current Events');
    }
    
    // Technology
    if (lowerDomain.includes('tech') || lowerTitle.includes('technology') || lowerTitle.includes('software') || 
        lowerTitle.includes('app') || lowerTitle.includes('digital')) {
      tags.push('Technology', 'Digital');
    }
    
    // Business and finance
    if (lowerDomain.includes('business') || lowerDomain.includes('finance') || lowerTitle.includes('business') || 
        lowerTitle.includes('finance') || lowerTitle.includes('investment')) {
      tags.push('Business', 'Finance');
    }
    
    // Education and learning
    if (lowerDomain.includes('edu') || lowerDomain.includes('course') || lowerTitle.includes('learn') || 
        lowerTitle.includes('tutorial') || lowerTitle.includes('guide')) {
      tags.push('Education', 'Learning');
    }
    
    // Health and wellness
    if (lowerTitle.includes('health') || lowerTitle.includes('medical') || lowerTitle.includes('fitness') || 
        lowerTitle.includes('wellness')) {
      tags.push('Health', 'Wellness');
    }
    
    // Entertainment
    if (lowerTitle.includes('movie') || lowerTitle.includes('film') || lowerTitle.includes('music') || 
        lowerTitle.includes('game') || lowerTitle.includes('entertainment')) {
      tags.push('Entertainment');
    }
    
    // Travel
    if (lowerTitle.includes('travel') || lowerTitle.includes('trip') || lowerTitle.includes('vacation') || 
        lowerTitle.includes('destination')) {
      tags.push('Travel');
    }
    
    // Food and cooking
    if (lowerTitle.includes('recipe') || lowerTitle.includes('food') || lowerTitle.includes('cooking') || 
        lowerTitle.includes('restaurant')) {
      tags.push('Food', 'Cooking');
    }
    
    return tags;
  };

  // Extract intelligent, content-specific keywords
  const extractIntelligentKeywords = (text: string): string[] => {
    if (!text) return [];
    
    // Remove common articles, prepositions, and generic words
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'how', 'what', 'when', 'where', 'why', 'this', 'that', 'these', 'those',
      'from', 'into', 'about', 'also', 'can', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'have', 'has', 'had', 'been', 'being',
      'was', 'were', 'are', 'is', 'am', 'get', 'got', 'getting', 'gets',
      'make', 'makes', 'making', 'made', 'take', 'takes', 'taking', 'took',
      'come', 'comes', 'coming', 'came', 'go', 'goes', 'going', 'went',
      'see', 'sees', 'seeing', 'saw', 'look', 'looks', 'looking', 'looked',
      'use', 'uses', 'using', 'used', 'find', 'finds', 'finding', 'found',
      'give', 'gives', 'giving', 'gave', 'tell', 'tells', 'telling', 'told',
      'work', 'works', 'working', 'worked', 'call', 'calls', 'calling', 'called',
      'try', 'tries', 'trying', 'tried', 'ask', 'asks', 'asking', 'asked',
      'need', 'needs', 'needing', 'needed', 'feel', 'feels', 'feeling', 'felt',
      'seem', 'seems', 'seeming', 'seemed', 'leave', 'leaves', 'leaving', 'left',
      'put', 'puts', 'putting', 'keep', 'keeps', 'keeping', 'kept',
      'let', 'lets', 'letting', 'run', 'runs', 'running', 'ran',
      'move', 'moves', 'moving', 'moved', 'live', 'lives', 'living', 'lived',
      'believe', 'believes', 'believing', 'believed', 'bring', 'brings', 'bringing', 'brought',
      'happen', 'happens', 'happening', 'happened', 'write', 'writes', 'writing', 'wrote',
      'provide', 'provides', 'providing', 'provided', 'sit', 'sits', 'sitting', 'sat',
      'stand', 'stands', 'standing', 'stood', 'lose', 'loses', 'losing', 'lost',
      'pay', 'pays', 'paying', 'paid', 'meet', 'meets', 'meeting', 'met',
      'include', 'includes', 'including', 'included', 'continue', 'continues', 'continuing', 'continued',
      'set', 'sets', 'setting', 'follow', 'follows', 'following', 'followed',
      'stop', 'stops', 'stopping', 'stopped', 'create', 'creates', 'creating', 'created',
      'speak', 'speaks', 'speaking', 'spoke', 'read', 'reads', 'reading',
      'allow', 'allows', 'allowing', 'allowed', 'add', 'adds', 'adding', 'added',
      'spend', 'spends', 'spending', 'spent', 'grow', 'grows', 'growing', 'grew',
      'open', 'opens', 'opening', 'opened', 'walk', 'walks', 'walking', 'walked',
      'win', 'wins', 'winning', 'won', 'offer', 'offers', 'offering', 'offered',
      'remember', 'remembers', 'remembering', 'remembered', 'love', 'loves', 'loving', 'loved',
      'consider', 'considers', 'considering', 'considered', 'appear', 'appears', 'appearing', 'appeared',
      'buy', 'buys', 'buying', 'bought', 'wait', 'waits', 'waiting', 'waited',
      'serve', 'serves', 'serving', 'served', 'die', 'dies', 'dying', 'died',
      'send', 'sends', 'sending', 'sent', 'expect', 'expects', 'expecting', 'expected',
      'build', 'builds', 'building', 'built', 'stay', 'stays', 'staying', 'stayed',
      'fall', 'falls', 'falling', 'fell', 'cut', 'cuts', 'cutting',
      'reach', 'reaches', 'reaching', 'reached', 'kill', 'kills', 'killing', 'killed',
      'remain', 'remains', 'remaining', 'remained', 'suggest', 'suggests', 'suggesting', 'suggested',
      'raise', 'raises', 'raising', 'raised', 'pass', 'passes', 'passing', 'passed',
      'sell', 'sells', 'selling', 'sold', 'require', 'requires', 'requiring', 'required',
      'report', 'reports', 'reporting', 'reported', 'decide', 'decides', 'deciding', 'decided',
      'pull', 'pulls', 'pulling', 'pulled'
    ]);
    
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/) // Split on whitespace
      .filter(word => 
        word.length > 4 && // Only meaningful words
        word.length < 20 && // Avoid very long words
        !stopWords.has(word) && // Remove stop words
        !/^\d+$/.test(word) && // Remove pure numbers
        !/^(http|www|com|org|net|edu)/.test(word) // Remove web-related terms
      )
      .map(word => {
        // Capitalize and clean up
        return word.charAt(0).toUpperCase() + word.slice(1);
      });
    
    // Return unique words, prioritizing longer/more specific terms
    const uniqueWords = [...new Set(words)];
    return uniqueWords
      .sort((a, b) => b.length - a.length) // Prefer longer, more specific terms
      .slice(0, 3);
  };

  // Analyze content for topic-specific tags
  const analyzeContentForTopics = (text: string): string[] => {
    if (!text) return [];
    
    const lowerText = text.toLowerCase();
    const topics: string[] = [];
    
    // Technology topics
    if (lowerText.match(/\b(ai|artificial intelligence|machine learning|automation|robot|tech|software|app|code|programming|development|startup|innovation)\b/)) {
      topics.push('Technology');
    }
    
    // Business & Finance
    if (lowerText.match(/\b(business|entrepreneur|startup|invest|finance|money|economy|market|sales|revenue|profit|growth|strategy)\b/)) {
      topics.push('Business');
    }
    
    // Health & Wellness
    if (lowerText.match(/\b(health|wellness|fitness|nutrition|diet|exercise|medical|doctor|mental|therapy|meditation|sleep)\b/)) {
      topics.push('Wellness');
    }
    
    // Education & Learning
    if (lowerText.match(/\b(education|learning|study|course|tutorial|guide|teach|skill|knowledge|university|research)\b/)) {
      topics.push('Learning');
    }
    
    // Science & Research
    if (lowerText.match(/\b(science|research|study|experiment|discovery|analysis|data|climate|environment|space|physics|biology)\b/)) {
      topics.push('Science');
    }
    
    // Design & Creative
    if (lowerText.match(/\b(design|creative|art|visual|graphics|ui|ux|brand|aesthetic|photography|video)\b/)) {
      topics.push('Design');
    }
    
    // Productivity & Tools
    if (lowerText.match(/\b(productivity|efficiency|tool|workflow|organize|method|system|process|optimize|automation)\b/)) {
      topics.push('Productivity');
    }
    
    // News & Current Events
    if (lowerText.match(/\b(news|breaking|update|announcement|report|politics|government|policy|election|crisis)\b/)) {
      topics.push('News');
    }
    
    return topics.slice(0, 2); // Limit to 2 topic tags
  };

  // Get platform-specific contextual tags
  const getPlatformSpecificTags = (domain: string, title: string): string[] => {
    const tags: string[] = [];
    const lowerDomain = domain.toLowerCase();
    const lowerTitle = title.toLowerCase();
    
    if (lowerDomain.includes('youtube.com') || lowerDomain.includes('vimeo.com')) {
      if (lowerTitle.includes('tutorial') || lowerTitle.includes('how to')) {
        tags.push('Tutorial');
      } else if (lowerTitle.includes('review')) {
        tags.push('Review');
      } else {
        tags.push('Video');
      }
    } else if (lowerDomain.includes('github.com')) {
      tags.push('OpenSource');
    } else if (lowerDomain.includes('medium.com') || lowerDomain.includes('substack.com')) {
      tags.push('Article');
    } else if (lowerDomain.includes('stackoverflow.com')) {
      tags.push('Programming');
    } else if (lowerDomain.includes('linkedin.com')) {
      tags.push('Professional');
    } else if (lowerDomain.includes('reddit.com')) {
      tags.push('Discussion');
    } else if (lowerDomain.includes('twitter.com') || lowerDomain.includes('x.com')) {
      tags.push('Social');
    } else if (lowerDomain.includes('docs.google.com') || lowerDomain.includes('notion.so')) {
      tags.push('Document');
    } else if (lowerDomain.includes('figma.com') || lowerDomain.includes('dribbble.com')) {
      tags.push('Design');
    }
    
    return tags;
  };

  // Extract keywords from URL structure
  const extractUrlKeywords = (url: string): string[] => {
    if (!url) return [];
    
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname
        .split('/')
        .filter(part => part.length > 2 && !part.match(/^\d+$/))
        .map(part => part.replace(/[-_]/g, ' '))
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .slice(0, 2);
      
      return pathParts;
    } catch {
      return ['Link'];
    }
  };

  // Advanced filtering and ranking of suggestions
  const filterAndRankSuggestions = (suggestions: string[]): string[] => {
    // Remove duplicates and empty strings
    const unique = [...new Set(suggestions.filter(tag => tag && tag.length > 0))];
    
    // Score suggestions based on relevance
    const scored = unique.map(tag => ({
      tag,
      score: calculateTagRelevance(tag)
    }));
    
    // Sort by score and return tags
    return scored
      .sort((a, b) => b.score - a.score)
      .map(item => item.tag);
  };

  // Calculate relevance score for a tag
  const calculateTagRelevance = (tag: string): number => {
    let score = 0;
    
    // Prefer longer, more specific tags
    score += tag.length * 0.1;
    
    // Prefer tags that are not too generic
    const genericTags = ['Link', 'Article', 'Video', 'Document', 'Content', 'Post', 'Page'];
    if (!genericTags.includes(tag)) {
      score += 2;
    }
    
    // Prefer capitalized/proper nouns
    if (tag.charAt(0) === tag.charAt(0).toUpperCase()) {
      score += 1;
    }
    
    // Prefer tags with specific patterns
    if (tag.match(/^[A-Z][a-z]+$/)) { // Single capitalized word
      score += 1;
    }
    
    return score;
  };

  // Generate focused AI response based on specific message being replied to
  const generateFocusedReplyResponse = async (userQuestion: string, replyToMessage: Message): Promise<string> => {
    try {
      console.log('🎯 Generating focused reply for message type:', replyToMessage.type);
      console.log('🎯 Reply message details:', {
        id: replyToMessage.id,
        type: replyToMessage.type,
        url: replyToMessage.url,
        content: replyToMessage.content,
        linkPreview: replyToMessage.linkPreview
      });
      
      // Build focused context based on the specific message
      let focusedContext = `USER QUESTION: "${userQuestion}"\n\n`;
      focusedContext += `REPLYING TO SPECIFIC CONTENT:\n`;
      
      if (replyToMessage.type === 'image' && replyToMessage.url) {
        // For images, get the AI analysis from the database
        const dbMessages = await chatService.getUserMessages();
        const dbMessage = dbMessages.find(msg => 
          msg.file_url === replyToMessage.url && msg.type === 'image'
        );
        
        if (dbMessage && dbMessage.ai_analysis) {
          focusedContext += `IMAGE ANALYSIS:\n${dbMessage.ai_analysis}\n\n`;
          if (dbMessage.visual_description) {
            focusedContext += `VISUAL DESCRIPTION:\n${dbMessage.visual_description}\n\n`;
          }
        } else {
          focusedContext += `IMAGE: ${replyToMessage.content}\n\n`;
        }
      } else if (replyToMessage.type === 'link' && replyToMessage.url) {
        // For links, get extracted content from database
        const dbMessages = await chatService.getUserMessages();
        const dbMessage = dbMessages.find(msg => 
          msg.file_url === replyToMessage.url && msg.type === 'link'
        );
        
        if (dbMessage && dbMessage.extracted_text) {
          focusedContext += `LINK CONTENT:\n`;
          focusedContext += `Title: ${dbMessage.extracted_title || 'Unknown'}\n`;
          focusedContext += `URL: ${replyToMessage.url}\n`;
          
          // Truncate extracted text to prevent context length issues
          const maxTextLength = 8000; // Limit to ~2000 tokens
          const truncatedText = dbMessage.extracted_text.length > maxTextLength 
            ? dbMessage.extracted_text.substring(0, maxTextLength) + '\n\n[Content truncated for length. Full article available in your saved content.]'
            : dbMessage.extracted_text;
          
          focusedContext += `Full Text Content:\n${truncatedText}\n\n`;
        } else if (replyToMessage.linkPreview) {
          // Use link preview data if no database content
          focusedContext += `LINK CONTENT:\n`;
          focusedContext += `Title: ${replyToMessage.linkPreview.title || 'Unknown'}\n`;
          focusedContext += `Description: ${replyToMessage.linkPreview.description || 'No description'}\n`;
          focusedContext += `Domain: ${replyToMessage.linkPreview.domain || 'Unknown'}\n`;
          focusedContext += `URL: ${replyToMessage.url}\n\n`;
        } else {
          focusedContext += `LINK: ${replyToMessage.content}\nURL: ${replyToMessage.url}\n\n`;
        }
      } else if (replyToMessage.type === 'file' && replyToMessage.filename) {
        // For files, get extracted content from database
        const dbMessages = await chatService.getUserMessages();
        const dbMessage = dbMessages.find(msg => 
          msg.filename === replyToMessage.filename && msg.type === 'file'
        );
        
        if (dbMessage && dbMessage.extracted_text) {
          focusedContext += `DOCUMENT CONTENT:\n`;
          focusedContext += `Filename: ${replyToMessage.filename}\n`;
          focusedContext += `Title: ${dbMessage.extracted_title || 'Unknown'}\n`;
          
          // Truncate extracted text to prevent context length issues
          const maxTextLength = 8000; // Limit to ~2000 tokens
          const truncatedText = dbMessage.extracted_text.length > maxTextLength 
            ? dbMessage.extracted_text.substring(0, maxTextLength) + '\n\n[Content truncated for length. Full document available in your saved content.]'
            : dbMessage.extracted_text;
          
          focusedContext += `Full Text Content:\n${truncatedText}\n\n`;
        } else {
          focusedContext += `DOCUMENT: ${replyToMessage.filename}\nContent: ${replyToMessage.content}\n\n`;
        }
      } else {
        // For text messages
        focusedContext += `TEXT MESSAGE: ${replyToMessage.content}\n\n`;
      }
      
      // Add tags if available
      if (replyToMessage.tags && replyToMessage.tags.length > 0) {
        focusedContext += `TAGS: ${replyToMessage.tags.join(', ')}\n\n`;
      }
      
      focusedContext += `Answer the user's question based ONLY on the specific content above. Be specific and reference details from this exact content. If the question cannot be answered from this specific content, say so clearly.`;
      
      console.log('📝 Focused context length:', focusedContext.length);
      console.log('📝 Full focused context:', focusedContext);
      
      // Generate response using OpenAI service with focused context
      const systemPrompt = `You're Bill, a helpful AI assistant. Answer based ONLY on the specific content provided.

CRITICAL RULES:
- ONLY use information from the provided content
- If the answer isn't in the provided content, say "I don't have that specific information in this content"
- NEVER make up or guess information
- NEVER mention external knowledge

RESPONSE STYLE:
- Keep responses concise but thorough (2-4 sentences)
- Use casual, friendly tone
- Reference specific details from the provided content
- Be specific about what content you're looking at
- Provide enough detail to be helpful, but don't be verbose

EXAMPLES:
- "Based on this content, I can see that... This is important because..."
- "From this document, the main point is... The document also mentions..."
- "I don't have that specific information in this content"

Remember: Only use what's provided, be concise but helpful, and stay relevant.`;

      const response = await openAIService.generateFocusedResponse(systemPrompt, focusedContext);

      console.log('✅ Focused reply response generated');
      return response;
    } catch (error) {
      console.error('❌ Error generating focused reply response:', error);
      return "Sorry, I'm having trouble analyzing that specific content right now. Please try again.";
    }
  };

  useFocusEffect(
    useCallback(() => {
      console.log('🎯 Screen focused, reloading messages...');
      // Always reload messages when screen is focused to restore original chats
      setTimeout(() => {
        loadMessages();
      }, 100);
    }, [])
  );

  // Test Claude 3.5 Sonnet image analysis
  const testClaudeImageAnalysis = async () => {
    try {
      console.log('🧪 Testing Claude 3.5 Sonnet image analysis...');
      
      const FastImageAnalyzer = await import('../services/fast-image-analyzer');
      const analyzer = FastImageAnalyzer.default.getInstance();
      
      // Test basic analysis
      await analyzer.testAnalyzer();
      
      // Test database storage
      await analyzer.testDatabaseStorage();
      
      console.log('✅ Claude 3.5 Sonnet tests completed!');
    } catch (error) {
      console.error('❌ Claude 3.5 Sonnet test failed:', error);
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
        {selectionMode ? (
          <>
            <Text style={styles.selectionTitle}>Select</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={exitSelectionMode}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
              <Ionicons name="chevron-back" size={24} color="#000" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Chat</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={styles.clearButton} 
                onPress={() => {
                  router.push('/search');
                }}
              >
                <Ionicons name="search" size={20} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.clearButton} 
                onPress={() => {
                  console.log('🔄 Manual refresh triggered');
                  loadMessages();
                }}
              >
                <Ionicons name="refresh" size={20} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.clearButton} 
                onPress={clearAllMessages}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Welcome Message */}
      <View style={styles.welcomeContainer}>

        
        {/* No empty state image. Only show welcome text and action buttons for consistency. */}
      </View>

      {/* Messages */}
      <View style={styles.messagesContainer}>
        {/* Loading overlay for clearing messages */}
        {clearingMessages && (
          <View style={styles.clearingOverlay}>
            <View style={styles.clearingLoader}>
              <Animated.View style={[
                styles.clearingSpinner, 
                { 
                  transform: [{ 
                    rotate: deleteSpinValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg']
                    })
                  }] 
                }
              ]}>
                <Ionicons name="trash-outline" size={32} color="#FF3B30" />
              </Animated.View>
              <Text style={styles.clearingText}>{deletingText}</Text>
              <View style={styles.clearingProgress}>
                <Animated.View 
                  style={[
                    styles.clearingProgressBar,
                    {
                      width: `${deletingProgress}%`,
                      backgroundColor: deletingProgress === 100 ? '#34C759' : '#FF3B30'
                    }
                  ]} 
                />
              </View>
              <Text style={styles.clearingProgressText}>{Math.round(deletingProgress)}%</Text>
            </View>
          </View>
        )}
        
        {/* Loading overlay for loading messages */}
        {loadingMessages && (
          <View style={styles.loadingOverlay}>
            <View style={styles.messageLoadingLoader}>
              <Animated.View style={[
                styles.messageLoadingSpinner, 
                { 
                  transform: [{ 
                    rotate: deleteSpinValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg']
                    })
                  }] 
                }
              ]}>
                <Ionicons name="refresh" size={24} color="#007AFF" />
              </Animated.View>
              <Text style={styles.messageLoadingText}>Loading messages...</Text>
            </View>
          </View>
        )}
        
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
            <View key={`message-wrapper-${index}-${message.id}`}>
              <TouchableOpacity
              key={`message-${index}-${message.id}`}
              style={[
                styles.messageContainer, 
                message.isBot 
                  ? styles.botMessageContainer 
                  : (selectionMode ? styles.userMessageContainerSelection : styles.userMessageContainer),
                // Highlight the message when context menu is shown for this message
                showContextMenu && contextMenuMessage?.id === message.id && styles.messageHighlighted,
                // Blur all messages except the selected one when context menu is shown
                showContextMenu && contextMenuMessage?.id !== message.id && styles.messageBlurred
              ]}
              onLongPress={(event) => handleMessageLongPress(message, event)}
              onPress={() => {
                if (selectionMode && !message.isBot) {
                  toggleMessageSelection(message.id);
                }
              }}
              delayLongPress={500}
              activeOpacity={0.7}
            >
              {/* Selection circle for user messages when in selection mode */}
              {selectionMode && !message.isBot && (
                <View style={styles.selectionCircle}>
                  <TouchableOpacity 
                    style={[
                      styles.selectionCircleInner,
                      selectedMessages.has(message.id) && styles.selectionCircleSelected
                    ]}
                    onPress={() => toggleMessageSelection(message.id)}
                  >
                    {selectedMessages.has(message.id) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              )}
              
              {!message.isBot ? (
                <LinearGradient
                  colors={['#D0E1FF', '#B0CFFF']}
                  style={[styles.messageBubble, styles.userMessage]}
                >
                  {/* Show reply preview for user messages that are replies */}
                  {message.replyTo && (
                    <View style={styles.userReplyPreview}>
                      {/* Header with "Replying to" */}
                      <View style={styles.userReplyPreviewHeader}>
                        <Ionicons name="arrow-undo" size={12} color="#FFFFFF" />
                        <Text style={styles.userReplyPreviewLabel}>Replying to</Text>
                      </View>
                      
                      <View style={styles.userReplyPreviewContainer}>
                        {/* White bar on the left */}
                        <View style={styles.userReplyPreviewBar} />
                        
                        <View style={styles.userReplyPreviewContent}>
                          <View style={styles.userReplyPreviewTextContent}>
                            {message.replyTo.type === 'link' && message.replyTo.linkPreview ? (
                              <>
                                <Text style={styles.userReplyPreviewTitle} numberOfLines={1}>
                                  {message.replyTo.linkPreview.title || 'Link'}
                                </Text>
                                <Text style={styles.userReplyPreviewDomain}>
                                  {message.replyTo.linkPreview.domain || 'Link'}
                                </Text>
                              </>
                            ) : message.replyTo.type === 'file' ? (
                              <>
                                <Text style={styles.userReplyPreviewTitle} numberOfLines={1}>
                                  {message.replyTo.filename || 'Document'}
                                </Text>
                                <Text style={styles.userReplyPreviewDomain}>
                                  Document
                                </Text>
                              </>
                            ) : message.replyTo.type === 'image' ? (
                              <>
                                <Text style={styles.userReplyPreviewTitle} numberOfLines={1}>
                                  Image
                                </Text>
                                <Text style={styles.userReplyPreviewDomain}>
                                  Photo
                                </Text>
                              </>
                            ) : (
                              <>
                                <Text style={styles.userReplyPreviewTitle} numberOfLines={1}>
                                  {message.replyTo.content}
                                </Text>
                                <Text style={styles.userReplyPreviewDomain}>
                                  Message
                                </Text>
                              </>
                            )}
                          </View>
                          
                          {/* Image on the right */}
                          {message.replyTo.type === 'image' && message.replyTo.url && (
                            <Image 
                              source={{ uri: message.replyTo.url }} 
                              style={styles.userReplyPreviewImage}
                              resizeMode="cover"
                            />
                          )}
                          {message.replyTo.type === 'link' && message.replyTo.linkPreview?.image && (
                            <Image 
                              source={{ uri: message.replyTo.linkPreview.image }} 
                              style={styles.userReplyPreviewImage}
                              resizeMode="cover"
                            />
                          )}
                          {message.replyTo.type === 'file' && (
                            <View style={styles.userReplyPreviewFileIcon}>
                              <Ionicons name="document" size={16} color="#FFFFFF" />
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {message.type === 'link' && message.linkPreview ? (
                    <View style={styles.linkMessageContainer}>
                      {/* Image/Preview first */}
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
                        <Image 
                          source={message.linkPreview.image ? { 
                            uri: message.linkPreview.image,
                            headers: {
                              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
                            }
                          } : require('../assets/images/react-logo.png')} 
                          style={styles.linkPreviewImage}
                          resizeMode="cover"
                          onError={(error) => {
                            console.log('❌ Image load error for:', message.linkPreview?.image, error.nativeEvent.error);
                          }}
                          onLoad={() => {
                            console.log('✅ Image loaded successfully:', message.linkPreview?.image);
                          }}
                        />
                        <View style={styles.linkPreviewContent}>
                          <Text style={styles.linkPreviewTitle} numberOfLines={4}>
                            {cleanDisplayTitle(message.linkPreview.title) || 'Link'}
                          </Text>
                          <Text style={styles.linkPreviewDomain}>
                            {message.linkPreview.domain || 'Link'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      
                      {/* URL below the preview, underlined */}
                      <TouchableOpacity 
                        onPress={() => {
                          if (message.url) {
                            Linking.openURL(message.url);
                          }
                        }}
                        style={styles.linkUrlContainer}
                      >
                        <Text style={styles.linkUrlText}>
                          {message.url}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      {/* Only show text for non-image messages */}
                      {message.type !== 'image' && (
                        message.content === '...' && message.isBot ? (
                          <TypingIndicator />
                        ) : (
                          <Text style={[styles.messageText, styles.userMessageText]}>{message.content}</Text>
                        )
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
                      <View style={styles.fileIconContainer}>
                        <Ionicons name="document" size={24} color="#FF3B30" />
                      </View>
                      <View style={styles.fileInfoContainer}>
                        <Text style={styles.fileMessageText}>{message.filename}</Text>
                        <Text style={styles.fileDetailsText}>{getFileDetails(message)}</Text>
                      </View>
                    </View>
                  )}
                    </>
                  )}
                  
                  {/* Tags and timestamp inside the message bubble */}
                  <View style={styles.messageFooter}>
                    {/* Tags container that takes available space */}
                    <View style={styles.tagsContainer}>
                      {message.tags && message.tags.length > 0 && 
                        message.tags.map((tag, tagIndex) => (
                          <View key={`tag-${index}-${tagIndex}-${tag}`} style={styles.tagBadgeUser}>
                            <Text 
                              style={styles.tagTextUser}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {(() => {
                                // Check if tag already starts with an emoji
                                const startsWithEmoji = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u.test(tag);
                                if (startsWithEmoji) {
                                  return tag; // Tag already has emoji, return as-is
                                } else {
                                  const emoji = getTagEmoji(tag);
                                  return emoji ? `${emoji} ${tag}` : tag;
                                }
                              })()}
                            </Text>
                          </View>
                        ))
                      }
                    </View>
                    {/* Timestamp positioned absolutely */}
                    <View style={styles.timestampContainer}>
                      <Text style={styles.userTimestamp}>{message.timestamp}</Text>
                      {message.tags && message.tags.includes('starred') && (
                        <Ionicons name="star" size={12} color="#FFD700" style={{ marginLeft: 4 }} />
                      )}
                    </View>
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.messageBubble, styles.botMessage]}>
                  {/* Only show text for non-image messages */}
                  {message.type !== 'image' && (
                    message.content === '...' && message.isBot ? (
                      <TypingIndicator />
                    ) : (
                      <ClickableText 
                        text={message.content} 
                        style={[styles.messageText, styles.botMessageText]}
                      />
                    )
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
                      <View style={styles.fileIconContainer}>
                        <Ionicons name="document" size={24} color="#FF3B30" />
                      </View>
                      <View style={styles.fileInfoContainer}>
                        <Text style={styles.fileMessageText}>{message.filename}</Text>
                        <Text style={styles.fileDetailsText}>{getFileDetails(message)}</Text>
                      </View>
                    </View>
                  )}
                  
                  {/* Tags for bot messages (no timestamp) */}
                  {message.tags && message.tags.length > 0 && (
                    <View style={styles.messageFooter}>
                      {/* Tags container that takes available space */}
                      <View style={styles.tagsContainer}>
                        {message.tags.map((tag, tagIndex) => (
                          <View key={`tag-${index}-${tagIndex}-${tag}`} style={styles.tagBadgeBot}>
                            <Text style={styles.tagTextBot}>
                              {(() => {
                                // Check if tag already starts with an emoji
                                const startsWithEmoji = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u.test(tag);
                                if (startsWithEmoji) {
                                  return tag; // Tag already has emoji, return as-is
                                } else {
                                  const emoji = getTagEmoji(tag);
                                  return emoji ? `${emoji} ${tag}` : tag;
                                }
                              })()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {/* Show the actual content being referenced for replies */}
                  {message.isBot && message.replyTo && (
                    <View style={styles.referencedContentContainer}>
                      {message.replyTo.type === 'link' && message.replyTo.linkPreview ? (
                        <View style={styles.linkMessageContainer}>
                          <TouchableOpacity 
                            style={styles.linkPreview}
                            onPress={() => {
                              if (message.replyTo?.url) {
                                console.log('Opening link:', message.replyTo.url);
                                Linking.openURL(message.replyTo.url);
                              }
                            }}
                          >
                            <Image 
                              source={message.replyTo.linkPreview.image ? { 
                                uri: message.replyTo.linkPreview.image,
                                headers: {
                                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
                                }
                              } : require('../assets/images/react-logo.png')} 
                              style={styles.linkPreviewImage}
                              resizeMode="cover"
                            />
                            <View style={styles.linkPreviewContent}>
                              <Text style={styles.linkPreviewTitle} numberOfLines={4}>
                                {message.replyTo.linkPreview.title || 'Link'}
                              </Text>
                              <Text style={styles.linkPreviewDomain}>
                                {message.replyTo.linkPreview.domain || 'Link'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                          
                          {/* URL below the preview */}
                          <TouchableOpacity 
                            onPress={() => {
                              if (message.replyTo?.url) {
                                Linking.openURL(message.replyTo.url);
                              }
                            }}
                            style={styles.linkUrlContainer}
                          >
                            <Text style={styles.linkUrlText}>
                              {message.replyTo.url}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : message.replyTo.type === 'image' && message.replyTo.url ? (
                        <View style={styles.referencedImageContainer}>
                          <Image 
                            source={{ uri: message.replyTo.url }} 
                            style={styles.referencedImage}
                            resizeMode="cover"
                          />
                        </View>
                      ) : message.replyTo.type === 'file' ? (
                        <View style={styles.referencedFileContainer}>
                          <View style={styles.fileMessage}>
                            <Text style={styles.fileMessageText}>{message.replyTo.filename}</Text>
                            <Ionicons name="document" size={20} color="#666" />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              )}
              
              {/* Custom add tag button - positioned at bottom left of user messages with media */}
              {!selectionMode && !message.isBot && (message.type === 'image' || message.type === 'file' || message.type === 'link') && (
                <TouchableOpacity 
                  style={styles.addTagButtonBottomLeft}
                  onPress={() => handleAddTagToMessage(message)}
                >
                  <View style={styles.addTagButtonCircle}>
                    <Ionicons name="add" size={24} color="#3E3E3E" />
                  </View>
                </TouchableOpacity>
              )}
              
              {/* Remove the old tags and timestamp that were outside the bubble */}
            </TouchableOpacity>
            
            {/* Tag suggestions - show below this specific message */}
            {showTagSuggestions && currentMessageForTagging?.id === message.id && (
              <View style={styles.tagSuggestionsContent}>
                {/* Show existing AI tag (already applied/selected) */}
                {message.tags && message.tags.slice(0, 1).map((existingTag, index) => (
                  <TouchableOpacity
                    key={`existing-${index}`}
                    style={styles.tagSuggestionItemSelected}
                    onPress={() => {}} // Already selected, no action needed
                  >
                    <Text style={styles.tagSuggestionTextSelected}>
                      {(() => {
                        // Check if tag already starts with an emoji
                        const startsWithEmoji = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u.test(existingTag);
                        if (startsWithEmoji) {
                          return existingTag; // Tag already has emoji, return as-is
                        } else {
                          const emoji = getTagEmoji(existingTag);
                          return emoji ? `${emoji} ${existingTag}` : existingTag;
                        }
                      })()}
                    </Text>
                  </TouchableOpacity>
                ))}
                
                {/* Show exactly 1 additional AI-generated tag */}
                {suggestedTags.slice(0, 1).map((tag, index) => (
                  <TouchableOpacity
                    key={`suggestion-${index}`}
                    style={styles.tagSuggestionItem}
                    onPress={() => handleTagSuggestionSelect(tag)}
                  >
                    <Text style={styles.tagSuggestionText}>
                      {getTagEmoji(tag)} {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
                
                {/* Custom tag option - always at the end */}
                <TouchableOpacity
                  style={[styles.tagSuggestionItem, styles.customTagItem]}
                  onPress={handleCustomTagClick}
                >
                  <Text style={styles.customTagText}>+ Custom Tag</Text>
                </TouchableOpacity>
              </View>
            )}
            </View>
          ))}

        </ScrollView>
      </View>

      {/* Action Buttons - Only show when there are no user messages */}
      {messages.filter(msg => !msg.isBot).length === 0 && (
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





      {/* Selection Mode Bottom Bar */}
      {selectionMode && (
        <View style={styles.selectionBottomBar}>
          <Text style={styles.selectionCount}>
            {selectedMessages.size} Selected
          </Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity 
              style={styles.selectionActionButton}
              onPress={handleSelectionAddTag}
              disabled={selectedMessages.size === 0}
            >
              <Ionicons name="add" size={20} color="#007AFF" />
              <Text style={styles.selectionActionText}>Add tag</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.selectionActionButton}
              onPress={handleSelectionDelete}
              disabled={selectedMessages.size === 0}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[styles.selectionActionText, { color: '#FF3B30' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input Area */}
      {!selectionMode && (
        <SafeAreaContextView edges={['bottom']} style={styles.inputContainer}>
          {/* Link Preview Inside Input Container (WhatsApp-style) */}
          {(currentLinkPreview || linkPreviewLoading) && (
            <View style={styles.inputLinkPreviewContainer}>
              {linkPreviewLoading ? (
                <View style={styles.linkPreviewLoading}>
                  <Text style={styles.linkPreviewLoadingText}>🔗 Generating preview...</Text>
                </View>
              ) : currentLinkPreview ? (
                <View style={styles.inputLinkPreview}>
                  <TouchableOpacity 
                    style={styles.inputLinkPreviewCardContent}
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
                    <View style={styles.inputLinkPreviewContent}>
                      <Text style={styles.inputLinkPreviewTitle} numberOfLines={2}>
                        {currentLinkPreview.title}
                      </Text>
                      <Text style={styles.inputLinkPreviewDomain}>
                        {currentLinkPreview.domain}
                      </Text>
                    </View>
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
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          {/* Reply Preview Inside Input Container */}
          {replyPreview && (
            <View style={styles.replyPreviewContainer}>
              {/* Header with "Replying to" above everything */}
              <View style={styles.replyPreviewHeader}>
                <Ionicons name="arrow-undo" size={14} color="#007AFF" />
                <Text style={styles.replyPreviewLabel}>Replying to</Text>
              </View>
              
              <View style={styles.replyPreview}>
                {/* Blue bar on the left */}
                <View style={styles.replyPreviewBlueBar} />
                
                <TouchableOpacity 
                  style={styles.replyPreviewContent}
                  onPress={() => {
                    // Optional: Handle tap to scroll to original message
                  }}
                >
                  <View style={styles.replyPreviewTextContent}>
                    {replyPreview.type === 'link' && replyPreview.linkPreview ? (
                      <>
                        <Text style={styles.replyPreviewTitle} numberOfLines={1}>
                          {replyPreview.linkPreview.title || 'Link'}
                        </Text>
                        <Text style={styles.replyPreviewDomain}>
                          {replyPreview.linkPreview.domain || 'Link'}
                        </Text>
                      </>
                    ) : replyPreview.type === 'file' ? (
                      <>
                        <Text style={styles.replyPreviewTitle} numberOfLines={1}>
                          {replyPreview.filename || 'Document'}
                        </Text>
                        <Text style={styles.replyPreviewDomain}>
                          Document
                        </Text>
                      </>
                    ) : replyPreview.type === 'image' ? (
                      <>
                        <Text style={styles.replyPreviewTitle} numberOfLines={1}>
                          Image
                        </Text>
                        <Text style={styles.replyPreviewDomain}>
                          Photo
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.replyPreviewTitle} numberOfLines={1}>
                          {replyPreview.content}
                        </Text>
                        <Text style={styles.replyPreviewDomain}>
                          Message
                        </Text>
                      </>
                    )}
                  </View>
                  
                  {/* Image on the right */}
                  {replyPreview.type === 'image' && replyPreview.url && (
                    <Image 
                      source={{ uri: replyPreview.url }} 
                      style={styles.replyPreviewImage}
                      resizeMode="cover"
                    />
                  )}
                  {replyPreview.type === 'link' && replyPreview.linkPreview?.image && (
                    <Image 
                      source={{ uri: replyPreview.linkPreview.image }} 
                      style={styles.replyPreviewImage}
                      resizeMode="cover"
                    />
                  )}
                  {replyPreview.type === 'file' && (
                    <View style={styles.replyPreviewFileIcon}>
                      <Ionicons name="document" size={24} color="#666" />
                    </View>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.replyPreviewClose}
                  onPress={() => setReplyPreview(null)}
                >
                  <Ionicons name="close" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Upload Loading Indicator */}
          {uploading && (
            <View style={styles.uploadLoadingContainer}>
              <View style={styles.uploadLoadingContent}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.uploadLoadingText}>
                  {uploadingFileType === 'PDF' ? 'Processing PDF...' : 
                   uploadingFileType === 'image' ? 'Uploading image...' : 
                   uploadingFileType === 'document' ? 'Uploading document...' : 
                   'Uploading file...'}
                </Text>
              </View>
            </View>
          )}
          
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
      )}

      {/* Tag Modal - Bottom Sheet Style */}
      <Modal
        visible={showTagModal}
        animationType="slide"
        transparent={true}
        onRequestClose={cancelTagging}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity 
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
            onPress={cancelTagging}
          />
          <View style={styles.bottomSheetContent}>
            {/* Handle bar */}
            <View style={styles.bottomSheetHandle} />
            
            <View style={styles.bottomSheetHeader}>
                              <Text style={styles.bottomSheetTitle}>Add More Tags</Text>
              <TouchableOpacity onPress={finalizePendingMessage} style={styles.bottomSheetCloseButton}>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Tag input */}
            <View style={styles.bottomSheetTagInput}>
              <View style={styles.tagInputContainer}>
                <TextInput
                  style={styles.bottomSheetInput}
                  placeholder="Custom tag or note (max 30 chars)..."
                  value={currentTagInput}
                  onChangeText={(text) => {
                    // Limit to 30 characters
                    if (text.length <= 30) {
                      setCurrentTagInput(text);
                    }
                  }}
                  onSubmitEditing={handleTagInputSubmit}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={30}
                />
                <TouchableOpacity
                  style={[
                    styles.addTagButton,
                    !currentTagInput.trim() && { opacity: 0.5 }
                  ]}
                  onPress={handleTagInputSubmit}
                  disabled={!currentTagInput.trim()}
                >
                  <Text style={[
                    styles.addTagButtonText,
                    !currentTagInput.trim() && styles.addTagButtonTextDisabled
                  ]}>
                    Add
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.characterCounter}>
                {currentTagInput.length}/30 characters
              </Text>
            </View>

            {/* User Intent/Note Input */}


            {/* Suggestions Section */}
            {suggestedTags.length > 0 && (
              <View style={styles.suggestionsSection}>
                <Text style={styles.sectionTitle}>Suggestions</Text>
                <View style={styles.suggestionsGrid}>
                  {suggestedTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.suggestionTag,
                        selectedTags.includes(tag) && styles.suggestionTagSelected
                      ]}
                      onPress={() => addTag(tag)}
                    >
                      <Text style={[
                        styles.suggestionTagText,
                        selectedTags.includes(tag) && styles.suggestionTagTextSelected
                      ]}>
                        {getTagEmoji(tag)} {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* All Tags Section */}
            <View style={styles.allTagsSection}>
              <Text style={styles.sectionTitle}>All</Text>
              <View style={styles.allTagsGrid}>
                {predefinedTags.map((tag) => (
                  <TouchableOpacity
                    key={tag.name}
                    style={[
                      styles.allTag,
                      selectedTags.includes(tag.name) && styles.allTagSelected
                    ]}
                    onPress={() => addTag(tag.name)}
                  >
                    <Text style={[
                      styles.allTagText,
                      selectedTags.includes(tag.name) && styles.allTagTextSelected
                    ]}>
                      {tag.emoji} {tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Selected tags display */}
            {selectedTags.length > 0 && (
              <View style={styles.selectedTagsDisplay}>
                <Text style={styles.selectedTagsTitle}>Selected tags:</Text>
                <View style={styles.selectedTagsList}>
                  {selectedTags.map((tag) => (
                    <View key={tag} style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>{getTagEmoji(tag)} {tag}</Text>
                      <TouchableOpacity onPress={() => removeTag(tag)} style={styles.removeTagButton}>
                        <Text style={styles.removeTag}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

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
            <Text style={styles.deleteTitle}>Delete message?</Text>
            
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
                  <Text style={styles.deleteDeleteText}>Yes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>



      {/* Context Menu Modal */}
      <Modal
        visible={showContextMenu}
        animationType="fade"
        transparent={true}
        onRequestClose={closeContextMenu}
      >
        <TouchableOpacity 
          style={styles.contextMenuOverlay}
          activeOpacity={1}
          onPress={closeContextMenu}
        >
          <View 
            style={[
              styles.contextMenu,
              {
                top: Math.max(100, Math.min(contextMenuPosition.y + 20, 600)),
                left: Math.max(20, Math.min(contextMenuPosition.x + 10, 250))
              }
            ]}
          >
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleReply}>
              <Text style={styles.contextMenuText}>Reply</Text>
              <Image source={require('../assets/images/reply.png')} style={{ width: 20, height: 20 }} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleStar}>
              <Text style={styles.contextMenuText}>
                {contextMenuMessage?.tags?.includes('starred') ? 'Unstar' : 'Star'}
              </Text>
              <Ionicons 
                name={contextMenuMessage?.tags?.includes('starred') ? 'star' : 'star-outline'} 
                size={20} 
                color="#000" 
              />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleShare}>
              <Text style={styles.contextMenuText}>Share</Text>
              <Image source={require('../assets/images/export.png')} style={{ width: 20, height: 20 }} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleContextDelete}>
              <Text style={[styles.contextMenuText, { color: '#FF3B30' }]}>Delete</Text>
              <Image source={require('../assets/images/trash.png')} style={{ width: 20, height: 20 }} />
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.contextMenuItem, styles.contextMenuItemLast]} onPress={handleSelect}>
              <Text style={[styles.contextMenuText, { color: '#007AFF' }]}>Select</Text>
              <Ionicons name="checkmark-circle-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>


      
      </KeyboardAvoidingView>
    </RNSafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', // White background for everything above the header
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fefefe', // Updated background color for chat tab/header
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
  clearButtonDisabled: {
    opacity: 0.5,
  },
  loadingSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f3f5fc', // Match main chat area background
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
    backgroundColor: '#f3f5fc', // Main chat area background
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f3f5fc', // Main chat area background
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
    position: 'relative',
  },
  userMessageWithTag: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  userMessageContainerSelection: {
    alignItems: 'flex-end',
    marginLeft: 50, // Add space for selection circles
  },
  messageHighlighted: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)', // Light blue highlight
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  messageBlurred: {
    opacity: 0.3,
    filter: 'blur(2px)',
  },
  messageBubble: {
    width: 322.5,
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  botMessage: {
    backgroundColor: '#fff', // White for bot messages
    borderBottomLeftRadius: 4,
  },
  userMessage: {
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
    color: '#222', // Dark text for user messages
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  botTimestamp: {
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.06,
    color: '#6C6C6C',
    textAlign: 'right',
    alignSelf: 'flex-end',
    paddingRight: 8,
    minWidth: 80,
  },
  userTimestamp: {
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.06,
    color: '#6C6C6C',
    textAlign: 'right',
    alignSelf: 'flex-end',
    paddingRight: 4,
    minWidth: 70,
  },
  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  fileMessage: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    alignSelf: 'stretch',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#DCEAFF',
    marginTop: 8,
  },
  fileIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfoContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 6,
  },
  fileMessageText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  fileDetailsText: {
    fontSize: 14,
    color: '#666666',
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
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderTopWidth: 0,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginHorizontal: 16,
    marginBottom: 12,
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
    backgroundColor: '#fff', // Ensure input itself is white
    color: '#222', // Dark text for contrast
    borderRadius: 16,
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
    gap: 4,
    paddingTop: 6,
    flex: 1,
    paddingRight: 75, // Space for timestamp (reduced since we have more overall width)
    minWidth: 0, // Allow shrinking if needed
  },
  tagBadge: {
    minWidth: 60,
    height: 32,
    paddingTop: 6,
    paddingRight: 8,
    paddingBottom: 6,
    paddingLeft: 8,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tagBadgeBot: {
    height: 32,
    paddingTop: 6,
    paddingRight: 8,
    paddingBottom: 6,
    paddingLeft: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderColor: '#E0E0E0',
    flexShrink: 0,
    minWidth: 80, // Increased minimum width for longer tags
    maxWidth: 200, // Set reasonable maximum to prevent overflow
  },
  tagBadgeUser: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexShrink: 0,
    // Let content determine width naturally
  },
  tagText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4E4E4E', // Grey color, not bold
  },
  tagTextBot: {
    color: '#666666',
  },
  tagTextUser: {
    color: '#666666',
    fontSize: 14,
    flexShrink: 0,
    flexWrap: 'nowrap',
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
  uploadLoadingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F8FF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  uploadLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  uploadLoadingText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
    paddingHorizontal: 16,
  },
  tagInput: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    fontSize: 16,
  },
  addTagButtonContainer: {
    position: 'absolute',
    left: -40,
    top: 8,
    zIndex: 10,
  },
  addTagButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 6,
    minWidth: 50,
  },
  addTagButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  addTagButtonTextDisabled: {
    color: '#999',
  },
  characterCounter: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  bottomSheetIntentInput: {
    paddingHorizontal: 20,
    marginBottom: 24,
    alignItems: 'stretch',
  },
  intentInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  bottomSheetIntentTextInput: {
    borderWidth: 1,
    borderColor: '#EBF3FF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FAFBFF',
    color: '#000',
    textAlign: 'center',
  },
  addTagButtonLeft: {
    alignSelf: 'flex-start',
    marginRight: 8,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addTagButtonBottomLeft: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 40,
    height: 40,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  addTagButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    padding: 4,
    marginLeft: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  removeTag: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    paddingRight: 40,
    textAlign: 'center',
    minWidth: 20,
    minHeight: 20,
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  deleteContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  deleteTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 28,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deleteCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  deleteDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  deleteDeleteText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  deleteButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  linkPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 0,
    backgroundColor: '#fdfdfd',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginTop: 8,
    marginLeft: -7,
    height: 92,
    marginRight: -7,
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
  linkPreviewTouchable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  linkPreviewImage: {
    width: 80,
    height: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#f0f0f0',
    marginRight: 12,
  },
  linkPreviewContent: {
    flex: 1,
    padding: 12,
    paddingLeft: 0,
  },
  linkPreviewTitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#1a1a1a',
    marginBottom: 4,
    lineHeight: 18,
    letterSpacing: -0.08,
    fontFamily: 'SF Pro Text',
  },
  linkPreviewDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 18,
  },
  linkPreviewDomain: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6C6C6C',
    lineHeight: 13,
    letterSpacing: 0.06,
    fontFamily: 'SF Pro Text',
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
  aiLoadingAnimation: {
    width: 60,
    height: 60,
    alignSelf: 'center',
  },
  // Input link preview styles (WhatsApp-style)
  inputLinkPreviewContainer: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 20,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
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
    position: 'relative',
    marginHorizontal: 0,
    marginBottom: 0,
    backgroundColor: '#fdfdfd',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  inputLinkPreviewCardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 0,
    minHeight: 73,
    backgroundColor: '#fdfdfd',
    borderRadius: 12,
    marginHorizontal: 0,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputLinkPreviewImage: {
    width: 73,
    height: 73,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: '#d3d3d3',
    marginRight: 12,
  },
  inputLinkPreviewContent: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 40,
    paddingLeft: 0,
    justifyContent: 'center',
  },
  inputLinkPreviewTitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#1a1a1a',
    marginBottom: 4,
    lineHeight: 18,
    letterSpacing: -0.08,
    fontFamily: 'SF Pro Text',
  },
  inputLinkPreviewDomain: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6C6C6C',
    lineHeight: 13,
    letterSpacing: 0.06,
    fontFamily: 'SF Pro Text',
  },

  inputLinkPreviewClose: {
    position: 'absolute',
    top: '50%',
    right: 12,
    transform: [{ translateY: -11 }],
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    aspectRatio: 1,
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: '#6C6C6C',
    backgroundColor: '#FFFFFF',
  },
  // Context menu styles
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    position: 'absolute',
    display: 'flex',
    width: 172,
    flexDirection: 'column',
    alignItems: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#FAFAFC',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E7',
  },
  contextMenuText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000000',
    flex: 1,
  },
  contextMenuItemLast: {
    borderBottomWidth: 0,
  },
  // Selection mode styles
  selectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  // Selection circle styles
  selectionCircle: {
    position: 'absolute',
    left: -45,
    top: 10,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  selectionCircleInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  selectionCircleSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  // Selection bottom bar styles
  selectionBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  selectionActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionActionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
  // Reply preview styles
  replyPreviewContainer: {
    paddingTop: 0,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#ffffff',
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    shadowColor: '#808080',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  replyPreviewBlueBar: {
    width: 4,
    backgroundColor: '#007AFF',
  },
  replyPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingLeft: 12,
  },
  replyPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  replyPreviewLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#0065FF',
    lineHeight: 18,
    letterSpacing: -0.08,
    marginBottom: 4,
  },
  replyPreviewText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  replyPreviewType: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  replyPreviewClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    alignSelf: 'center',
    marginTop: 8,
  },
  // New reply preview styles for image-right layout (matching link preview)
  replyPreviewImage: {
    width: 70,
    height: 70,
    borderRadius: 2,
    marginLeft: 12,
    backgroundColor: '#f0f0f0',
  },
  replyPreviewFileIcon: {
    width: 70,
    height: 70,
    borderRadius: 2,
    marginLeft: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyPreviewTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replyPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    lineHeight: 18,
  },
  replyPreviewDomain: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500',
    textTransform: 'lowercase',
  },
  // Bot reply preview styles (for AI responses that are replies)
  botReplyPreview: {
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  botReplyPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  botReplyPreviewLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#007AFF',
    lineHeight: 14,
  },
  botReplyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    overflow: 'hidden',
  },
  botReplyPreviewBlueBar: {
    width: 3,
    backgroundColor: '#007AFF',
  },
  botReplyPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    paddingLeft: 8,
  },
  botReplyPreviewTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  botReplyPreviewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 1,
    lineHeight: 16,
  },
  botReplyPreviewDomain: {
    fontSize: 10,
    color: '#007AFF',
    fontWeight: '500',
  },
  botReplyPreviewImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: '#f0f0f0',
  },
  botReplyPreviewFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // User reply preview styles (for user messages that are replies)
  userReplyPreview: {
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  userReplyPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  userReplyPreviewLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 14,
    opacity: 0.9,
  },
  userReplyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  userReplyPreviewBar: {
    width: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.8,
  },
  userReplyPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    paddingLeft: 8,
  },
  userReplyPreviewTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  userReplyPreviewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 1,
    lineHeight: 16,
    opacity: 0.95,
  },
  userReplyPreviewDomain: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
    opacity: 0.8,
  },
  userReplyPreviewImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  userReplyPreviewFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Referenced content styles (for showing actual content in bot replies)
  referencedContentContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
  },
  referencedImageContainer: {
    marginTop: 8,
  },
  referencedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  referencedFileContainer: {
    marginTop: 8,
  },
  // Main content area for reply preview
  replyPreviewMainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  // Link message container styles
  linkMessageContainer: {
    marginTop: -10,
    borderRadius: 8,
  },
  linkUrlContainer: {
    marginTop: 4,
    paddingTop: 8,
  },
  linkUrlText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#080808',
    lineHeight: 18,
    letterSpacing: -0.08,
    fontFamily: 'SF Pro Text',
    textDecorationLine: 'underline',
  },
  // Typing indicator styles
  typingIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  typingText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  // Bottom sheet styles
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetBackdrop: {
    flex: 1,
  },
  bottomSheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingBottom: 34, // Safe area padding
    maxHeight: '80%',
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 25,
    letterSpacing: -0.45,
  },
  bottomSheetCloseButton: {
    padding: 8,
    backgroundColor: '#007AFF',
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
  bottomSheetTagInput: {
    paddingHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  bottomSheetInput: {
    width: 213,
    height: 44,
    paddingTop: 7,
    paddingRight: 16,
    paddingBottom: 7,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: '#EBF3FF',
    borderRadius: 100,
    fontSize: 16,
    backgroundColor: '#FDFDFD',
    color: '#111827',
  },
  suggestionsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionTag: {
    height: 32,
    paddingTop: 6,
    paddingRight: 12,
    paddingBottom: 6,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTagSelected: {
    backgroundColor: '#EBF3FF',
    borderColor: '#99C1FE',
  },
  suggestionTagText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  suggestionTagTextSelected: {
    color: '#1E40AF',
  },
  allTagsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  allTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allTag: {
    minHeight: 32,
    paddingTop: 6,
    paddingRight: 12,
    paddingBottom: 6,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: '#CCE0FE',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allTagSelected: {
    backgroundColor: '#EBF3FF',
    borderColor: '#99C1FE',
  },
  allTagText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  allTagTextSelected: {
    color: '#1E40AF',
  },
  selectedTagsDisplay: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  selectedTagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EBF8FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  selectedTagChipText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
    marginRight: 6,
  },
  removeTagChip: {
    padding: 2,
  },
  bottomSheetActions: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  bottomSheetSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
  },
  bottomSheetSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Clearing messages overlay styles
  clearingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(243, 245, 252, 0.95)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearingLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 200,
  },
  clearingSpinner: {
    marginBottom: 16,
  },
  clearingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 20,
    textAlign: 'center',
  },
  clearingProgress: {
    width: 150,
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  clearingProgressBar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FF3B30',
    borderRadius: 2,
  },
  clearingProgressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  // Loading messages overlay styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(243, 245, 252, 0.95)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageLoadingLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 200,
  },
  messageLoadingSpinner: {
    marginBottom: 16,
  },
  messageLoadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 2,
    position: 'relative',
    minHeight: 35, // Ensure enough height for tags
  },
  timestampContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 70, // Fixed width for timestamp
    backgroundColor: 'transparent',
  },
  // Tag suggestions inline styles
  tagSuggestionsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginHorizontal: 16,
  },
  tagSuggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.70)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagSuggestionItemSelected: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EAF2FE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99C1FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagSuggestionText: {
    fontSize: 15,
    color: '#171717',
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.23,
    fontFamily: 'SF Pro',
  },
  tagSuggestionTextSelected: {
    fontSize: 15,
    color: '#171717',
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.23,
    fontFamily: 'SF Pro',
  },
  customTagItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.70)',
    borderWidth: 0,
  },
  customTagText: {
    fontSize: 15,
    color: '#171717',
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.23,
    fontFamily: 'SF Pro',
  },
});

export default ChatScreen;
