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

  // Enhanced search that uses database extracted_text directly
  private async searchRelevantContentWithTemp(query: string, allMessages: ChatMessage[], extractedContent: any[]): Promise<ChatMessage[]> {
    try {
      console.log('🔎 DEBUGGING: Searching for relevant content in database extracted_text...');
      console.log('🔎 DEBUGGING: Query:', query);
      console.log('🔎 DEBUGGING: Total messages to search:', allMessages.length);
      
      // Extract keywords from user query
      const keywords = await this.extractKeywords(query);
      console.log('🏷️ DEBUGGING: Extracted keywords:', keywords);
      
      // Search directly in database messages with extracted_text
      const messagesWithExtractedText = allMessages.filter(msg => 
        msg.extracted_text && msg.extracted_text.length > 100
      );
      
      console.log('🔍 DEBUGGING: Found', messagesWithExtractedText.length, 'messages with extracted_text in database');
      
      // Log details of messages with extracted text
      messagesWithExtractedText.forEach((msg, index) => {
        console.log(`📄 DEBUGGING: Message ${index + 1} with extracted_text:`, {
          id: msg.id,
          type: msg.type,
          title: msg.extracted_title,
          textLength: msg.extracted_text?.length,
          wordCount: msg.word_count,
          contentPreview: msg.content.substring(0, 100),
          extractedTextPreview: msg.extracted_text?.substring(0, 200) + '...'
        });
      });
      
      // Search in extracted_text content from database
      const extractedTextMatches = messagesWithExtractedText.filter(msg => {
        const searchText = (
          (msg.extracted_text || '') + ' ' + 
          (msg.extracted_title || '') + ' ' + 
          (msg.extracted_author || '') + ' ' +
          (msg.content || '')
        ).toLowerCase();
        
        console.log(`🔍 DEBUGGING: Searching in message ${msg.id} with search text length:`, searchText.length);
        
        const hasKeywordMatch = keywords.some(keyword => {
          const match = searchText.includes(keyword.toLowerCase());
          console.log(`🔍 DEBUGGING: Keyword "${keyword}" match in message ${msg.id}:`, match);
          return match;
        });
        
        if (hasKeywordMatch) {
          console.log('🎯 DEBUGGING: Found match in extracted_text:', {
            id: msg.id,
            title: msg.extracted_title,
            textLength: msg.extracted_text?.length,
            wordCount: msg.word_count,
            type: msg.type,
            matchingKeywords: keywords.filter(k => searchText.includes(k.toLowerCase()))
          });
        }
        
        return hasKeywordMatch;
      });
      
      console.log('🎯 DEBUGGING: Found', extractedTextMatches.length, 'matches in database extracted_text');

      // If no matches found, let's try a broader search
      if (extractedTextMatches.length === 0) {
        console.log('⚠️ DEBUGGING: No keyword matches found, trying broader search...');
        
        // Try searching for any of the query words individually
        const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 3);
        console.log('🔍 DEBUGGING: Query words:', queryWords);
        
        const broadMatches = messagesWithExtractedText.filter(msg => {
          const searchText = (
            (msg.extracted_text || '') + ' ' + 
            (msg.extracted_title || '') + ' ' + 
            (msg.content || '')
          ).toLowerCase();
          
          const hasWordMatch = queryWords.some(word => searchText.includes(word));
          if (hasWordMatch) {
            console.log('🎯 DEBUGGING: Broad match found in message:', msg.id, 'for words:', queryWords.filter(w => searchText.includes(w)));
          }
          return hasWordMatch;
        });
        
        console.log('🎯 DEBUGGING: Broad search found', broadMatches.length, 'matches');
        
        // Use broad matches if available
        if (broadMatches.length > 0) {
          return broadMatches.slice(0, 5);
        }
      }

      // Search by content keywords in regular messages (including image analysis)
      const contentMatches = allMessages.filter(msg => {
        // Skip messages we already found in extracted text search
        if (extractedTextMatches.some(match => match.id === msg.id)) {
          return false;
        }
        
        const searchText = (
          msg.content + ' ' + 
          (msg.ai_analysis || '') + ' ' + 
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
      const allMatches = [...extractedTextMatches, ...contentMatches, ...tagMatches];
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
      
      console.log('✅ DEBUGGING: Final sorted matches:', sortedMatches.length);
      sortedMatches.forEach((msg, index) => {
        console.log(`📄 DEBUGGING: Result ${index + 1}:`, {
          id: msg.id,
          type: msg.type,
          title: msg.extracted_title || 'No title',
          hasExtractedText: !!msg.extracted_text,
          extractedTextLength: msg.extracted_text?.length || 0,
          wordCount: msg.word_count || 0
        });
      });
      
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
        content: `You're Bill, a chill personal assistant. Talk like a helpful friend, not a formal AI.

Keep it SHORT and natural:
- 1-2 sentences max unless they ask for details
- Use casual language like "I see you saved..." or "Looks like..."
- No formal phrases or AI-speak
- If you don't know something, just say "I don't have that info" 
- Be helpful but relaxed

Think: texting a friend who's good at organizing stuff.`
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

  // Generate tag suggestions based on content analysis
  async generateTagSuggestions(contentToAnalyze: string): Promise<string[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a smart tagging assistant. Analyze the content and suggest 4-6 relevant, specific tags that would help organize this content. Focus on topics, categories, and key themes. Return only the tags as a comma-separated list, no explanations.'
          },
          {
            role: 'user',
            content: `Analyze this content and suggest relevant tags:\n\n${contentToAnalyze}`
          }
        ],
        max_tokens: 60,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return [];
      }

      // Parse the response into individual tags
      return response
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0 && tag.length <= 25)
        .slice(0, 6); // Limit to 6 tags
    } catch (error) {
      console.error('Error generating tag suggestions:', error);
      return [];
    }
  }

  // Analyze image content using superfast FastImageAnalyzer
  async analyzeImageContent(imageUrl: string): Promise<string> {
    try {
      console.log('⚡ Using superfast image analyzer for:', imageUrl);
      
      // Use the new FastImageAnalyzer for lightning-fast results
      const FastImageAnalyzer = await import('./fast-image-analyzer');
      const fastAnalyzer = FastImageAnalyzer.default.getInstance();
      
      const analysis = await fastAnalyzer.analyzeImageFast(imageUrl);
      const description = fastAnalyzer.generateDescription(analysis);
      
      console.log(`⚡ Superfast image analysis completed in ${analysis.processingTime}ms`);
      console.log('✅ Generated description:', description.substring(0, 100) + '...');
      
      return description;
    } catch (error) {
      console.error('❌ Error in superfast image analysis:', error);
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
            content: `You're Bill, a chill personal assistant. Talk like a helpful friend, not a formal AI.

Keep it SHORT and natural:
- 1-2 sentences max unless they ask for details
- Use casual language like "I see you saved..." or "Looks like..."
- No formal phrases or AI-speak
- If you don't know something, just say "I don't have that info" 
- Be helpful but relaxed

Think: texting a friend who's good at organizing stuff.`
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
        if (msg.extracted_text && msg.extracted_text.length > 50) {
          hasContent = true;
          console.log(`🎯 Adding extracted text to prompt: ${msg.extracted_title}, length: ${msg.extracted_text.length}`);
          
          prompt += `DOCUMENT CONTENT (Saved Document ${contentIndex}):\n`;
          prompt += `Title: ${msg.extracted_title || 'Untitled'}\n`;
          prompt += `Word Count: ${msg.word_count || 'Unknown'}\n`;
          prompt += `Content Type: ${msg.type.toUpperCase()}\n`;
          prompt += `URL: ${msg.file_url || 'N/A'}\n\n`;
          prompt += `FULL TEXT CONTENT:\n${msg.extracted_text}\n`;
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
        
        // Also check for any other content that might have analysis
        if (!msg.extracted_text && msg.type === 'link' && msg.content && msg.content.length > 100) {
          console.log(`📄 Adding link content without extracted_text: ${msg.content.substring(0, 100)}`);
          prompt += `LINK CONTENT (Saved Link ${contentIndex}):\n`;
          prompt += `Content Type: LINK\n`;
          prompt += `URL: ${msg.file_url || msg.content}\n`;
          prompt += `Description: ${msg.content}\n`;
          if (msg.tags && msg.tags.length > 0) {
            prompt += `Tags: ${msg.tags.join(', ')}\n`;
          }
          prompt += `---END OF LINK---\n\n`;
          contentIndex++;
          hasContent = true;
        }
      });
      
      if (!hasContent) {
        console.log('⚠️ No extracted content found, showing available messages:');
        context.relevantContent.forEach((msg, index) => {
          console.log(`📋 Message ${index + 1}:`, {
            id: msg.id,
            type: msg.type,
            hasExtractedText: !!msg.extracted_text,
            extractedTextLength: msg.extracted_text?.length || 0,
            contentLength: msg.content?.length || 0,
            title: msg.extracted_title || 'No title'
          });
        });
        
        prompt += `AVAILABLE SAVED CONTENT:\n`;
        context.relevantContent.forEach((msg, index) => {
          prompt += `Item ${index + 1}: ${msg.type.toUpperCase()}`;
          if (msg.extracted_title) prompt += ` - ${msg.extracted_title}`;
          if (msg.file_url) prompt += ` (${msg.file_url})`;
          prompt += `\nContent: ${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}\n\n`;
        });
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
    
    prompt += `\nRespond naturally using the content above. If you have the full document text, answer specifically from that content. If you only have basic info, say so and offer to help differently.`;
    
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
    
    // Get actual extracted content titles and themes from database
    const extractedTitles = messages
      .filter(m => m.extracted_title && m.extracted_title.length > 0)
      .map(m => m.extracted_title)
      .slice(-5);
    
    // Get actual extracted text snippets for theme analysis
    const extractedTextSnippets = messages
      .filter(m => m.extracted_text && m.extracted_text.length > 100)
      .map(m => {
        // Get first 200 characters of extracted text to identify themes
        const snippet = m.extracted_text!.substring(0, 200);
        return snippet;
      })
      .slice(-3);
    
    // Analyze image content themes from actual AI analysis
    const imageAnalysis = messages
      .filter(m => m.type === 'image' && m.content.includes('Image shared -'))
      .map(m => {
        const analysis = m.content.replace('Image shared - ', '').replace('...', '');
        // Extract key themes from the actual image analysis
        return analysis.substring(0, 150);
      })
      .slice(-3);
    
    // Get actual user tags (not generic ones)
    const userTags = messages
      .filter(m => m.tags && m.tags.length > 0)
      .flatMap(m => m.tags!)
      .reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const topUserTags = Object.entries(userTags)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => `${tag} (${count})`);
    
    // Build detailed content description using actual user data
    let contentDesc = `User has saved: ${summary.join(', ')}.`;
    
    if (extractedTitles.length > 0) {
      contentDesc += ` Document titles: ${extractedTitles.join(', ')}.`;
    }
    
    if (extractedTextSnippets.length > 0) {
      contentDesc += ` Content themes from extracted text: ${extractedTextSnippets.join(' | ')}.`;
    }
    
    if (imageAnalysis.length > 0) {
      contentDesc += ` Image analysis: ${imageAnalysis.join(' | ')}.`;
    }
    
    if (topUserTags.length > 0) {
      contentDesc += ` User's actual tags: ${topUserTags.join(', ')}.`;
    }
    
    // Add URL domains for link analysis
    const linkDomains = messages
      .filter(m => m.type === 'link' && m.file_url)
      .map(m => {
        try {
          return new URL(m.file_url!).hostname.replace('www.', '');
        } catch {
          return 'unknown';
        }
      })
      .slice(-5);
    
    if (linkDomains.length > 0) {
      contentDesc += ` Link sources: ${linkDomains.join(', ')}.`;
    }
    
    // Add word count from actual extracted content
    const totalExtractedWords = messages
      .filter(m => m.word_count && m.word_count > 0)
      .reduce((sum, m) => sum + (m.word_count || 0), 0);
    
    if (totalExtractedWords > 0) {
      contentDesc += ` Total extracted words: ${totalExtractedWords}.`;
    }
    
    console.log('📊 Content summary for questions:', contentDesc);
    return contentDesc;
  }

  private getFallbackQuestions(messages: ChatMessage[], extractedContent: any[], limit: number): string[] {
    const fallbacks = [];
    
    if (messages.length > 0) {
      // Get most common tags for specific questions
      const allTags = messages
        .filter(m => m.tags && m.tags.length > 0)
        .flatMap(m => m.tags!)
        .reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      
      const topTags = Object.entries(allTags)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([tag]) => tag);
      
      // Content-specific questions based on what user actually has
      if (messages.some(m => m.type === 'image')) {
        fallbacks.push("What's in my recent photos?");
        fallbacks.push("Analyze my uploaded images?");
      }
      
      if (messages.some(m => m.type === 'file')) {
        fallbacks.push("Summarize my documents?");
        fallbacks.push("What PDFs have I saved?");
      }
      
      if (messages.some(m => m.type === 'link')) {
        fallbacks.push("What articles did I save?");
        fallbacks.push("Show me my saved links?");
      }
      
      // Tag-specific questions
      if (topTags.length > 0) {
        if (topTags.includes('work') || topTags.includes('Work')) {
          fallbacks.push("Show me my work-related content?");
        }
        if (topTags.includes('health') || topTags.includes('Health')) {
          fallbacks.push("What health content did I save?");
        }
        if (topTags.includes('travel') || topTags.includes('Travel')) {
          fallbacks.push("Find my travel-related saves?");
        }
        
        // Generic tag question with actual tag
        if (topTags[0]) {
          fallbacks.push(`Show me my ${topTags[0]} content?`);
        }
      }
      
      // Relationship questions based on content mix
      const hasImages = messages.some(m => m.type === 'image');
      const hasDocuments = messages.some(m => m.type === 'file');
      const hasLinks = messages.some(m => m.type === 'link');
      
      if (hasImages && hasDocuments) {
        fallbacks.push("Connect my photos to my documents?");
      }
      if (hasLinks && hasDocuments) {
        fallbacks.push("How do my articles relate to my files?");
      }
      
      // Time-based questions
      const recentCount = messages.filter(m => {
        const messageDate = new Date(m.created_at);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return messageDate > weekAgo;
      }).length;
      
      if (recentCount > 5) {
        fallbacks.push("What did I save this week?");
      }
      
      // Content volume questions
      if (extractedContent.length > 3) {
        fallbacks.push("Find key insights from my content?");
        fallbacks.push("What are the main themes I save?");
      }
    }
    
    // Smart general fallbacks only if no content-specific ones
    if (fallbacks.length === 0) {
      fallbacks.push(
        "What should I save first?",
        "How can you help me organize?",
        "What types of content can I upload?"
      );
    } else {
      // Add a few general ones to mix
      fallbacks.push(
        "What have I saved recently?",
        "Help me find something specific?",
        "Organize my content by topic?"
      );
    }
    
    return fallbacks.slice(0, limit);
  }
}

export default OpenAIService;
