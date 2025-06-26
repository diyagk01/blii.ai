import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
// import { initializeApp } from 'firebase/app';
// import { getStorage } from 'firebase/storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
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

interface Message {
  id: number;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: string;
  isBot: boolean;
  url?: string;
  filename?: string;
  tags?: string[];
}

// const firebaseConfig = {
//   apiKey: "YOUR_FIREBASE_API_KEY",
//   authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
//   projectId: "YOUR_FIREBASE_PROJECT_ID",
//   storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
//   messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
//   appId: "YOUR_FIREBASE_APP_ID"
// };

// const app = initializeApp(firebaseConfig);
// const storage = getStorage(app);

const ChatScreen = () => {
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Tag modal state
  const [showTagModal, setShowTagModal] = useState(false);
  const [currentTagInput, setCurrentTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [pendingMessage, setPendingMessage] = useState<Partial<Message> | null>(null);
  
  // Animation values for each message
  const messageAnimations = useRef<{ [key: number]: Animated.Value }>({});

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
      content: "This is your space.",
      type: 'text',
      timestamp: getCurrentTimestamp(),
      isBot: true,
    },
    {
      id: 2,
      content: "Drop anything here, links, notes, PDFs, reminders. Bill makes it easy to find later.",
      type: 'text',
      timestamp: getCurrentTimestamp(),
      isBot: true,
    },
  ];

  useEffect(() => {
    setMessages(getInitialMessages());
  }, []);

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
      }, (index + 1) * 2000); // 2 second delay between messages
    });
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now(),
      content: inputText,
      type: 'text',
      timestamp: getCurrentTimestamp(),
      isBot: false,
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Always scroll to bottom when user sends a message
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      try {
        setUploading(true);
        const asset = result.assets[0];
        
        // Create pending message for tagging
        const newMessage: Partial<Message> = {
          id: Date.now(),
          content: 'Image shared',
          type: 'image',
          timestamp: getCurrentTimestamp(),
          isBot: false,
          url: asset.uri,
        };

        setPendingMessage(newMessage);
        setShowTagModal(true);
      } catch (error) {
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
          id: Date.now(),
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

  const finalizePendingMessage = () => {
    if (pendingMessage) {
      const finalMessage: Message = {
        ...pendingMessage,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      } as Message;
      
      setMessages(prev => [...prev, finalMessage]);
      
      // Auto-scroll to new content
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
    
    // Reset modal state
    setShowTagModal(false);
    setSelectedTags([]);
    setCurrentTagInput('');
    setPendingMessage(null);
    setUploading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/home')}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Welcome Message */}
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeText}>Welcome to bill 👋</Text>
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
          {messages.map((message) => (
            <View key={message.id} style={[styles.messageContainer, message.isBot ? styles.botMessageContainer : styles.userMessageContainer]}>
              <View style={[styles.messageBubble, message.isBot ? styles.botMessage : styles.userMessage]}>
                <Text style={[styles.messageText, message.isBot ? styles.botMessageText : styles.userMessageText]}>{message.content}</Text>
                {message.type === 'image' && (
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
                {/* Display tags */}
                {message.tags && message.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {message.tags.map((tag, index) => (
                      <View key={index} style={[
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
            </View>
          ))}

        </ScrollView>
      </View>

      {/* Input Area */}
      <View style={styles.inputContainer}>
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
      </View>



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
  headerSpacer: {
    width: 34,
  },
  welcomeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
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
});

export default ChatScreen;