import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase project settings
// Go to: Settings > API in your Supabase dashboard
const supabaseUrl = 'https://cckclzuomxsxyhmceqal.supabase.co'; // e.g., https://your-project.supabase.co
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNja2NsenVvbXhzeHlobWNlcWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTQwNzUsImV4cCI6MjA2NjU5MDA3NX0.p81d9dX8iiIwyIjyL2dABWdDGBE-HbsVchN957lfaAI'; // Public anon key

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Enable automatic session refresh
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types (we'll expand these as we create tables)
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'apple' | 'email';
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'link';
  timestamp: string;
  is_bot: boolean;
  file_url?: string;
  filename?: string;
  file_path?: string;
  file_type?: string;
  file_size?: number;
  tags?: string[];
  // AI Analysis fields
  ai_analysis?: string;        // Detailed AI analysis of content
  content_insights?: string;   // Key insights and summaries
  visual_description?: string; // For images: detailed visual description
  document_summary?: string;   // For documents: content summary
  // Content extraction fields
  extracted_text?: string;     // Full extracted text from PDFs/articles
  extracted_title?: string;    // Title extracted from content
  extracted_author?: string;   // Author extracted from content
  extracted_excerpt?: string;  // Brief excerpt/summary
  word_count?: number;         // Number of words in extracted content
  content_category?: string;   // Auto-categorized content type
  extraction_status?: string;  // 'pending' | 'completed' | 'failed'
  created_at: string;
  updated_at: string;
}

export interface UploadedFile {
  id: string;
  message_id: string;
  user_id: string;
  original_name: string;
  file_url: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
} 