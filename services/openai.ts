import OpenAI from 'openai';
import { ChatMessage } from '../config/supabase';
import ChatService from './chat';
import { contentExtractor } from './content-extractor';
import SupabaseAuthService from './supabase-auth';

interface DatabaseContext {
  recentMessages: ChatMessage[];
  relevantContent: ChatMessage[];
  contentSummary: string;
  userPatterns: string;
}

class OpenAIService {
  private static instance: OpenAIService;
  private openai: OpenAI;
  private chatService = ChatService.getInstance();
  private authService = SupabaseAuthService.getInstance();
  private contentExtractor = contentExtractor;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: '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',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://blii.app',
        'X-Title': 'Blii Chat App',
      },
    });
  }

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  // Comprehensive database search and context building with temporary storage
  private async buildDatabaseContext(userMessage: string): Promise<DatabaseContext> {
    try {
      console.log('🔍 Building comprehensive database context for:', userMessage);
      
      // Get all user messages for analysis
      const allMessages = await this.chatService.getUserMessages(100);
      const recentMessages = allMessages.slice(-15);
      
      // Get extracted content from temporary storage
      const allExtractedContent = await this.chatService.getAllExtractedContent();
      
      // Filter extracted content to only include items that correspond to existing messages
      const validExtractedContent = allExtractedContent.filter(extractedItem => {
        // Check if there's a corresponding message in the database
        const hasCorrespondingMessage = allMessages.some(message => {
          // Match by messageId if available, or by content similarity
          if (extractedItem.messageId) {
            return message.id === extractedItem.messageId;
          }
          // Fallback: check if the extracted content title/URL matches message content
          if (message.type === 'link' && extractedItem.url) {
            return message.file_url === extractedItem.url;
          }
          if (message.type === 'file' && extractedItem.filename) {
            return message.filename === extractedItem.filename;
          }
          return false;
        });
        return hasCorrespondingMessage;
      });
      
      console.log('📚 Found extracted content items:', allExtractedContent.length);
      console.log('✅ Valid extracted content items:', validExtractedContent.length);
      
      // Perform intelligent content search including temporary storage
      const relevantContent = await this.searchRelevantContentWithTemp(userMessage, allMessages, validExtractedContent);
      
      // Generate content summary including extracted content
      const contentSummary = await this.generateContentSummaryWithTemp(allMessages, validExtractedContent);
      
      // Analyze user patterns
      const userPatterns = await this.analyzeUserPatternsWithTemp(allMessages, validExtractedContent);
      
      console.log('📊 Database context built:', {
        totalMessages: allMessages.length,
        extractedItems: allExtractedContent.length,
        validExtractedItems: validExtractedContent.length,
        relevantContent: relevantContent.length,
        recentMessages: recentMessages.length
      });
      
      return {
        recentMessages,
        relevantContent,
        contentSummary,
        userPatterns
      };
    } catch (error) {
      console.error('❌ Error building database context:', error);
      // Return minimal context on error
      const recentMessages = await this.chatService.getUserMessages(10);
      return {
        recentMessages,
        relevantContent: [],
        contentSummary: 'Unable to analyze content summary',
        userPatterns: 'Unable to analyze user patterns'
      };
    }
  }

  // Enhanced search that includes temporary extracted content and Perplexity search
  private async searchRelevantContentWithTemp(query: string, allMessages: ChatMessage[], extractedContent: any[]): Promise<ChatMessage[]> {
    try {
      console.log('🔎 Searching for relevant content with extracted data and Perplexity...');
      
      // Extract keywords from user query
      const keywords = await this.extractKeywords(query);
      console.log('🏷️ Extracted keywords:', keywords);
      
      // Search in temporary extracted content first
      console.log('🔍 Searching in extracted content. Available items:', extractedContent.length);
      extractedContent.forEach((item, index) => {
        console.log(`📄 Item ${index + 1}:`, {
          title: item.title,
          wordCount: item.wordCount,
          type: item.type
        });
      });
      
      const tempMatches = extractedContent.filter(item => {
        const searchText = (item.text + ' ' + (item.title || '') + ' ' + (item.author || '')).toLowerCase();
        return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
      });
      
      console.log('🎯 Found matches in extracted content:', tempMatches.length);

      // Convert temp matches to message format for consistency
      const tempAsMessages = tempMatches.map(item => {
        console.log('🔄 Converting temp item to message format:', {
          title: item.title,
          textLength: item.text?.length,
          wordCount: item.wordCount,
          type: item.type
        });
        
        return {
          id: item.messageId || `temp_${Date.now()}`,
          content: `${item.title || 'Extracted Content'}: ${item.text.substring(0, 200)}...`,
          type: item.type,
          extracted_text: item.text,
          extracted_title: item.title,
          extracted_author: item.author,
          word_count: item.wordCount,
          filename: item.filename,
          file_url: item.url,
          tags: item.tags,
          created_at: item.timestamp,
          user_id: '',
          timestamp: '',
          is_bot: false,
          updated_at: item.timestamp
        };
      });

      console.log('✅ Converted', tempAsMessages.length, 'temp items to message format');
      tempAsMessages.forEach((msg, index) => {
        console.log(`📄 Message ${index + 1}: extracted_text length = ${msg.extracted_text?.length}, title = ${msg.extracted_title}`);
      });

      // Search by content keywords in regular messages (including image analysis)
      const contentMatches = allMessages.filter(msg => {
        const searchText = (
          msg.content + ' ' + 
          (msg.ai_analysis || '') + ' ' + 
          (msg.extracted_text || '') + ' ' + 
          (msg.extracted_title || '') + ' ' +
          (msg.tags?.join(' ') || '') + ' ' +
          // Include image analysis content if it's an image message
          (msg.type === 'image' && msg.content.includes('Image shared -') ? 
            msg.content.replace('Image shared - ', '') : '')
        ).toLowerCase();
        return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
      });
      
      // Search by tags if keywords found in tags
      const tagMatches = await this.searchByTags(keywords);
      
      // Combine all results with priority to extracted content
      const allMatches = [...tempAsMessages, ...contentMatches, ...tagMatches];
      const uniqueMatches = allMatches.filter((msg, index, self) => 
        index === self.findIndex(m => m.id === msg.id)
      );
      
      // Sort by relevance (extracted content first, then most recent)
      const sortedMatches = uniqueMatches
        .sort((a, b) => {
          // Prioritize items with extracted content
          if (a.extracted_text && !b.extracted_text) return -1;
          if (!a.extracted_text && b.extracted_text) return 1;
          // Then by recency
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice(0, 10); // Limit to top 10 most relevant
      
      console.log('✅ Found', sortedMatches.length, 'relevant content pieces');
      return sortedMatches;
    } catch (error) {
      console.error('❌ Error searching relevant content:', error);
      return [];
    }
  }

  // Generate summary including extracted content
  private async generateContentSummaryWithTemp(allMessages: ChatMessage[], extractedContent: any[]): Promise<string> {
    try {
      if (allMessages.length === 0 && extractedContent.length === 0) return 'No content found';
      
      // Analyze content types and patterns
      const contentAnalysis = {
        totalMessages: allMessages.length,
        extractedItems: extractedContent.length,
        images: allMessages.filter(m => m.type === 'image').length,
        documents: allMessages.filter(m => m.type === 'file').length,
        links: allMessages.filter(m => m.type === 'link').length,
        textMessages: allMessages.filter(m => m.type === 'text' && !m.is_bot).length,
        totalWords: extractedContent.reduce((sum, item) => sum + (item.wordCount || 0), 0)
      };
      
      // Get samples from extracted content
      const extractedSamples = extractedContent
        .slice(-5)
        .map(item => `${item.type.toUpperCase()}: ${item.title || 'Content'} (${item.wordCount} words)`)
        .join('\n');
      
      return `Content database: ${contentAnalysis.totalMessages} messages, ${contentAnalysis.extractedItems} extracted items with ${contentAnalysis.totalWords} total words. Recent extractions:\n${extractedSamples}`;
    } catch (error) {
      console.error('Error generating content summary:', error);
      return 'Content summary unavailable';
    }
  }

  // Analyze patterns including extracted content
  private async analyzeUserPatternsWithTemp(allMessages: ChatMessage[], extractedContent: any[]): Promise<string> {
    try {
      if (allMessages.length < 5 && extractedContent.length === 0) return 'Not enough data for pattern analysis';
      
      // Analyze categories from extracted content
      const categories = extractedContent.map(item => item.type || 'unknown');
      const categoryCount = categories.reduce((acc, cat) => {
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
             const topCategories = Object.entries(categoryCount)
         .sort(([,a], [,b]) => (b as number) - (a as number))
         .slice(0, 3)
         .map(([cat, count]) => `${cat} (${count})`);
      
      return `User saves ${extractedContent.length} extracted documents/articles. Content focus: ${topCategories.join(', ')}. Database intelligence: ACTIVE with ${extractedContent.reduce((sum, item) => sum + (item.wordCount || 0), 0)} words of extracted content.`;
    } catch (error) {
      console.error('Error analyzing user patterns:', error);
      return 'Pattern analysis unavailable';
    }
  }

  // Extract keywords from user query using AI
  private async extractKeywords(query: string): Promise<string[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract 3-7 relevant keywords from the user query for searching content. Return only the keywords separated by commas, no explanations.'
          },
          {
            role: 'user',
            content: `Extract keywords from: "${query}"`
          }
        ],
        max_tokens: 50,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content || '';
      return response.split(',').map(k => k.trim()).filter(k => k.length > 2);
    } catch (error) {
      console.error('Error extracting keywords:', error);
      // Fallback: basic keyword extraction
      return query.toLowerCase().split(' ').filter(word => word.length > 3);
    }
  }

  // Search by tags
  private async searchByTags(keywords: string[]): Promise<ChatMessage[]> {
    try {
      const results = await this.chatService.searchMessagesByTags(keywords);
      return results.slice(0, 5);
    } catch (error) {
      console.error('Error searching by tags:', error);
      return [];
    }
  }

  // Basic semantic search
  private async searchBySemantic(query: string, allMessages: ChatMessage[]): Promise<ChatMessage[]> {
    try {
      // Simple semantic matching based on content similarity
      const queryWords = query.toLowerCase().split(' ');
      
      const semanticMatches = allMessages.filter(msg => {
        const contentWords = msg.content.toLowerCase().split(' ');
        const commonWords = queryWords.filter(qWord => 
          contentWords.some(cWord => cWord.includes(qWord) || qWord.includes(cWord))
        );
        return commonWords.length >= Math.min(2, queryWords.length * 0.3);
      });
      
      return semanticMatches.slice(0, 5);
    } catch (error) {
      console.error('Error in semantic search:', error);
      return [];
    }
  }

  // Generate AI response based on chat history (fallback method)
  async generateResponse(userMessage: string): Promise<string> {
    try {
      console.log('🤖 Generating AI response for:', userMessage);
      console.log('🔑 Using OpenRouter API with base URL:', 'https://openrouter.ai/api/v1');
      
      // Get recent chat history for context
      const recentMessages = await this.chatService.getUserMessages(15);
      console.log('📝 Found', recentMessages.length, 'recent messages for context');
      
      const formattedMessages = this.formatMessagesForOpenAI(recentMessages);

      // Add the current user message
      formattedMessages.push({
        role: 'user',
        content: userMessage
      });

      // Create system prompt to define Bill's personality
      const systemMessage = {
        role: 'system',
        content: `You're Bill, a friendly personal assistant who helps with organizing saved content.

Keep it natural and brief - like you're chatting with a friend who asked for help. Be warm but not overly formal. If you don't have much to work with from their saved content, just say so and offer to help differently.

Stay conversational and helpful!`
      };

      console.log('🚀 Making request to OpenRouter API...');
      
      // Use the correct model name for OpenRouter
      const model = 'gpt-4o-mini';
      const completion = await this.openai.chat.completions.create({
        model: model,
        messages: [systemMessage, ...formattedMessages],
        max_tokens: 300,
        temperature: 0.7,
      });
      
      console.log('✅ Using model:', model);

      console.log('✅ Received response from OpenRouter API');
      const response = completion.choices[0]?.message?.content;
      if (!response) {
        console.error('❌ No response content in API response');
        throw new Error('No response generated');
      }

      console.log('✨ AI response generated successfully:', response.substring(0, 100) + '...');
      return response;
    } catch (error: any) {
      console.error('❌ Error generating AI response:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        error: error.error,
        type: error.type
      });
      
      // Provide more specific error messages
      if (error.status === 401) {
        throw new Error('API key is invalid. Please check your OpenRouter API key.');
      } else if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      } else if (error.status === 402) {
        throw new Error('Insufficient credits. Please check your OpenRouter account.');
      } else if (error.message?.includes('network')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      
      throw new Error(`AI service error: ${error.message || 'Please try again.'}`);
    }
  }

  // Send AI response and save to database
  async sendAIResponse(userMessage: string, tags?: string[]): Promise<ChatMessage> {
    try {
      const user = await this.authService.getStoredUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Use enhanced response generation that analyzes full database
      const aiResponse = await this.generateResponseWithDatabaseContext(userMessage);

      // Save AI response to database
      const messageData: Omit<ChatMessage, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        content: aiResponse,
        type: 'text',
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour12: true, 
          hour: 'numeric', 
          minute: '2-digit' 
        }),
        is_bot: true,
        tags: tags && tags.length > 0 ? tags : undefined,
      };

      return await this.chatService.saveMessage(messageData);
    } catch (error) {
      console.error('Error sending AI response:', error);
      throw error;
    }
  }

  // Enhanced content analysis that includes image and document insights
  async askAboutContent(query: string, searchTags?: string[]): Promise<string> {
    try {
      console.log('🔍 Asking AI about content with database integration:', query);
      
      // Use the enhanced database context for content queries
      return await this.generateResponseWithDatabaseContext(query);
    } catch (error) {
      console.error('Error asking AI about content:', error);
      throw new Error('Failed to analyze content. Please try again.');
    }
  }

  // Suggest tags for content using AI
  async suggestTags(content: string, contentType: 'text' | 'image' | 'file' | 'link', filename?: string, url?: string): Promise<string[]> {
    try {
      let contextDescription = `Content: ${content}`;
      if (filename) contextDescription += `\nFilename: ${filename}`;
      if (url) contextDescription += `\nURL: ${url}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a tagging expert. Suggest 3-5 relevant, concise tags for organizing content. Return only the tags as a comma-separated list, no explanations.'
          },
          {
            role: 'user',
            content: `Suggest relevant tags for this ${contentType}:\n${contextDescription}`
          }
        ],
        max_tokens: 50,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return [];
      }

      // Parse the response into individual tags
      return response
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0 && tag.length <= 20)
        .slice(0, 5); // Limit to 5 tags
    } catch (error) {
      console.error('Error suggesting tags:', error);
      return [];
    }
  }

  // Analyze image content using OpenAI Vision
  async analyzeImageContent(imageUrl: string): Promise<string> {
    try {
      console.log('🖼️ Analyzing image content:', imageUrl);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image and provide a detailed description including: objects, people, settings, colors, mood, and any text visible. Be comprehensive but concise.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 300,
      });

      const analysis = completion.choices[0]?.message?.content || 'Unable to analyze image';
      console.log('✅ Image analysis completed:', analysis.substring(0, 100) + '...');
      return analysis;
    } catch (error) {
      console.error('❌ Error analyzing image:', error);
      return 'Image analysis unavailable';
    }
  }

  // Extract and analyze document content with full text extraction
  async analyzeDocumentContent(fileUrl: string, filename: string): Promise<string> {
    try {
      console.log('📄 Analyzing document content with full extraction:', filename);
      
      const fileExtension = filename.split('.').pop()?.toLowerCase();
      
      // Use ContentExtractor for full text extraction
      if (fileExtension === 'pdf') {
        const extractedContent = await this.contentExtractor.extractFileContent(fileUrl, 'pdf');
        
        // Use the extracted text as context for deeper analysis
        if (extractedContent.content && extractedContent.content.split(' ').length > 50) {
          const aiAnalysis = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Analyze the extracted PDF content and provide a comprehensive summary including key topics, important information, and actionable insights.'
              },
              {
                role: 'user',
                content: `Analyze this PDF content:\n\nTitle: ${extractedContent.title}\nWord Count: ${extractedContent.content.split(' ').length}\n\nExtracted Text:\n${extractedContent.content.substring(0, 3000)}${extractedContent.content.length > 3000 ? '...' : ''}`
              }
            ],
            max_tokens: 400,
            temperature: 0.3,
          });

          const analysis = aiAnalysis.choices[0]?.message?.content || 'Analysis unavailable';
          return `📄 PDF Analysis: ${extractedContent.title || filename}\n\n🔍 Content Summary:\n${analysis}\n\n📊 Document Stats:\n- Word Count: ${extractedContent.content.split(' ').length}\n- Category: ${extractedContent.summary ? 'Text-heavy document' : 'Standard PDF'}`;
        }
      }
      
      // Fallback to basic analysis for other file types
      let analysis = `Document: ${filename}\n`;
      
      switch (fileExtension) {
        case 'pdf':
          analysis += 'PDF document - Text extraction attempted but content may be image-based or encrypted.';
          break;
        case 'doc':
        case 'docx':
          analysis += 'Word document - Contains text content, reports, or written materials.';
          break;
        case 'xls':
        case 'xlsx':
          analysis += 'Excel spreadsheet - Contains data, calculations, or tabular information.';
          break;
        case 'ppt':
        case 'pptx':
          analysis += 'PowerPoint presentation - Contains slides with information and visuals.';
          break;
        case 'txt':
          analysis += 'Text file - Contains plain text information.';
          break;
        default:
          analysis += `${fileExtension?.toUpperCase()} file - Contains specific formatted data.`;
      }
      
      // Use AI to suggest content based on filename
      const suggestion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Based on filename "${filename}", what content might this document contain? Be specific for organization.`
          }
        ],
        max_tokens: 150,
      });

      const aiSuggestion = suggestion.choices[0]?.message?.content || '';
      analysis += `\n\nContent prediction: ${aiSuggestion}`;
      
      console.log('✅ Document analysis completed');
      return analysis;
    } catch (error) {
      console.error('❌ Error analyzing document:', error);
      return `Document: ${filename} - Analysis unavailable`;
    }
  }

  // Enhanced response generation with full database context and Perplexity
  async generateResponseWithDatabaseContext(userMessage: string): Promise<string> {
    try {
      console.log('🤖 Generating AI response with full database context and Perplexity...');
      
      // Check if the query requires real-time information
      const requiresRealTimeInfo = this.detectRealTimeQuery(userMessage);
      
      let realTimeContext = '';
      if (requiresRealTimeInfo) {
        console.log('🔍 Query requires real-time information, using Perplexity...');
        try {
          const PerplexityService = await import('./perplexity');
          const perplexityService = PerplexityService.default.getInstance();
          
          const searchResult = await perplexityService.searchTopic(userMessage);
          realTimeContext = `\n\nREAL-TIME INFORMATION FROM PERPLEXITY:\n${searchResult.content}\n\nKey points: ${searchResult.keyPoints.join(', ')}`;
          
          console.log('✅ Real-time context added from Perplexity');
        } catch (perplexityError) {
          console.error('❌ Perplexity search failed:', perplexityError);
          realTimeContext = '\n\nNote: Real-time information search failed, using stored content only.';
        }
      }
      
      // Build comprehensive database context
      const dbContext = await this.buildDatabaseContext(userMessage);
      
      // Format context for AI
      const contextPrompt = this.formatDatabaseContextForAI(dbContext, userMessage) + realTimeContext;
      
      // Log the actual prompt being sent to AI for debugging
      console.log('📝 PROMPT BEING SENT TO AI (first 500 chars):', contextPrompt.substring(0, 500));
      
      // Generate response using full context
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You're Bill, a friendly personal assistant who helps organize and understand saved content.

**Your personality:**
- Conversational and warm, like talking to a helpful friend
- Keep responses SHORT (2-3 sentences max unless asked for details)
- Use natural language - no formal AI speak
- Be enthusiastic about helping but not overly excited

**What you can see:**
- Documents and articles (marked as "DOCUMENT CONTENT")
- Photos and images (marked as "IMAGE CONTENT") 
- Only reference what's actually provided - don't guess or assume

**How to respond:**
- Start with a natural acknowledgment like "I can see you saved..." or "Looking at your content..."
- Be specific but brief - mention key details without overwhelming
- For images: describe what you actually see
- For documents: pull out the main points
- If asked about connections, briefly note themes across different content types
- End helpfully - suggest what else they might want to know

Remember: You're a personal assistant, not a research tool. Be helpful, quick, and human.`
          },
          {
            role: 'user',
            content: contextPrompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response generated');
      }

      console.log('✨ Database-enhanced AI response generated successfully');
      return response;
    } catch (error: any) {
      console.error('❌ Error generating database-enhanced response:', error);
      
      // Fallback to simple response
      console.log('🔄 Falling back to simple response generation...');
      return await this.generateResponse(userMessage);
    }
  }

  // Format database context for AI consumption - includes both document content AND image analysis
  private formatDatabaseContextForAI(context: DatabaseContext, userMessage: string): string {
    let prompt = `USER QUESTION: "${userMessage}"\n\n`;
    
    // Add extracted content AND image analysis
    if (context.relevantContent.length > 0) {
      let hasContent = false;
      let contentIndex = 1;
      
      context.relevantContent.forEach((msg) => {
        // Add document/link extracted text content
        if (msg.extracted_text && msg.extracted_text.length > 100) {
          hasContent = true;
          console.log(`🎯 Adding extracted text to prompt: ${msg.extracted_title}, length: ${msg.extracted_text.length}`);
          
          prompt += `DOCUMENT CONTENT (Saved Document ${contentIndex}):\n`;
          prompt += `Title: ${msg.extracted_title || 'Untitled'}\n`;
          prompt += `Word Count: ${msg.word_count || 'Unknown'}\n`;
          prompt += `Content Type: ${msg.type.toUpperCase()}\n\n`;
          prompt += `TEXT CONTENT:\n${msg.extracted_text}\n`;
          prompt += `---END OF DOCUMENT---\n\n`;
          contentIndex++;
        }
        
        // Add image analysis content
        if (msg.type === 'image' && msg.content && msg.content.includes('Image shared -')) {
          hasContent = true;
          const imageAnalysis = msg.content.replace('Image shared - ', '').replace('...', '');
          console.log(`🖼️ Adding image analysis to prompt: length: ${imageAnalysis.length}`);
          
          prompt += `IMAGE CONTENT (Saved Image ${contentIndex}):\n`;
          prompt += `Content Type: IMAGE\n`;
          prompt += `Filename: ${msg.filename || 'Unknown'}\n`;
          prompt += `File URL: ${msg.file_url || 'N/A'}\n\n`;
          prompt += `VISUAL ANALYSIS:\n${imageAnalysis}\n`;
          if (msg.tags && msg.tags.length > 0) {
            prompt += `Tags: ${msg.tags.join(', ')}\n`;
          }
          prompt += `---END OF IMAGE ANALYSIS---\n\n`;
          contentIndex++;
        }
      });
      
      if (!hasContent) {
        prompt += `NO EXTRACTED CONTENT OR IMAGE ANALYSIS AVAILABLE\n\n`;
        // Add basic message info as fallback
        context.relevantContent.forEach((msg, index) => {
          console.log(`⚠️ No content analysis for message ${index + 1}, type: ${msg.type}, content length: ${msg.content?.length || 0}`);
          prompt += `Saved Item ${index + 1}: ${msg.type.toUpperCase()} - ${msg.content.substring(0, 200)}...\n`;
        });
        prompt += `\n`;
      }
    } else {
      prompt += `NO RELEVANT SAVED CONTENT FOUND\n\n`;
    }
    
    // Add minimal context at the end
    prompt += `RECENT CONVERSATION:\n`;
    if (context.recentMessages.length > 0) {
      context.recentMessages.slice(-3).forEach(msg => {
        const role = msg.is_bot ? 'Bill' : 'User';
        prompt += `${role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`;
      });
    }
    
    prompt += `\nRespond naturally and briefly using the content above. Reference what you actually see in their images and documents, and keep it conversational!`;
    
    return prompt;
  }

  // Convert chat messages to OpenAI format (keeping original for simple cases)
  private formatMessagesForOpenAI(messages: ChatMessage[]): any[] {
    return messages
      .filter(msg => msg.type === 'text' || msg.type === 'link') // Only include text and link messages for context
      .slice(-10) // Use last 10 messages for context
      .map(msg => ({
        role: msg.is_bot ? 'assistant' : 'user',
        content: msg.type === 'link' 
          ? `User shared a link: ${msg.content} (${msg.file_url})`
          : msg.content
      }));
  }

  // Detect if a query requires real-time information
  private detectRealTimeQuery(query: string): boolean {
    const realTimeKeywords = [
      'latest', 'recent', 'current', 'today', 'now', 'update', 'news',
      'trending', 'popular', 'latest news', 'current events', 'what\'s happening',
      'latest update', 'recent developments', 'current trends', 'breaking news'
    ];
    
    const lowerQuery = query.toLowerCase();
    return realTimeKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  // Generate relevant questions based on user's uploaded content
  async generateSmartQuestions(limit: number = 3): Promise<string[]> {
    try {
      console.log('🧠 Generating smart questions based on user content...');
      
      // Get recent messages and extracted content
      const recentMessages = await this.chatService.getUserMessages(20);
      const allExtractedContent = await this.chatService.getAllExtractedContent();
      
      // Filter extracted content to only include items that correspond to existing messages
      const validExtractedContent = allExtractedContent.filter(extractedItem => {
        // Check if there's a corresponding message in the database
        const hasCorrespondingMessage = recentMessages.some(message => {
          // Match by messageId if available, or by content similarity
          if (extractedItem.messageId) {
            return message.id === extractedItem.messageId;
          }
          // Fallback: check if the extracted content title/URL matches message content
          if (message.type === 'link' && extractedItem.url) {
            return message.file_url === extractedItem.url;
          }
          if (message.type === 'file' && extractedItem.filename) {
            return message.filename === extractedItem.filename;
          }
          return false;
        });
        return hasCorrespondingMessage;
      });
      
      console.log('📊 Analysis data:', {
        messages: recentMessages.length,
        extractedItems: allExtractedContent.length,
        validExtractedItems: validExtractedContent.length
      });
      
      // If no content, return default suggestions
      if (recentMessages.length === 0 && validExtractedContent.length === 0) {
        return [
          "What should I save first?",
          "How can you help me organize my content?",
          "What types of files can I upload?"
        ];
      }
      
      // Analyze user's content to create context using only valid extracted content
      const contentSummary = this.buildContentSummaryForQuestions(recentMessages, validExtractedContent);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are Bill, a personal AI assistant that helps users organize and understand their saved content. Based on the user's content summary, generate ${limit} relevant, specific questions that the user might want to ask about their saved content.

Rules:
1. Make questions specific to their actual content (mention topics, types, or themes they've saved)
2. Questions should be useful and actionable
3. Use natural, conversational language
4. Each question should be 4-10 words long
5. Focus on practical queries like summarizing, finding connections, or organizing
6. Return only the questions, one per line, no numbering or bullet points`
          },
          {
            role: 'user',
            content: `Based on this content summary, generate ${limit} relevant questions I might ask:\n\n${contentSummary}`
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        console.log('⚠️ No response from AI, using fallback questions');
        return this.getFallbackQuestions(recentMessages, validExtractedContent, limit);
      }

      const questions = response
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0 && q.includes('?'))
        .slice(0, limit);
      
      console.log('✅ Generated smart questions:', questions);
      
      // If we got fewer questions than requested, fill with fallback
      if (questions.length < limit) {
        const fallback = this.getFallbackQuestions(recentMessages, validExtractedContent, limit - questions.length);
        questions.push(...fallback);
      }
      
      return questions.slice(0, limit);
    } catch (error) {
      console.error('❌ Error generating smart questions:', error);
      // Get basic data for fallback
      try {
        const recentMessages = await this.chatService.getUserMessages(10);
        const allExtractedContent = await this.chatService.getAllExtractedContent();
        
        // Filter extracted content for fallback too
        const validExtractedContent = allExtractedContent.filter(extractedItem => {
          const hasCorrespondingMessage = recentMessages.some(message => {
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
          return hasCorrespondingMessage;
        });
        
        return this.getFallbackQuestions(recentMessages, validExtractedContent, limit);
      } catch (fallbackError) {
        console.error('❌ Error in fallback:', fallbackError);
        return [
          "What have I saved recently?",
          "Help me organize my content?",
          "Find connections in my uploads?"
        ].slice(0, limit);
      }
    }
  }

  private buildContentSummaryForQuestions(messages: ChatMessage[], extractedContent: any[]): string {
    const summary = [];
    
    // Analyze message types
    const imageCount = messages.filter(m => m.type === 'image').length;
    const docCount = messages.filter(m => m.type === 'file').length;
    const linkCount = messages.filter(m => m.type === 'link').length;
    
    if (imageCount > 0) summary.push(`${imageCount} images`);
    if (docCount > 0) summary.push(`${docCount} documents`);
    if (linkCount > 0) summary.push(`${linkCount} links`);
    
    // Analyze extracted content themes
    const themes = extractedContent
      .map(item => item.title || item.type)
      .slice(-5)
      .join(', ');
    
    // Analyze image content themes
    const imageThemes = messages
      .filter(m => m.type === 'image' && m.content.includes('Image shared -'))
      .map(m => {
        const analysis = m.content.replace('Image shared - ', '').replace('...', '');
        // Extract key visual elements (first few words of analysis)
        return analysis.split(' ').slice(0, 8).join(' ');
      })
      .slice(-3)
      .join('; ');
    
    // Get common tags
    const allTags = messages
      .filter(m => m.tags && m.tags.length > 0)
      .flatMap(m => m.tags!)
      .slice(-10);
    
    const tagSummary = allTags.length > 0 ? `Common tags: ${allTags.join(', ')}` : '';
    
    let contentDesc = `User has saved: ${summary.join(', ')}.`;
    if (themes) contentDesc += ` Recent content: ${themes}.`;
    if (imageThemes) contentDesc += ` Image content: ${imageThemes}.`;
    if (tagSummary) contentDesc += ` ${tagSummary}.`;
    if (extractedContent.length > 0) {
      const totalWords = extractedContent.reduce((sum, item) => sum + (item.wordCount || 0), 0);
      contentDesc += ` ${extractedContent.length} items with ${totalWords} words extracted.`;
    }
    
    return contentDesc;
  }

  private getFallbackQuestions(messages: ChatMessage[], extractedContent: any[], limit: number): string[] {
    const fallbacks = [];
    
    if (messages.length > 0) {
      if (messages.some(m => m.type === 'image')) {
        fallbacks.push("What's in my recent photos?");
        fallbacks.push("Describe the images I've uploaded?");
      }
      if (messages.some(m => m.type === 'file')) {
        fallbacks.push("Summarize my uploaded documents?");
      }
      if (messages.some(m => m.type === 'link')) {
        fallbacks.push("What articles did I save?");
      }
      if (messages.some(m => m.tags && m.tags.length > 0)) {
        fallbacks.push("Show me content by topic?");
      }
      
      // If both images and documents exist, suggest connection questions
      const hasImages = messages.some(m => m.type === 'image');
      const hasDocuments = messages.some(m => m.type === 'file' || m.type === 'link');
      if (hasImages && hasDocuments) {
        fallbacks.push("How do my images relate to my documents?");
      }
    }
    
    // Add general fallbacks
    fallbacks.push(
      "What have I saved recently?",
      "Help me organize my content?",
      "Find connections in my uploads?"
    );
    
    return fallbacks.slice(0, limit);
  }
}

export default OpenAIService; 