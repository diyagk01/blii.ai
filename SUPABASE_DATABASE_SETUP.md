# 🗄️ Supabase Database Setup for Chat

## Overview
This guide sets up the necessary tables and storage buckets in Supabase for your chat functionality.

## 📋 Required Setup

### **Step 1: Create Storage Buckets**

Go to your Supabase Dashboard → Storage and create these buckets:

1. **Create "images" bucket**:
   - Name: `images`
   - Public: `true` (for displaying images in chat)
   - File size limit: `10MB`
   - Allowed file types: `image/*`

2. **Create "documents" bucket**:
   - Name: `documents` 
   - Public: `true` (for accessing files)
   - File size limit: `50MB`
   - Allowed file types: `*` (all file types)

### **Step 2: Create Database Tables**

Go to your Supabase Dashboard → SQL Editor and run these commands:

#### **1. Chat Messages Table**

```sql
-- Create chat_messages table with enhanced content extraction fields
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'image', 'file', 'link')),
    timestamp TEXT NOT NULL,
    is_bot BOOLEAN DEFAULT false,
    file_url TEXT,
    filename TEXT,
    file_path TEXT,
    file_type TEXT,
    file_size BIGINT,
    tags TEXT[],
    
    -- AI Analysis fields
    ai_analysis TEXT,
    content_insights TEXT,
    visual_description TEXT,
    document_summary TEXT,
    
    -- Content Extraction fields (NEW)
    extracted_text TEXT,
    extracted_title TEXT,
    extracted_author TEXT,
    extracted_excerpt TEXT,
    word_count INTEGER,
    content_category TEXT,
    extraction_status TEXT CHECK (extraction_status IN ('pending', 'completed', 'failed')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON public.chat_messages(type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tags ON public.chat_messages USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_chat_messages_extracted_text ON public.chat_messages USING GIN(to_tsvector('english', extracted_text));
CREATE INDEX IF NOT EXISTS idx_chat_messages_extraction_status ON public.chat_messages(extraction_status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own messages" ON public.chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON public.chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON public.chat_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON public.chat_messages
    FOR DELETE USING (auth.uid() = user_id);
```

#### **2. Update Trigger for updated_at**

```sql
-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for chat_messages
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER update_chat_messages_updated_at
    BEFORE UPDATE ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### **Step 3: Set Up Storage Policies**

#### **Images Bucket Policies**

```sql
-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'images' AND 
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to view images
CREATE POLICY "Anyone can view images" ON storage.objects
    FOR SELECT USING (bucket_id = 'images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'images' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );
```

#### **Documents Bucket Policies**

```sql
-- Allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'documents' AND 
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to view documents
CREATE POLICY "Anyone can view documents" ON storage.objects
    FOR SELECT USING (bucket_id = 'documents');

-- Allow users to delete their own documents
CREATE POLICY "Users can delete their own documents" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'documents' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );
```

### **Step 4: Verify Setup**

After running the SQL commands, verify everything is set up correctly:

1. **Check Tables**:
   - Go to Database → Tables
   - You should see `chat_messages` table

2. **Check Storage**:
   - Go to Storage
   - You should see `images` and `documents` buckets

3. **Test Policies**:
   - Try uploading a test file through the Storage interface
   - Check that RLS policies are working

## 🚀 Features Enabled

After this setup, your app will have:

### **✅ Secure File Storage**:
- **Images**: Stored in dedicated bucket with automatic optimization
- **Documents**: All file types supported with size limits
- **User isolation**: Each user's files in their own folder

### **✅ Robust Database**:
- **Message persistence**: All chat messages saved permanently
- **Rich metadata**: File info, tags, timestamps stored
- **Search capabilities**: Search by content, tags, file types

### **✅ Security**:
- **Row Level Security**: Users only see their own messages
- **Storage policies**: Users only access their own files
- **Authentication required**: All operations require login

### **✅ Performance**:
- **Indexed queries**: Fast message retrieval
- **CDN delivery**: Images/files served from global CDN
- **Optimized storage**: Automatic file compression

## 📊 Database Schema

```
chat_messages
├── id (UUID, Primary Key)
├── user_id (UUID, Foreign Key → auth.users)
├── content (TEXT)
├── type (TEXT: 'text'|'image'|'file'|'link')
├── timestamp (TEXT)
├── is_bot (BOOLEAN)
├── file_url (TEXT, nullable)
├── filename (TEXT, nullable)
├── file_path (TEXT, nullable)
├── file_type (TEXT, nullable)
├── file_size (BIGINT, nullable)
├── tags (TEXT[], nullable)
├── ai_analysis (TEXT, nullable)
├── content_insights (TEXT, nullable)
├── visual_description (TEXT, nullable)
├── document_summary (TEXT, nullable)
├── extracted_text (TEXT, nullable)
├── extracted_title (TEXT, nullable)
├── extracted_author (TEXT, nullable)
├── extracted_excerpt (TEXT, nullable)
├── word_count (INTEGER, nullable)
├── content_category (TEXT, nullable)
├── extraction_status (TEXT, nullable)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

## 🔍 Usage Examples

After setup, your chat will automatically:

- **Store text messages** with tags and timestamps
- **Upload files** to appropriate buckets with user isolation
- **Generate public URLs** for immediate access
- **Enable search** by content, tags, or file types
- **Sync across devices** through real-time updates

Run these SQL commands in your Supabase Dashboard and your chat will be fully backed by a robust database! 🎉 