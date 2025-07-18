import { ChatMessage, supabase, UploadedFile, User } from '../config/supabase';

export class DatabaseService {
  private static instance: DatabaseService;

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // User Management
  async createUser(userData: {
    email: string;
    name: string;
    picture?: string;
    provider: 'google' | 'apple' | 'email';
  }): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
        return null;
      }

      console.log('User created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        console.error('Error updating user last login:', error);
      }
    } catch (error) {
      console.error('Error updating user last login:', error);
    }
  }

  // Message Management
  async saveMessage(messageData: {
    user_id: string;
    content: string;
    type: 'text' | 'image' | 'file';
    tags?: string[];
  }): Promise<ChatMessage | null> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          ...messageData,
          timestamp: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        console.error('Error saving message:', error);
        return null;
      }

      console.log('Message saved successfully:', data);
      return data;
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  }

  async getUserMessages(userId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  // File Upload Management
  async uploadFile(file: {
    uri: string;
    name: string;
    type: string;
  }, userId: string): Promise<string | null> {
    try {
      // Create a file path with timestamp to avoid conflicts
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || '';
      const fileName = `${userId}/${timestamp}_${file.name}`;

      // Convert URI to blob for upload
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('chat-uploads')
        .upload(fileName, blob, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        console.error('Error uploading file:', error);
        return null;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(fileName);

      console.log('File uploaded successfully:', publicUrlData.publicUrl);
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  }

  async saveFileRecord(fileData: {
    message_id: string;
    user_id: string;
    original_name: string;
    file_url: string;
    file_type: string;
    file_size: number;
  }): Promise<UploadedFile | null> {
    try {
      const { data, error } = await supabase
        .from('uploaded_files')
        .insert([fileData])
        .select()
        .single();

      if (error) {
        console.error('Error saving file record:', error);
        return null;
      }

      console.log('File record saved successfully:', data);
      return data;
    } catch (error) {
      console.error('Error saving file record:', error);
      return null;
    }
  }

  async getUserFiles(userId: string): Promise<UploadedFile[]> {
    try {
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user files:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user files:', error);
      return [];
    }
  }

  // Search functionality
  async searchMessages(userId: string, query: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .or(`content.ilike.%${query}%,tags.cs.{${query}}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  }

  // Deletion and Recovery functionality
  async softDeleteMessage(messageId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) {
        console.error('Error soft deleting message:', error);
        return false;
      }

      console.log('Message soft deleted successfully:', messageId);
      return true;
    } catch (error) {
      console.error('Error soft deleting message:', error);
      return false;
    }
  }

  async getDeletedMessages(userId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) {
        console.error('Error fetching deleted messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching deleted messages:', error);
      return [];
    }
  }

  async recoverMessage(messageId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ 
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) {
        console.error('Error recovering message:', error);
        return false;
      }

      console.log('Message recovered successfully:', messageId);
      return true;
    } catch (error) {
      console.error('Error recovering message:', error);
      return false;
    }
  }

  async permanentlyDeleteMessage(messageId: string): Promise<boolean> {
    try {
      // First delete associated files
      const { error: filesError } = await supabase
        .from('uploaded_files')
        .delete()
        .eq('message_id', messageId);

      if (filesError) {
        console.error('Error deleting associated files:', filesError);
      }

      // Then delete the message
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.error('Error permanently deleting message:', error);
        return false;
      }

      console.log('Message permanently deleted successfully:', messageId);
      return true;
    } catch (error) {
      console.error('Error permanently deleting message:', error);
      return false;
    }
  }

  // Update getUserMessages to exclude deleted messages
  async getUserMessagesActive(userId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching active messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching active messages:', error);
      return [];
    }
  }
}

export default DatabaseService;
