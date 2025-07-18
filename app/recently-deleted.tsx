import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { ChatMessage } from '../config/supabase';
import DatabaseService from '../services/database';
import SupabaseAuthService from '../services/supabase-auth';

interface DeletedItem {
  id: string;
  title: string;
  type: 'text' | 'image' | 'file' | 'link';
  thumbnail?: string;
  deletedAt: string;
  originalData: ChatMessage;
}

const RecentlyDeleted = () => {
  const router = useRouter();
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    initializeUser();
  }, []);

  const initializeUser = async () => {
    try {
      const authService = SupabaseAuthService.getInstance();
      const user = await authService.getStoredUser();
      if (user) {
        setCurrentUserId(user.id);
        loadDeletedItems(user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      setLoading(false);
    }
  };

  const loadDeletedItems = async (userId: string) => {
    try {
      setLoading(true);
      const dbService = DatabaseService.getInstance();
      const deletedMessages = await dbService.getDeletedMessages(userId);
      
      const items: DeletedItem[] = deletedMessages.map(message => ({
        id: message.id,
        title: getItemTitle(message),
        type: message.type,
        thumbnail: getItemThumbnail(message),
        deletedAt: formatDeletedTime(message.deleted_at || ''),
        originalData: message
      }));
      
      setDeletedItems(items);
      setLoading(false);
    } catch (error) {
      console.error('Error loading deleted items:', error);
      setLoading(false);
    }
  };

  const getItemTitle = (message: ChatMessage): string => {
    if (message.filename) {
      return message.filename;
    }
    if (message.extracted_title) {
      return message.extracted_title;
    }
    if (message.content) {
      return message.content.length > 50 
        ? message.content.substring(0, 50) + '...'
        : message.content;
    }
    return 'Untitled Item';
  };

  const getItemThumbnail = (message: ChatMessage): string => {
    if (message.type === 'image' && message.file_url) {
      return message.file_url;
    }
    
    // Generate placeholder based on type
    switch (message.type) {
      case 'file':
        return 'https://via.placeholder.com/200x250/f0f0f0/666?text=📄+File';
      case 'image':
        return 'https://via.placeholder.com/200x250/34a853/fff?text=📷+Image';
      case 'link':
        return 'https://via.placeholder.com/200x250/4285f4/fff?text=🔗+Link';
      default:
        return 'https://via.placeholder.com/200x250/e0e0e0/666?text=📝+Text';
    }
  };

  const formatDeletedTime = (deletedAt: string): string => {
    if (!deletedAt) return 'Unknown';
    
    const now = new Date();
    const deleted = new Date(deletedAt);
    const diffMs = now.getTime() - deleted.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const toggleSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleRecover = async () => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      'Recover Items',
      `Are you sure you want to recover ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recover',
          onPress: async () => {
            try {
              const dbService = DatabaseService.getInstance();
              const selectedItemsArray = Array.from(selectedItems);
              
              // Recover each selected item
              const recoveryPromises = selectedItemsArray.map(itemId => 
                dbService.recoverMessage(itemId)
              );
              
              const results = await Promise.all(recoveryPromises);
              const successCount = results.filter(result => result).length;
              
              if (successCount > 0) {
                // Remove recovered items from deleted list
                setDeletedItems(prev => prev.filter(item => !selectedItems.has(item.id)));
                setSelectedItems(new Set());
                setSelectionMode(false);
                
                Alert.alert('Success', `${successCount} item${successCount > 1 ? 's' : ''} recovered successfully`);
              } else {
                Alert.alert('Error', 'Failed to recover items. Please try again.');
              }
            } catch (error) {
              console.error('Error recovering items:', error);
              Alert.alert('Error', 'Failed to recover items. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handlePermanentDelete = async () => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      'Permanently Delete',
      `Are you sure you want to permanently delete ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const dbService = DatabaseService.getInstance();
              const selectedItemsArray = Array.from(selectedItems);
              
              // Permanently delete each selected item
              const deletionPromises = selectedItemsArray.map(itemId => 
                dbService.permanentlyDeleteMessage(itemId)
              );
              
              const results = await Promise.all(deletionPromises);
              const successCount = results.filter(result => result).length;
              
              if (successCount > 0) {
                // Remove deleted items from list
                setDeletedItems(prev => prev.filter(item => !selectedItems.has(item.id)));
                setSelectedItems(new Set());
                setSelectionMode(false);
                
                Alert.alert('Success', `${successCount} item${successCount > 1 ? 's' : ''} permanently deleted`);
              } else {
                Alert.alert('Error', 'Failed to delete items. Please try again.');
              }
            } catch (error) {
              console.error('Error permanently deleting items:', error);
              Alert.alert('Error', 'Failed to delete items. Please try again.');
            }
          }
        }
      ]
    );
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'file':
        return '📄';
      case 'image':
        return '📷';
      case 'link':
        return '🔗';
      case 'text':
        return '📝';
      default:
        return '📄';
    }
  };

  const renderItem = (item: DeletedItem) => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.itemContainer,
        selectedItems.has(item.id) && styles.itemSelected
      ]}
      onPress={() => {
        if (selectionMode) {
          toggleSelection(item.id);
        }
      }}
      onLongPress={() => {
        if (!selectionMode) {
          setSelectionMode(true);
          toggleSelection(item.id);
        }
      }}
    >
      {/* Selection overlay */}
      {selectionMode && (
        <View style={styles.selectionOverlay}>
          <View style={[
            styles.selectionCircle,
            selectedItems.has(item.id) && styles.selectionCircleSelected
          ]}>
            {selectedItems.has(item.id) && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </View>
      )}

      {/* Item thumbnail */}
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: item.thumbnail }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.typeIndicator}>
          <Text style={styles.typeIcon}>{getItemIcon(item.type)}</Text>
        </View>
      </View>

      {/* Item info */}
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.deletedTime}>
          Deleted {item.deletedAt}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Recently Deleted</Text>
        
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => {
            if (selectionMode) {
              setSelectionMode(false);
              setSelectedItems(new Set());
            } else {
              setSelectionMode(true);
            }
          }}
        >
          <Text style={styles.selectButtonText}>
            {selectionMode ? 'Cancel' : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading deleted items...</Text>
          </View>
        ) : deletedItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trash-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Recently Deleted Items</Text>
            <Text style={styles.emptySubtitle}>
              Items you delete will appear here for 30 days before being permanently removed.
            </Text>
          </View>
        ) : (
          <View style={styles.itemsGrid}>
            {deletedItems.map(renderItem)}
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar when in selection mode */}
      {selectionMode && selectedItems.size > 0 && (
        <View style={styles.actionBar}>
          <Text style={styles.selectedCount}>
            {selectedItems.size} Item{selectedItems.size > 1 ? 's' : ''} Selected
          </Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.recoverButton}
              onPress={handleRecover}
            >
              <Text style={styles.recoverButtonText}>Recover</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handlePermanentDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  selectButton: {
    padding: 8,
  },
  selectButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 100,
  },
  itemContainer: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    overflow: 'hidden',
    position: 'relative',
  },
  itemSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCircleSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  thumbnailContainer: {
    position: 'relative',
    height: 120,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  typeIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeIcon: {
    fontSize: 12,
  },
  itemInfo: {
    padding: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    lineHeight: 18,
    marginBottom: 4,
  },
  deletedTime: {
    fontSize: 12,
    color: '#666',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  selectedCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  recoverButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  recoverButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FF3B30',
  },
});

export default RecentlyDeleted;
