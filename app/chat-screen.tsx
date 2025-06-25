import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
// import { initializeApp } from 'firebase/app';
// import { getStorage } from 'firebase/storage';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
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

interface Message {
  id: number;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: string;
  isBot: boolean;
  url?: string;
  filename?: string;
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
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Animation values for each message
  const messageAnimations = useRef<{ [key: number]: Animated.Value }>({});

  const initialMessages: Message[] = [
    {
      id: 1,
      content: "This is your space.",
      type: 'text',
      timestamp: "9:41 PM",
      isBot: true,
    },
    {
      id: 2,
      content: "Drop anything here, links, notes, PDFs, reminders. Bill makes it easy to find later.",
      type: 'text',
      timestamp: "9:41 PM",
      isBot: true,
    },
  ];

  useEffect(() => {
    setMessages(initialMessages);
  }, []);

  const showMessagesSequentially = () => {
    initialMessages.forEach((message, index) => {
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

        // Scroll to bottom after message appears
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, (index + 1) * 2000); // 2 second delay between messages
    });
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now(),
      content: inputText,
      type: 'text',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }),
      isBot: false,
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Scroll to bottom
    scrollViewRef.current?.scrollToEnd({ animated: true });
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
        
        // For now, just create a message without uploading to Firebase
        // You'll need to implement proper file upload logic based on your Firebase setup
        const newMessage: Message = {
          id: Date.now(),
          content: 'Image shared',
          type: 'image',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }),
          isBot: false,
          url: asset.uri,
        };

        setMessages(prev => [...prev, newMessage]);
        scrollViewRef.current?.scrollToEnd({ animated: true });
      } catch (error) {
        Alert.alert('Error', 'Failed to process image');
      } finally {
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

        // For now, just create a message without uploading to Firebase
        // You'll need to implement proper file upload logic based on your Firebase setup
        const newMessage: Message = {
          id: Date.now(),
          content: 'Document shared',
          type: 'file',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }),
          isBot: false,
          url: asset.uri,
          filename: asset.name,
        };

        setMessages(prev => [...prev, newMessage]);
        scrollViewRef.current?.scrollToEnd({ animated: true });
        setUploading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Chat Content */}
      <View style={styles.chatContainer}>
        {/* Welcome Message */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Welcome to bill 👋</Text>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map((message) => (
            <View key={message.id} style={[styles.messageContainer, message.isBot ? styles.botMessageContainer : styles.userMessageContainer]}>
              <View style={[styles.messageBubble, message.isBot ? styles.botMessage : styles.userMessage]}>
                <Text style={[styles.messageText, message.isBot ? styles.botMessageText : styles.userMessageText]}>{message.content}</Text>
                {message.type === 'image' && (
                  <Image source={{ uri: message.url }} style={styles.imageMessage} />
                )}
                {message.type === 'file' && (
                  <View style={styles.fileMessage}>
                    <Text style={styles.fileMessageText}>{message.filename}</Text>
                    <Ionicons name="document" size={20} color="#666" />
                  </View>
                )}
              </View>
              <Text style={[styles.timestamp, message.isBot ? styles.botTimestamp : styles.userTimestamp]}>{message.timestamp}</Text>
            </View>
          ))}
        </ScrollView>

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
  chatContainer: {
    flex: 1,
  },
  welcomeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
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
  messagesContent: {
    paddingBottom: 20,
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
});

export default ChatScreen;