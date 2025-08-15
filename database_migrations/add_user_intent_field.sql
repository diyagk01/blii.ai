-- Add user_intent field to chat_messages table
-- This field stores the user's custom note/intent for content (max 30 chars)
-- to help customize follow-up questions based on user intent

ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS user_intent VARCHAR(30);

-- Add comment to describe the field
COMMENT ON COLUMN public.chat_messages.user_intent IS 'User''s custom note or intent for this content (max 30 characters)';

-- Create index for user_intent field for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_intent ON public.chat_messages(user_intent);
