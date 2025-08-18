import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import EdgeCaseMessageComponent from '../components/EdgeCaseMessage';
import { ChatMessage } from '../config/supabase';
import ChatService from '../services/chat';
import EdgeCaseMessagingService, { EdgeCaseAction } from '../services/edge-case-messaging';
import { cleanDisplayTitle } from '../services/html-utils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MediaPreview() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [messageData, setMessageData] = useState<ChatMessage | null>(null);
  const [edgeCase, setEdgeCase] = useState<any>(null);
  const [isStarred, setIsStarred] = useState(false);
  const edgeCaseService = EdgeCaseMessagingService.getInstance();
  
  const { 
    type, 
    content, 
    title, 
    url, 
    imageUrl,
    summary,
    id
  } = params;

  const handleBack = () => {
    router.back();
  };

  const handleOpenChat = () => {
    // Navigate to chat screen, could pass media context if needed
    router.push('/chat');
  };

  const handleDelete = () => {
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
              if (id) {
                const chatService = ChatService.getInstance();
                await chatService.deleteMessage(id as string);
                console.log('✅ Item deleted successfully');
                router.back(); // Go back after deletion
              }
            } catch (error) {
              console.error('❌ Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    try {
      console.log('📤 Sharing item:', { type, url, title, content });
      
      let shareContent = '';
      let shareTitle = cleanDisplayTitle(title) || 'Shared from Blii';
      
      if (type === 'link' && url) {
        shareContent = `${shareTitle}\n\n${url}`;
        // Share the actual link
        await Share.share({
          message: shareContent,
          title: shareTitle,
          url: url as string,
        });
      } else if (type === 'file' && url) {
        // Share the actual file
        await Sharing.shareAsync(url as string, {
          mimeType: 'application/*',
          dialogTitle: shareTitle
        });
      } else if (type === 'image' && url) {
        // Share the actual image
        await Sharing.shareAsync(url as string, {
          mimeType: 'image/*',
          dialogTitle: shareTitle
        });
      } else {
        // Share text content
        shareContent = content || shareTitle;
        await Share.share({
          message: shareContent,
          title: shareTitle,
        });
      }
      
      console.log('📤 Content shared successfully');
    } catch (error) {
      console.error('❌ Error sharing item:', error);
      
      // Fallback to clipboard
      try {
        const Clipboard = require('expo-clipboard');
        let fallbackContent = '';
        
        if (type === 'link' && url) {
          fallbackContent = `${shareTitle}\n\n${url}`;
        } else if (type === 'file') {
          fallbackContent = `${shareTitle}\n\n${content || 'Document shared from Blii'}`;
        } else if (type === 'image') {
          fallbackContent = 'Image shared from Blii';
        } else {
          fallbackContent = content || shareTitle;
        }
        
        await Clipboard.setStringAsync(fallbackContent);
        Alert.alert(
          'Content Copied',
          'The content has been copied to your clipboard. You can now paste it in any app.',
          [{ text: 'OK' }]
        );
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        Alert.alert('Error', 'Failed to share item. Please try again.');
      }
    }
  };

  const handleStar = () => {
    setIsStarred(!isStarred);
    // Here you could also update the star status in the database
    console.log(isStarred ? '⭐ Item starred' : '☆ Item unstarred');
  };

  const handleEdgeCaseAction = (action: EdgeCaseAction) => {
    console.log('🎯 Edge case action triggered in media preview:', action.type, 'for message:', id);
    
    switch (action.type) {
      case 'note':
        router.push({
          pathname: '/chat',
          params: { 
            initialMessage: `Add note to this item`,
            focusedMessageId: id
          }
        });
        break;
        
      case 'tag':
        router.push({
          pathname: '/chat',
          params: { 
            initialMessage: `Tag this item`,
            focusedMessageId: id
          }
        });
        break;
        
      case 'reminder':
        router.push({
          pathname: '/chat',
          params: { 
            initialMessage: `Remind me about this`,
            focusedMessageId: id
          }
        });
        break;
        
      case 'open':
      case 'view':
        // Already in preview, could open in external app
        console.log('Already in preview mode');
        break;
        
      case 'organize':
        router.push({
          pathname: '/chat',
          params: { 
            initialMessage: `Organize this item`,
            focusedMessageId: id
          }
        });
        break;
        
      default:
        console.log('Unknown action type:', action.type);
    }
  };

  // Load message data and detect edge cases
  useEffect(() => {
    const loadMessageData = async () => {
      if (id) {
        try {
          const chatService = ChatService.getInstance();
          const messages = await chatService.getUserMessages(100);
          const message = messages.find(msg => msg.id === id);
          
          if (message) {
            setMessageData(message);
            
            // Check for edge cases
            const edgeCaseType = edgeCaseService.detectEdgeCase(message);
            if (edgeCaseType) {
              const edgeCaseMessage = edgeCaseService.getEdgeCaseMessage(edgeCaseType);
              setEdgeCase(edgeCaseMessage);
            }
          }
        } catch (error) {
          console.error('❌ Error loading message data for edge case detection:', error);
        }
      }
    };

    loadMessageData();
  }, [id]);

  const renderMediaContent = () => {
    switch (type) {
      case 'image':
        return (
          <View style={styles.mediaContainer}>
            <Image 
              source={{ uri: imageUrl as string || url as string }} 
              style={styles.fullImage}
              resizeMode="contain"
              onError={() => console.log('Failed to load image')}
            />
          </View>
        );
      
      case 'file':
        return (
          <View style={styles.mediaContainer}>
            <View style={styles.filePreview}>
              <Ionicons name="document-text" size={80} color="#666" />
              <Text style={styles.fileTitle}>{title || 'Document'}</Text>
              {summary && (
                <ScrollView style={styles.summaryContainer}>
                  <Text style={styles.summaryText}>{summary}</Text>
                </ScrollView>
              )}
              {content && (
                <ScrollView style={styles.contentContainer}>
                  <Text style={styles.contentText}>{content}</Text>
                </ScrollView>
              )}
            </View>
          </View>
        );
      
      case 'link':
        return (
          <View style={styles.mediaContainer}>
            <ScrollView style={styles.linkContainer}>
              {imageUrl && imageUrl !== '' ? (
                <Image 
                  source={{ uri: imageUrl as string }} 
                  style={styles.linkImage}
                  resizeMode="cover"
                  onError={() => console.log('Failed to load link image')}
                />
              ) : (
                <View style={styles.linkImagePlaceholder}>
                  <Text style={styles.linkImagePlaceholderText}>🔗</Text>
                  <Text style={styles.linkImagePlaceholderDomain}>{url}</Text>
                </View>
              )}
              <Text style={styles.linkTitle}>{cleanDisplayTitle(title) || 'Link'}</Text>
              {content && (
                <Text style={styles.linkContent}>{content}</Text>
              )}
              <TouchableOpacity 
                style={styles.urlButton}
                onPress={() => {
                  // Could implement opening URL in browser
                  console.log('Open URL:', url);
                }}
              >
                <Text style={styles.linkUrl}>{url}</Text>
                <Ionicons name="open-outline" size={16} color="#007AFF" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        );
      
      default:
        return (
          <View style={styles.mediaContainer}>
            <View style={styles.defaultPreview}>
              <Ionicons name="document" size={80} color="#666" />
              <Text style={styles.defaultTitle}>{cleanDisplayTitle(title) || 'Media Content'}</Text>
              {content && (
                <ScrollView style={styles.contentContainer}>
                  <Text style={styles.contentText}>{content}</Text>
                </ScrollView>
              )}
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview</Text>
        <TouchableOpacity onPress={handleOpenChat} style={styles.chatButton}>
          <Ionicons name="chatbubble-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity onPress={handleStar} style={styles.actionButton}>
          <Ionicons 
            name={isStarred ? "star" : "star-outline"} 
            size={20} 
            color={isStarred ? "#FFD700" : "#666"} 
          />
          <Text style={[styles.actionButtonText, { color: isStarred ? "#FFD700" : "#666" }]}>
            {isStarred ? "Starred" : "Star"}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
          <Ionicons name="share-outline" size={20} color="#007AFF" />
          <Text style={[styles.actionButtonText, { color: "#007AFF" }]}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          <Text style={[styles.actionButtonText, { color: "#FF3B30" }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Edge Case Message */}
      {edgeCase && (
        <EdgeCaseMessageComponent
          edgeCase={edgeCase}
          onActionPress={handleEdgeCaseAction}
          style={styles.edgeCaseMessage}
        />
      )}

      {/* Media Content */}
      {renderMediaContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  chatButton: {
    padding: 8,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  actionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    minWidth: 60,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  mediaContainer: {
    flex: 1,
    padding: 16,
  },
  fullImage: {
    width: screenWidth - 32,
    height: screenHeight - 200,
    borderRadius: 12,
  },
  filePreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fileTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    maxHeight: 200,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  linkContainer: {
    flex: 1,
  },
  linkImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  linkImagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkImagePlaceholderText: {
    fontSize: 40,
    marginBottom: 8,
  },
  linkImagePlaceholderDomain: {
    fontSize: 12,
    color: '#666',
  },
  linkTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#000',
  },
  linkContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    marginBottom: 16,
  },
  urlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  linkUrl: {
    fontSize: 12,
    color: '#007AFF',
    flex: 1,
    marginRight: 8,
  },
  defaultPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  defaultTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    maxHeight: 300,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  edgeCaseMessage: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
});
