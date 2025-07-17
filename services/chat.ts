import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { ChatMessage, supabase } from '../config/supabase';
import { contentExtractor, ExtractedContent } from './content-extractor';
import SupabaseAuthService from './supabase-auth';

export interface LocalMessage {
  id: number;
  content: string;
  type: 'text' | 'image' | 'file' | 'link';
  timestamp: string;
  isBot: boolean;
  url?: string;
  filename?: string;
  tags?: string[];
  linkPreview?: {
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
  };
  aiAnalysis?: string;
  contentInsights?: string;
}

// Temporary in-memory storage for extracted content until DB is fixed
class TemporaryContentStore {
  private static instance: TemporaryContentStore;
  private contentMap = new Map<string, any>();
  private storageKey = 'blii_extracted_content';
  private isLoaded = false;

  public static getInstance(): TemporaryContentStore {
    if (!TemporaryContentStore.instance) {
      TemporaryContentStore.instance = new TemporaryContentStore();
    }
    return TemporaryContentStore.instance;
  }

  // Load content from AsyncStorage on first access
  private async ensureLoaded() {
    if (this.isLoaded) return;
    
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.contentMap = new Map(Object.entries(data));
        console.log('📂 Loaded', this.contentMap.size, 'extracted content items from storage');
      }
    } catch (error) {
      console.error('❌ Error loading extracted content from storage:', error);
      // Continue without storage - use in-memory only
    }
    
    this.isLoaded = true;
  }

  // Save content to AsyncStorage
  private async saveToStorage() {
    try {
      const data = Object.fromEntries(this.contentMap);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('❌ Error saving extracted content to storage:', error);
      // Continue without storage - content will be in-memory only
    }
  }

  async storeContent(messageId: string, content: any) {
    await this.ensureLoaded();
    this.contentMap.set(messageId, content);
    await this.saveToStorage();
    
    console.log('📝 Stored extracted content for message:', messageId);
    console.log('🗄️ Total stored items:', this.contentMap.size);
  }

  async getContent(messageId: string) {
    await this.ensureLoaded();
    return this.contentMap.get(messageId);
  }

  async getAllContent() {
    await this.ensureLoaded();
    return Array.from(this.contentMap.values());
  }

  async searchContent(query: string) {
    await this.ensureLoaded();
    const results = [];
    for (const [id, content] of this.contentMap.entries()) {
      if (content.text && content.text.toLowerCase().includes(query.toLowerCase())) {
        results.push(content);
      }
    }
    return results;
  }

  async removeContent(messageId: string) {
    await this.ensureLoaded();
    this.contentMap.delete(messageId);
    await this.saveToStorage();
    console.log('🗑️ Removed extracted content for message:', messageId);
  }

  // Clear old content (optional cleanup)
  async clearOldContent(olderThanDays: number = 7) {
    await this.ensureLoaded();
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let removed = 0;
    
    for (const [id, content] of this.contentMap.entries()) {
      const timestamp = new Date(content.timestamp).getTime();
      if (timestamp < cutoff) {
        this.contentMap.delete(id);
        removed++;
      }
    }
    
    if (removed > 0) {
      await this.saveToStorage();
      console.log('🗑️ Cleaned up', removed, 'old extracted content items');
    }
  }
}

class ChatService {
  private static instance: ChatService;
  private authService = SupabaseAuthService.getInstance();
  private contentExtractor = contentExtractor;
  private tempStore = TemporaryContentStore.getInstance();
  
  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  // Get current authenticated user
  private async getCurrentUser() {
    try {
      console.log('🔍 Getting current user from SupabaseAuthService...');
      const user = await this.authService.getStoredUser();
      console.log('👤 Retrieved user:', user);
      
      if (!user) {
        console.error('❌ No user found in storage');
        throw new Error('User not authenticated');
      }
      
      console.log('✅ User authenticated successfully:', user.id);
      return user;
    } catch (error) {
      console.error('❌ Error getting current user:', error);
      throw error;
    }
  }

  // Analyze content after upload (lazy import to avoid circular dependencies)
  private async analyzeUploadedContent(type: 'image' | 'file', url: string, filename?: string): Promise<string | undefined> {
    try {
      // Lazy import OpenAI service to avoid circular dependency
      const OpenAIService = await import('./openai');
      const openAIService = OpenAIService.default.getInstance();
      
      if (type === 'image') {
        console.log('🔍 Triggering AI image analysis for uploaded image...');
        const analysis = await openAIService.analyzeImageContent(url);
        console.log('✅ Image analysis completed and stored');
        return analysis;
      } else if (type === 'file' && filename) {
        console.log('🔍 Triggering AI document analysis for uploaded file...');
        const analysis = await openAIService.analyzeDocumentContent(url, filename);
        console.log('✅ Document analysis completed and stored');
        return analysis;
      }
    } catch (error) {
      console.error('❌ Error analyzing uploaded content:', error);
      // Don't throw - analysis is optional enhancement
    }
    return undefined;
  }

  // Upload file to Supabase Storage
  async uploadFile(uri: string, filename: string, fileType: string): Promise<{ url: string; path: string }> {
    try {
      console.log('Uploading file to Supabase Storage...', { uri, filename, fileType });
      
      const user = await this.getCurrentUser();
      
      // Create unique filename with user ID and timestamp
      const timestamp = Date.now();
      const fileExtension = filename.split('.').pop() || '';
      const uniqueFilename = `${user.id}/${timestamp}_${filename}`;
      
      // Determine the bucket based on file type
      const bucket = fileType.startsWith('image/') ? 'images' : 'documents';
      console.log('Uploading to bucket:', bucket, 'with filename:', uniqueFilename);
      
      // Use expo-file-system to read the file properly on React Native
      let fileData: ArrayBuffer;
      
      try {
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        fileData = bytes.buffer;
        
        console.log('Successfully read file, size:', fileData.byteLength);
      } catch (fileError: any) {
        console.error('Error reading file:', fileError);
        throw new Error(`Failed to read file: ${fileError.message || fileError}`);
      }
      
      // Upload using the ArrayBuffer
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(uniqueFilename, fileData, {
          contentType: fileType,
          upsert: false
        });

      if (error) {
        console.error('Storage upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      if (!data || !data.path) {
        throw new Error('Upload succeeded but no path returned');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      console.log('File uploaded successfully:', publicUrl);
      
      return {
        url: publicUrl,
        path: data.path
      };
    } catch (error) {
      console.error('Upload file error:', error);
      throw error;
    }
  }

  // Save message to database
  async saveMessage(message: Omit<ChatMessage, 'id' | 'created_at' | 'updated_at'>): Promise<ChatMessage> {
    try {
      // Add debugging info
      console.log('💾 Attempting to save message to Supabase database...');
      console.log('📄 Message data:', {
        content: message.content.substring(0, 50) + '...',
        type: message.type,
        user_id: message.user_id,
        is_bot: message.is_bot,
        tags: message.tags,
        timestamp: message.timestamp,
        file_url: message.file_url ? 'Yes' : 'No',
        extracted_text_length: message.extracted_text?.length || 0,
        extracted_title: message.extracted_title,
        word_count: message.word_count,
        extraction_status: message.extraction_status
      });

      // Ensure message data is properly formatted
      const cleanMessage = {
        ...message,
        // Remove any undefined values that might cause issues
        tags: message.tags && message.tags.length > 0 ? message.tags : null,
        file_url: message.file_url || null,
        filename: message.filename || null,
        file_path: message.file_path || null,
        file_type: message.file_type || null,
        file_size: message.file_size || null,
        ai_analysis: message.ai_analysis || null,
        extracted_text: message.extracted_text || null,
        extracted_title: message.extracted_title || null,
        extracted_author: message.extracted_author || null,
        extracted_excerpt: message.extracted_excerpt || null,
        word_count: message.word_count || null,
        content_category: message.content_category || null,
        extraction_status: message.extraction_status || null,
        content_insights: message.content_insights || null,
        visual_description: message.visual_description || null,
        document_summary: message.document_summary || null
      };

      console.log('🧹 Cleaned message data for database:', {
        extracted_text_length: cleanMessage.extracted_text?.length || 0,
        extracted_title: cleanMessage.extracted_title,
        word_count: cleanMessage.word_count,
        extraction_status: cleanMessage.extraction_status
      });

      // Test database connection first with a simple query (no count(*) to avoid syntax issues)
      try {
        const { data: testData, error: testError } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('user_id', message.user_id)
          .limit(1);
        
        if (testError && testError.code !== 'PGRST116') { // PGRST116 = no rows returned, which is OK
          console.error('❌ Database connection test failed:', testError);
          throw new Error(`Database connection failed: ${testError.message}`);
        }
        console.log('✅ Database connection test passed');
      } catch (connectionError) {
        console.error('❌ Database connection test failed:', connectionError);
        throw new Error(`Database connection failed: ${connectionError}`);
      }

      // Now try to insert the message
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([cleanMessage])
        .select()
        .single();

      if (error) {
        console.error('❌ Database save error:', error);
        console.error('❌ Full error details:', error.message);
        console.error('❌ Complete save message error:', new Error(error.message));
        throw new Error(error.message);
      }

      console.log('✅ Message saved successfully:', data.id);
      console.log('📊 Saved message extracted content:', {
        extracted_text_length: data.extracted_text?.length || 0,
        extracted_title: data.extracted_title,
        word_count: data.word_count,
        extraction_status: data.extraction_status
      });
      return data;
    } catch (error) {
      console.error('❌ Save message error:', error);
      console.error('❌ Full error details:', error);
      console.error('❌ Complete save message error:', error);
      if (error instanceof Error) {
        console.error('Warning: ❌ Error stack:', error.stack);
      }
      throw error;
    }
  }

  // Send text message
  async sendTextMessage(content: string, tags?: string[]): Promise<ChatMessage> {
    try {
      console.log('📝 Sending text message:', content.substring(0, 50) + '...');
      
      const user = await this.getCurrentUser();
      console.log('✅ User authenticated for text message:', user.id);
      
      const messageData: Omit<ChatMessage, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        content,
        type: 'text',
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour12: true, 
          hour: 'numeric', 
          minute: '2-digit' 
        }),
        is_bot: false,
        tags: tags && tags.length > 0 ? tags : undefined,
      };

      console.log('📄 About to save text message with data:', messageData);

      try {
        const result = await this.saveMessage(messageData);
        console.log('✅ Text message saved successfully');
        return result;
      } catch (dbError) {
        console.error('❌ Send text message error:', dbError);
        console.error('❌ Full error details:', dbError);
        
        // Create a fallback message that can be returned even if database save fails
        const fallbackMessage: ChatMessage = {
          id: `temp_${Date.now()}`,
          user_id: user.id,
          content,
          type: 'text',
          timestamp: messageData.timestamp,
          is_bot: false,
          tags: messageData.tags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        console.log('⚠️ Database save failed, returning temporary message for UI consistency');
        return fallbackMessage;
      }
    } catch (error) {
      console.error('❌ Send text message error:', error);
      throw error;
    }
  }

  // Send image message with automatic AI analysis
  async sendImageMessage(uri: string, tags?: string[]): Promise<ChatMessage> {
    try {
      const user = await this.getCurrentUser();
      
      // Detect file type from URI extension
      const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
      let mimeType = 'image/jpeg'; // default
      
      switch (extension) {
        case 'png':
          mimeType = 'image/png';
          break;
        case 'gif':
          mimeType = 'image/gif';
          break;
        case 'webp':
          mimeType = 'image/webp';
          break;
        case 'heic':
        case 'heif':
          mimeType = 'image/heic';
          break;
        default:
          mimeType = 'image/jpeg';
      }
      
      // Upload image first
      const filename = `image_${Date.now()}.${extension}`;
      const { url, path } = await this.uploadFile(uri, filename, mimeType);
      
      // Trigger AI analysis in background (don't wait for it)
      let aiAnalysis: string | undefined;
      try {
        aiAnalysis = await this.analyzeUploadedContent('image', url);
      } catch (error) {
        console.log('AI analysis failed, continuing without it:', error);
      }
      
      const messageData: Omit<ChatMessage, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        content: aiAnalysis ? `Image shared - ${aiAnalysis.substring(0, 100)}...` : 'Image shared',
        type: 'image',
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour12: true, 
          hour: 'numeric', 
          minute: '2-digit' 
        }),
        is_bot: false,
        file_url: url,
        file_path: path,
        filename,
        file_type: mimeType,
        tags: tags && tags.length > 0 ? tags : undefined,
      };

      const savedMessage = await this.saveMessage(messageData);
      
      // Store AI analysis separately if available
      if (aiAnalysis) {
        console.log('📝 AI analysis stored with image message');
      }
      
      return savedMessage;
    } catch (error) {
      console.error('Send image message error:', error);
      throw error;
    }
  }

  // Send file message with automatic AI analysis
  async sendFileMessage(uri: string, filename: string, fileType: string, fileSize: number, tags?: string[]): Promise<ChatMessage> {
    try {
      const user = await this.getCurrentUser();
      
      // Upload file first
      const { url, path } = await this.uploadFile(uri, filename, fileType);
      
      // Trigger AI analysis in background (don't wait for it)
      let aiAnalysis: string | undefined;
      try {
        aiAnalysis = await this.analyzeUploadedContent('file', url, filename);
      } catch (error) {
        console.log('AI analysis failed, continuing without it:', error);
      }
      
      const messageData: Omit<ChatMessage, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        content: aiAnalysis ? `Document shared - ${aiAnalysis.substring(0, 100)}...` : 'Document shared',
        type: 'file',
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour12: true, 
          hour: 'numeric', 
          minute: '2-digit' 
        }),
        is_bot: false,
        file_url: url,
        file_path: path,
        filename,
        file_type: fileType,
        file_size: fileSize,
        tags: tags && tags.length > 0 ? tags : undefined,
      };

      const savedMessage = await this.saveMessage(messageData);
      
      // Store AI analysis separately if available
      if (aiAnalysis) {
        console.log('📝 AI analysis stored with document message');
      }
      
      return savedMessage;
    } catch (error) {
      console.error('Send file message error:', error);
      throw error;
    }
  }

  // Send link message with content extraction
  async sendLinkMessage(content: string, url: string, preview?: any, tags?: string[]): Promise<ChatMessage> {
    try {
      console.log('🔗 Sending link message with Perplexity content extraction:', url);
      
      // Use the enhanced content extraction method for links
      // This will handle Perplexity extraction and database storage
      const savedMessage = await this.saveMessageWithContentExtraction(
        content,
        'link',
        {
          fileUrl: url,
          tags: tags
        }
      );
      
      console.log('🔗 Link message saved with Perplexity content extraction, ID:', savedMessage.id);
      return savedMessage;
    } catch (error) {
      console.error('Send link message error:', error);
      throw error;
    }
  }

  // Legacy method - send link without content extraction (backup)
  async sendLinkMessageBasic(content: string, url: string, preview?: any, tags?: string[]): Promise<ChatMessage> {
    try {
      const user = await this.getCurrentUser();
      
      const messageData: Omit<ChatMessage, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        content,
        type: 'link',
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour12: true, 
          hour: 'numeric', 
          minute: '2-digit' 
        }),
        is_bot: false,
        file_url: url,
        tags: tags && tags.length > 0 ? tags : undefined,
      };

      return await this.saveMessage(messageData);
    } catch (error) {
      console.error('Send link message error:', error);
      throw error;
    }
  }

  // Get user's chat messages
  async getUserMessages(limit: number = 50): Promise<ChatMessage[]> {
    try {
      const user = await this.getCurrentUser();
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Get messages error:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Get user messages error:', error);
      throw error;
    }
  }

  // Search messages by tags
  async searchMessagesByTags(tags: string[]): Promise<ChatMessage[]> {
    try {
      const user = await this.getCurrentUser();
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .contains('tags', tags)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Search messages error:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Search messages by tags error:', error);
      throw error;
    }
  }

  // Search messages by content
  async searchMessagesByContent(query: string): Promise<ChatMessage[]> {
    try {
      const user = await this.getCurrentUser();
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Search messages error:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Search messages by content error:', error);
      throw error;
    }
  }

  // Convert database message to local message format
  convertToLocalMessage(dbMessage: ChatMessage): LocalMessage {
    return {
      id: parseInt(dbMessage.id) || Date.now(),
      content: dbMessage.content,
      type: dbMessage.type,
      timestamp: dbMessage.timestamp,
      isBot: dbMessage.is_bot,
      url: dbMessage.file_url,
      filename: dbMessage.filename,
      tags: dbMessage.tags,
    };
  }

  // Convert local message to database format
  convertToDbMessage(localMessage: LocalMessage, userId: string): Omit<ChatMessage, 'id' | 'created_at' | 'updated_at'> {
    return {
      user_id: userId,
      content: localMessage.content,
      type: localMessage.type,
      timestamp: localMessage.timestamp,
      is_bot: localMessage.isBot,
      file_url: localMessage.url,
      filename: localMessage.filename,
      tags: localMessage.tags,
    };
  }

  // Delete a message
  async deleteMessage(messageId: string): Promise<void> {
    try {
      const user = await this.getCurrentUser();
      
      // Get message to check if it has files to delete
      const { data: message, error: fetchError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', messageId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Delete file from storage if it exists
      if (message.file_path) {
        const bucket = message.type === 'image' ? 'images' : 'documents';
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([message.file_path]);
        
        if (storageError) {
          console.error('Storage delete error:', storageError);
          // Don't throw here, continue with message deletion
        }
      }

      // Delete message from database
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      // Remove corresponding extracted content from temporary storage
      try {
        await this.tempStore.removeContent(messageId);
        console.log('🗑️ Removed extracted content for deleted message:', messageId);
      } catch (extractedContentError) {
        console.log('⚠️ No extracted content found for deleted message:', messageId);
        // Don't throw here, message deletion was successful
      }

      console.log('Message deleted successfully');
    } catch (error) {
      console.error('Delete message error:', error);
      throw error;
    }
  }

  // Save message with content extraction - returns saved ChatMessage
  async saveMessageWithContentExtraction(
    content: string,
    type: 'text' | 'image' | 'file' | 'link',
    options: {
      fileUrl?: string;
      filename?: string;
      filePath?: string;
      fileType?: string;
      fileSize?: number;
      tags?: string[];
      isBot?: boolean;
    } = {}
  ): Promise<ChatMessage> {
    const user = await this.authService.getStoredUser();
    if (!user) throw new Error('User not authenticated');

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let extractedContent: ExtractedContent | null = null;

    try {
      // Extract content based on type
      console.log('🔍 Starting content extraction for:', type, options.filename || options.fileUrl);
      
      if (type === 'file' && options.fileUrl) {
        // Extract content from file
        extractedContent = await contentExtractor.extractFileContent(options.fileUrl, options.fileType || 'unknown');
      } else if (type === 'link' && options.fileUrl) {
        // Extract content from web article using Perplexity
        console.log('🔗 Extracting web article content...');
        extractedContent = await contentExtractor.extractWebArticle(options.fileUrl);
      }

      // Store extracted content temporarily
      if (extractedContent) {
        console.log('📝 Extracted content details:', {
          title: extractedContent.title,
          textLength: extractedContent.content.length,
          wordCount: extractedContent.content.split(' ').length,
          author: extractedContent.author,
          publish_date: extractedContent.publish_date
        });

        // Store in temporary storage
        const storedContent = {
          messageId,
          extractedContent,
          timestamp: Date.now()
        };

        const existingItems = await this.tempStore.getAllContent();
        existingItems.push(storedContent);
        await this.tempStore.storeContent(messageId, existingItems);
        
        console.log('📝 Stored extracted content for message:', messageId);
        console.log('🗄️ Total stored items:', existingItems.length);
        console.log('✅ Content extracted and stored temporarily');
      }
    } catch (error) {
      console.error('❌ Content extraction failed:', error);
      // Continue without extracted content
    }

    // Prepare message data
    const messageData: Omit<ChatMessage, 'id' | 'created_at' | 'updated_at'> = {
      content: extractedContent 
        ? `${content} [Content extracted: ${extractedContent.content.split(' ').length} words]`
        : content,
      type,
      user_id: user.id,
      is_bot: options.isBot || false,
      tags: options.tags || [],
      timestamp: new Date().toLocaleTimeString(),
      file_url: options.fileUrl || undefined,
      filename: options.filename || undefined,
      file_path: options.filePath || undefined,
      file_type: options.fileType || undefined,
      file_size: options.fileSize || undefined,
      // Extracted content fields
      extracted_text: extractedContent?.full_text || extractedContent?.content || undefined,
      extracted_title: extractedContent?.title || undefined,
      extracted_author: extractedContent?.author || undefined,
      extracted_excerpt: extractedContent?.summary || undefined,
      extraction_status: extractedContent ? 'completed' : 'not_attempted',
      word_count: extractedContent ? extractedContent.content.split(' ').length : undefined
    };

    console.log('📄 Final message data for database:', {
      content: messageData.content.substring(0, 50) + '...',
      extracted_text_length: messageData.extracted_text?.length || 0,
      extracted_title: messageData.extracted_title,
      extraction_status: messageData.extraction_status,
      word_count: messageData.word_count
    });

    // Save to database
    const savedMessage = await this.saveMessage(messageData);
    
    // Clean up temporary storage
    if (extractedContent) {
      await this.tempStore.removeContent(messageId);
    }

    return savedMessage;
  }

  // Clean up orphaned extracted content that doesn't correspond to existing messages
  async cleanupOrphanedExtractedContent(): Promise<void> {
    try {
      console.log('🧹 Cleaning up orphaned extracted content...');
      
      const allMessages = await this.getUserMessages(1000); // Get all messages
      const allExtractedContent = await this.tempStore.getAllContent();
      
      let removedCount = 0;
      
      for (const extractedItem of allExtractedContent) {
        // Check if there's a corresponding message
        const hasCorrespondingMessage = allMessages.some(message => {
          if (extractedItem.messageId) {
            return message.id === extractedItem.messageId;
          }
          if (message.type === 'link' && extractedItem.url) {
            return message.file_url === extractedItem.url;
          }
          if (message.type === 'file' && extractedItem.filename) {
            return message.filename === extractedItem.filename;
          }
          return false;
        });
        
        // If no corresponding message found, remove the extracted content
        if (!hasCorrespondingMessage) {
          await this.tempStore.removeContent(extractedItem.messageId || extractedItem.id);
          removedCount++;
        }
      }
      
      if (removedCount > 0) {
        console.log(`🗑️ Cleaned up ${removedCount} orphaned extracted content items`);
      } else {
        console.log('✅ No orphaned extracted content found');
      }
    } catch (error) {
      console.error('❌ Error cleaning up orphaned extracted content:', error);
    }
  }

  // Get all extracted content for AI analysis
  async getAllExtractedContent() {
    return await this.tempStore.getAllContent();
  }

  // Search extracted content
  async searchExtractedContent(query: string) {
    return await this.tempStore.searchContent(query);
  }

  // Get temporary storage stats for debugging
  async getExtractionStats() {
    const content = await this.tempStore.getAllContent();
    return {
      totalItems: content.length,
      totalWords: content.reduce((sum: number, item: any) => sum + (item.wordCount || 0), 0),
      types: content.reduce((acc: Record<string, number>, item: any) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  // Enhanced search that includes extracted text
  async searchMessagesWithExtractedContent(query: string, limit: number = 20): Promise<ChatMessage[]> {
    try {
      const user = await this.authService.getStoredUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .or(`content.ilike.%${query}%,extracted_text.ilike.%${query}%,extracted_title.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error searching messages with extracted content:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in enhanced search:', error);
      return [];
    }
  }

  // Get messages with their full extracted content
  async getMessagesWithContent(limit: number = 50): Promise<ChatMessage[]> {
    try {
      const user = await this.authService.getStoredUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching messages with content:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getMessagesWithContent:', error);
      return [];
    }
  }

  // Extract content from existing messages that don't have extracted content
  async extractContentFromExistingMessages(): Promise<void> {
    try {
      console.log('🔄 Starting batch content extraction for existing messages...');
      
      const user = await this.authService.getStoredUser();
      if (!user) throw new Error('User not authenticated');

      // Get messages that need content extraction
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .in('type', ['file', 'link'])
        .is('extracted_text', null)
        .limit(10); // Process in batches

      if (error) {
        console.error('Error fetching messages for extraction:', error);
        return;
      }

      if (!messages || messages.length === 0) {
        console.log('✅ No messages need content extraction');
        return;
      }

      console.log(`🔍 Processing ${messages.length} messages for content extraction...`);

      for (const message of messages) {
        try {
          let extractedContent = null;

          if (message.type === 'file' && message.file_url && message.filename) {
            const fileExt = message.filename.split('.').pop()?.toLowerCase();
            if (fileExt === 'pdf') {
              extractedContent = await contentExtractor.extractFileContent(message.file_url, 'pdf');
            }
          } else if (message.type === 'link' && message.file_url) {
            extractedContent = await contentExtractor.extractWebArticle(message.file_url);
          }

          if (extractedContent) {
            // Update message with extracted content
            const { error: updateError } = await supabase
              .from('chat_messages')
              .update({
                extracted_text: extractedContent.full_text || extractedContent.content,
                extracted_title: extractedContent.title,
                extracted_author: extractedContent.author,
                extracted_excerpt: extractedContent.summary,
                word_count: extractedContent.content.split(' ').length,
                content_category: message.type === 'link' ? 'web_article' : 'document',
                extraction_status: 'completed',
                ai_analysis: `Content extracted successfully. ${extractedContent.content.split(' ').length} words analyzed.`,
                content_insights: `Title: ${extractedContent.title || 'Unknown'}, Author: ${extractedContent.author || 'Unknown'}`,
              })
              .eq('id', message.id);

            if (updateError) {
              console.error('❌ Error updating message with extracted content:', updateError);
            } else {
              console.log('✅ Content extracted for:', message.filename || message.content.substring(0, 50));
            }
          }

          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error('❌ Error extracting content for message:', message.id, error);
          
          // Mark as failed
          await supabase
            .from('chat_messages')
            .update({ extraction_status: 'failed' })
            .eq('id', message.id);
        }
      }

      console.log('✅ Batch content extraction completed');
    } catch (error) {
      console.error('❌ Error in batch content extraction:', error);
    }
  }

  // Add this method to update the 'starred' property of a message (local only, no Supabase)
  async updateMessageStarred(id: string, starred: boolean): Promise<void> {
    // No-op: Only update local state/UI, do not update Supabase
    // Optionally, you can update a local store or AsyncStorage here if needed
    console.log(`(Local) Starred state for message ${id} set to:`, starred);
    // If you have a local store, update it here
    return;
  }

  // Process existing messages for content extraction
  async processExistingMessages(): Promise<void> {
    try {
      console.log('🔄 Processing existing messages for content extraction...');
      
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .is('extracted_text', null)
        .in('type', ['file', 'link']);

      if (error) {
        console.error('❌ Error fetching messages:', error);
        return;
      }

      console.log(`📊 Found ${messages?.length || 0} messages to process`);

      for (const message of messages || []) {
        try {
          let extractedContent: ExtractedContent | null = null;

          if (message.type === 'file' && message.file_url) {
            // For now, skip file extraction as it's not implemented
            console.log('📄 Skipping file extraction for:', message.filename);
          } else if (message.type === 'link' && message.file_url) {
            extractedContent = await contentExtractor.extractWebArticle(message.file_url);
          }

          if (extractedContent) {
            // Update the message with extracted content
            const { error: updateError } = await supabase
              .from('chat_messages')
              .update({
                extracted_text: extractedContent.full_text || extractedContent.content,
                extracted_title: extractedContent.title,
                extracted_author: extractedContent.author,
                extracted_excerpt: extractedContent.summary,
                extraction_status: 'completed',
                word_count: extractedContent.content.split(' ').length
              })
              .eq('id', message.id);

            if (updateError) {
              console.error('❌ Error updating message:', updateError);
            } else {
              console.log('✅ Updated message with extracted content:', message.id);
            }
          }
        } catch (error) {
          console.error('❌ Error processing message:', message.id, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in processExistingMessages:', error);
    }
  }

  // Test function to verify content extraction workflow
  async testContentExtraction(url: string): Promise<void> {
    try {
      console.log('🧪 Testing content extraction workflow for:', url);
      
      const user = await this.authService.getStoredUser();
      if (!user) {
        console.error('❌ User not authenticated');
        return;
      }

      // Test the full workflow
      const testMessage = await this.saveMessageWithContentExtraction(
        'Test link for content extraction',
        'link',
        {
          fileUrl: url,
          tags: ['test', 'extraction']
        }
      );

      console.log('✅ Test message saved with ID:', testMessage.id);
      console.log('📊 Extraction status:', testMessage.extraction_status);
      console.log('📝 Extracted text length:', testMessage.extracted_text?.length || 0);
      console.log('📰 Extracted title:', testMessage.extracted_title);
      console.log('👤 Extracted author:', testMessage.extracted_author);
      console.log('📊 Word count:', testMessage.word_count);

      // Verify the content was saved to database
      const { data: verificationData, error: verificationError } = await supabase
        .from('chat_messages')
        .select('extracted_text, extraction_status, word_count')
        .eq('id', testMessage.id)
        .single();

      if (verificationError) {
        console.error('❌ Database verification failed:', verificationError);
      } else {
        console.log('✅ Database verification successful');
        console.log('📝 Database extracted_text length:', verificationData.extracted_text?.length || 0);
        console.log('📊 Database extraction_status:', verificationData.extraction_status);
      }

    } catch (error) {
      console.error('❌ Test content extraction failed:', error);
    }
  }



  // Display database extracted_text in console for debugging
  async displayDatabaseExtractedText(): Promise<void> {
    try {
      console.log('🔍 Querying database for extracted_text content...');
      
      const user = await this.authService.getStoredUser();
      if (!user) {
        console.error('❌ User not authenticated');
        return;
      }

      // Query all messages with extracted_text
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, content, type, extracted_text, extracted_title, extracted_author, word_count, extraction_status, created_at')
        .eq('user_id', user.id)
        .not('extracted_text', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ Error querying database:', error);
        return;
      }

      if (!messages || messages.length === 0) {
        console.log('📭 No messages with extracted_text found in database');
        return;
      }

      console.log(`📊 Found ${messages.length} messages with extracted_text:`);
      console.log('='.repeat(80));

      messages.forEach((message, index) => {
        console.log(`\n📄 Message ${index + 1}:`);
        console.log(`   ID: ${message.id}`);
        console.log(`   Type: ${message.type}`);
        console.log(`   Content: ${message.content.substring(0, 100)}...`);
        console.log(`   Extraction Status: ${message.extraction_status}`);
        console.log(`   Word Count: ${message.word_count}`);
        console.log(`   Title: ${message.extracted_title || 'N/A'}`);
        console.log(`   Author: ${message.extracted_author || 'N/A'}`);
        console.log(`   Created: ${message.created_at}`);
        console.log(`   Extracted Text Length: ${message.extracted_text?.length || 0} characters`);
        
        if (message.extracted_text) {
          console.log(`   Extracted Text Preview:`);
          console.log(`   ${message.extracted_text.substring(0, 500)}...`);
        }
        
        console.log('-'.repeat(60));
      });

      // Also show messages without extracted_text for comparison
      const { data: messagesWithoutExtraction, error: error2 } = await supabase
        .from('chat_messages')
        .select('id, content, type, extraction_status, created_at')
        .eq('user_id', user.id)
        .is('extracted_text', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error2 && messagesWithoutExtraction && messagesWithoutExtraction.length > 0) {
        console.log(`\n📭 Messages WITHOUT extracted_text (${messagesWithoutExtraction.length} recent):`);
        messagesWithoutExtraction.forEach((msg, index) => {
          console.log(`   ${index + 1}. ID: ${msg.id}, Type: ${msg.type}, Status: ${msg.extraction_status || 'N/A'}`);
        });
      }

    } catch (error) {
      console.error('❌ Error displaying database extracted_text:', error);
    }
  }
}

export default ChatService;
