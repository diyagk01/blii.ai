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

interface ConversationState {
  lastAIResponse: string;
  lastUserQuery: string;
  conversationContext: string;
  followUpExpected: boolean;
  lastActionOffered: string;
}

class OpenAIService {
  private static instance: OpenAIService;
  private openai: OpenAI;
  private chatService = ChatService.getInstance();
  private authService = SupabaseAuthService.getInstance();
  private contentExtractor = contentExtractor;
  private conversationState: ConversationState = {
    lastAIResponse: '',
    lastUserQuery: '',
    conversationContext: '',
    followUpExpected: false,
    lastActionOffered: ''
  };

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || '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',
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

  // Enhanced method to build database context with better debugging
  private async buildDatabaseContext(userQuery: string): Promise<DatabaseContext> {
    try {
      console.log('🔍 Building database context for query:', userQuery);
      
      // Get all messages with extracted content
      const allMessages = await this.chatService.getUserMessages(100);
      console.log(`📊 Retrieved ${allMessages.length} total messages from database`);
      
      // Debug: Log messages with extracted content
      const messagesWithExtractedText = allMessages.filter(msg => msg.extracted_text && msg.extracted_text.length > 0);
      console.log(`📄 Found ${messagesWithExtractedText.length} messages with extracted text`);
      
      messagesWithExtractedText.forEach((msg, index) => {
        console.log(`📋 Message ${index + 1}:`, {
          id: msg.id,
          type: msg.type,
          title: msg.extracted_title || 'No title',
          extractedTextLength: msg.extracted_text?.length || 0,
          wordCount: msg.word_count || 0,
          extractionStatus: msg.extraction_status || 'unknown'
        });
      });

      // PRIORITY 1: Search in recent messages with extracted_text first
      const relevantContent = allMessages.filter(msg => {
        const hasExtractedText = msg.extracted_text && msg.extracted_text.length > 100;
        const hasRelevantContent = msg.content && msg.content.toLowerCase().includes(userQuery.toLowerCase());
        const hasRelevantExtractedText = hasExtractedText && msg.extracted_text!.toLowerCase().includes(userQuery.toLowerCase());
        
        return hasRelevantContent || hasRelevantExtractedText;
      });

      console.log(`🎯 Found ${relevantContent.length} relevant messages with content matching query`);

      // If no direct matches, try semantic search in extracted text
      if (relevantContent.length === 0) {
        console.log('🔍 No direct matches found, performing semantic search in extracted content...');
        
        const semanticMatches = allMessages.filter(msg => {
          if (!msg.extracted_text || msg.extracted_text.length < 50) return false;
          
          // Simple keyword matching for now
          const queryWords = userQuery.toLowerCase().split(' ').filter(word => word.length > 3);
          const extractedText = msg.extracted_text.toLowerCase();
          
          return queryWords.some(word => extractedText.includes(word));
        });
        
        console.log(`🧠 Found ${semanticMatches.length} semantic matches`);
        relevantContent.push(...semanticMatches);
      }

      // Get recent conversation context
      const recentMessages = allMessages.slice(-10);
      
      // Generate content summary
      const contentSummary = this.generateContentSummary(relevantContent);
      
      // Generate user patterns
      const userPatterns = this.generateUserPatterns(allMessages);
      
      console.log('📊 Database context built successfully:', {
        totalMessages: allMessages.length,
        relevantContent: relevantContent.length,
        recentMessages: recentMessages.length,
        messagesWithExtractedText: messagesWithExtractedText.length
      });

      return {
        relevantContent,
        recentMessages,
        contentSummary,
        userPatterns
      };
    } catch (error) {
      console.error('❌ Error building database context:', error);
      return {
        relevantContent: [],
        recentMessages: [],
        contentSummary: 'Unable to analyze content',
        userPatterns: 'Unable to analyze patterns'
      };
    }
  }

  // Helper method to generate content summary
  private generateContentSummary(relevantContent: ChatMessage[]): string {
    if (relevantContent.length === 0) return 'No relevant content found';
    
    const contentTypes = relevantContent.map(msg => msg.type);
    const uniqueTypes = [...new Set(contentTypes)];
    
    return `Found ${relevantContent.length} relevant items: ${uniqueTypes.join(', ')}`;
  }

  // Helper method to generate user patterns
  private generateUserPatterns(allMessages: ChatMessage[]): string {
    if (allMessages.length === 0) return 'No user patterns available';
    
    const recentMessages = allMessages.slice(-20);
    const contentTypes = recentMessages.map(msg => msg.type);
    const typeCounts = contentTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostCommonType = Object.entries(typeCounts).sort(([,a], [,b]) => b - a)[0];
    return `User primarily saves ${mostCommonType?.[0] || 'content'} (${mostCommonType?.[1] || 0} items)`;
  }

  // Enhanced search that prioritizes recent, relevant content
  private async searchRelevantContentWithTemp(query: string, allMessages: ChatMessage[], extractedContent: any[]): Promise<ChatMessage[]> {
    try {
      console.log('🔎 ENHANCED SEARCH: Searching for relevant content...');
      console.log('🔎 Query:', query);
      console.log('🔎 Total messages to search:', allMessages.length);
      
      // Get recent messages first (last 30 messages for better coverage)
      const recentMessages = allMessages.slice(-30);
      console.log('📅 Focusing on recent 30 messages first');
      
      // CRITICAL: Check if user is asking about a recently uploaded document
      const isDocumentQuery = query.toLowerCase().includes('document') || 
                              query.toLowerCase().includes('transcript') ||
                              query.toLowerCase().includes('file') ||
                              query.toLowerCase().includes('pdf') ||
                              query.toLowerCase().includes('article') ||
                              query.toLowerCase().includes('text') ||
                              query.toLowerCase().includes('content') ||
                              query.toLowerCase().includes('it') ||
                              query.toLowerCase().includes('this') ||
                              query.toLowerCase().includes('that');
      
      if (isDocumentQuery) {
        console.log('📄 DOCUMENT QUERY DETECTED - Prioritizing recently uploaded content');
        
        // Get the most recently uploaded documents/files/links with extracted content
        const recentUploads = recentMessages
          .filter(msg => 
            (msg.type === 'file' || msg.type === 'link') && 
            msg.extracted_text && 
            msg.extracted_text.length > 100
          )
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3); // Get top 3 most recent uploads
        
        if (recentUploads.length > 0) {
          console.log('🎯 FOUND RECENT UPLOADS WITH EXTRACTED CONTENT:', recentUploads.length);
          recentUploads.forEach((msg, index) => {
            console.log(`📄 Recent upload ${index + 1}:`, {
              id: msg.id,
              type: msg.type,
              title: msg.extracted_title || 'No title',
              filename: msg.filename || 'No filename',
              extractedLength: msg.extracted_text?.length || 0,
              wordCount: msg.word_count || 0,
              created: msg.created_at
            });
          });
          
          // Return recent uploads - they are likely what the user is asking about
          return recentUploads;
        }
      }
      
      // Extract keywords from user query for semantic search
      const keywords = await this.extractKeywords(query);
      console.log('🏷️ Keywords:', keywords);
      
      // PRIORITY 1: Search in recent messages with extracted_text first
      const recentMessagesWithContent = recentMessages.filter(msg => 
        msg.extracted_text && msg.extracted_text.length > 100
      );
      
      console.log('🔍 PRIORITY 1: Recent messages with content:', recentMessagesWithContent.length);
      
      if (recentMessagesWithContent.length > 0) {
        // Log what we found for debugging
        recentMessagesWithContent.forEach((msg, index) => {
          console.log(`📄 Content message ${index + 1}:`, {
            id: msg.id,
            type: msg.type,
            title: msg.extracted_title || 'No title',
            extractedLength: msg.extracted_text?.length || 0,
            created: msg.created_at
          });
        });
      }
      
      const recentMatches = recentMessagesWithContent.filter(msg => {
        const searchText = (
          (msg.extracted_text || '') + ' ' + 
          (msg.extracted_title || '') + ' ' + 
          (msg.content || '') + ' ' +
          (msg.filename || '')
        ).toLowerCase();
        
        const hasMatch = keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
        if (hasMatch) {
          console.log('🎯 PRIORITY 1 MATCH:', {
            id: msg.id,
            title: msg.extracted_title || msg.filename || 'No title',
            created: msg.created_at,
            type: msg.type,
            matchingKeywords: keywords.filter(k => searchText.includes(k.toLowerCase()))
          });
        }
        return hasMatch;
      });
      
      // If we have recent matches, prioritize them heavily
      if (recentMatches.length > 0) {
        console.log('✅ PRIORITY 1: Found', recentMatches.length, 'recent relevant matches');
        
        // Sort recent matches by most recent first
        const sortedRecentMatches = recentMatches.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        // Return only the most recent and relevant, limit to 3 for focus
        return sortedRecentMatches.slice(0, 3);
      }
      
      // PRIORITY 2: If no keyword matches but user seems to be asking about recent content
      if (isDocumentQuery && recentMessagesWithContent.length > 0) {
        console.log('🔍 PRIORITY 2: No keyword matches but document query - returning recent content');
        
        // Return most recent content even without keyword matches
        const sortedByRecency = recentMessagesWithContent.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        return sortedByRecency.slice(0, 2);
      }
      
      // PRIORITY 3: Search in all messages but still prioritize recent
      console.log('🔍 PRIORITY 3: Searching all messages...');
      
      const allMessagesWithContent = allMessages.filter(msg => 
        msg.extracted_text && msg.extracted_text.length > 100
      );
      
      const allMatches = allMessagesWithContent.filter(msg => {
        const searchText = (
          (msg.extracted_text || '') + ' ' + 
          (msg.extracted_title || '') + ' ' + 
          (msg.content || '')
        ).toLowerCase();
        
        return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
      });
      
      if (allMatches.length > 0) {
        console.log('✅ PRIORITY 3: Found', allMatches.length, 'total matches');
        
        // Sort by recency and limit to top 3
        const sortedAllMatches = allMatches.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        return sortedAllMatches.slice(0, 3);
      }
      
      // PRIORITY 4: Fallback to any recent content
      console.log('🔍 PRIORITY 4: Fallback to any recent uploads...');
      
      const recentAnyContent = recentMessages.filter(msg => 
        msg.type === 'file' || msg.type === 'link' || msg.type === 'image'
      );
      
      if (recentAnyContent.length > 0) {
        console.log('✅ PRIORITY 4: Found', recentAnyContent.length, 'recent uploads of any type');
        return recentAnyContent
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 2);
      }
      
      console.log('⚠️ No relevant content found');
      return [];
      
    } catch (error) {
      console.error('❌ Error in enhanced search:', error);
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
            content: `You are an expert content curator and tagging specialist. Your goal is to create ONE highly relevant, specific tag that best represents the core essence and primary topic of the content.

INSTRUCTIONS:
- Analyze the main subject, theme, or purpose of the content
- Focus on what this content is MOST ABOUT (not every detail)
- Prefer specific topics over generic categories
- Choose tags that would be meaningful for organizing and finding this content later
- Use clear, descriptive terms that capture the essence
- Return ONLY ONE tag - the most relevant one
- Make it 1-3 words maximum
- Use proper capitalization (Title Case)
- No explanations, just the single best tag

EXAMPLES:
- Article about sustainable energy → "Clean Energy"
- Recipe for pasta → "Italian Cooking" 
- Tutorial on React → "Web Development"
- News about AI breakthrough → "Artificial Intelligence"
- Financial market analysis → "Market Analysis"
- Travel guide for Japan → "Japan Travel"
- Workout routine → "Fitness"
- Product review → "Product Review"`
          },
          {
            role: 'user',
            content: `Analyze this ${contentType} and return the single most relevant tag:\n${contextDescription}`
          }
        ],
        max_tokens: 10,
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return [];
      }

      // Parse and clean the response - should only be 1 tag
      const cleanedTag = response.trim().replace(/['"]/g, '');
      return cleanedTag.length > 0 && cleanedTag.length <= 25 ? [cleanedTag] : [];
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
            content: `You are an expert content curator. Analyze the content deeply and suggest ONE primary tag that best captures what this content is fundamentally about.

ANALYSIS APPROACH:
- Read the entire content to understand the main theme
- Identify the primary subject matter, not secondary details
- Consider the content's purpose and target audience
- Focus on what someone would remember this content for
- Choose the most specific yet broadly applicable tag

TAG REQUIREMENTS:
- Return exactly ONE tag only
- Make it highly specific and descriptive
- Use 1-3 words maximum
- Proper Title Case capitalization
- Must be meaningful for content organization
- Should help users find this content later

EXAMPLES:
- Academic paper on neural networks → "Machine Learning"
- Blog post about startup funding → "Venture Capital" 
- Tutorial on photography techniques → "Photography Skills"
- News about climate policy → "Climate Policy"
- Recipe with cooking instructions → "Cooking Recipes"
- Investment advice article → "Investment Strategy"`
          },
          {
            role: 'user',
            content: `Analyze this content and return the single most relevant tag:\n\n${contentToAnalyze}`
          }
        ],
        max_tokens: 8,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return [];
      }

      // Parse and clean the response - should only be 1 tag
      const cleanedTag = response.trim().replace(/['"]/g, '');
      return cleanedTag.length > 0 && cleanedTag.length <= 25 ? [cleanedTag] : [];
    } catch (error) {
      console.error('Error generating tag suggestions:', error);
      return [];
    }
  }

  // Generate multiple AI tags for suggestions
  async generateMultipleTagSuggestions(contentToAnalyze: string, count: number = 2): Promise<string[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert content curator. Analyze the content deeply and suggest ${count} relevant tags that best capture different aspects of this content.

ANALYSIS APPROACH:
- Read the entire content to understand multiple themes
- Identify both primary and secondary subject matters
- Consider the content's purpose, audience, and context
- Focus on what someone would remember this content for
- Choose specific yet broadly applicable tags

TAG REQUIREMENTS:
- Return exactly ${count} tags separated by commas
- Make each tag highly specific and descriptive
- Use 1-3 words maximum per tag
- Proper Title Case capitalization
- Must be meaningful for content organization
- Should help users find this content later
- Tags should be different from each other

EXAMPLES:
- Academic paper on neural networks → "Machine Learning, Research"
- Blog post about startup funding → "Venture Capital, Business"
- Tutorial on photography techniques → "Photography, Tutorial"`
          },
          {
            role: 'user',
            content: `Analyze this content and return ${count} relevant tags separated by commas:\n\n${contentToAnalyze}`
          }
        ],
        max_tokens: 20,
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return [];
      }

      // Parse and clean the response - should be multiple tags separated by commas
      const tags = response.split(',')
        .map(tag => tag.trim().replace(/['"]/g, ''))
        .filter(tag => tag.length > 0 && tag.length <= 25)
        .slice(0, count);
      
      return tags;
    } catch (error) {
      console.error('OpenAI multiple tag generation failed:', error);
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
      console.log('🤖 Generating AI response with conversation flow handling...');
      console.log('📊 Current conversation state:', this.conversationState);
      
      // CRITICAL FIX: Check if this is a follow-up response FIRST
      const isFollowUp = this.detectFollowUpResponse(userMessage);
      const isPositiveResponse = this.detectPositiveResponse(userMessage);
      
      console.log('🔍 Conversation analysis:', {
        userMessage: userMessage,
        isFollowUp,
        isPositiveResponse,
        lastActionOffered: this.conversationState.lastActionOffered,
        followUpExpected: this.conversationState.followUpExpected,
        lastAIResponse: this.conversationState.lastAIResponse.substring(0, 100) + '...'
      });
      
      let response: string;
      
      // PRIORITY 1: Handle follow-up responses (yes/no/sure etc.) BEFORE database search
      if (isFollowUp && this.conversationState.followUpExpected && this.conversationState.lastActionOffered) {
        console.log('✅ PRIORITY 1: Detected follow-up response to offered action');
        console.log('🎯 Last action offered:', this.conversationState.lastActionOffered);
        
        // Handle follow-up response - bypass database search entirely
        response = await this.handleFollowUpResponse(userMessage, isPositiveResponse);
        
      } else if (isFollowUp && this.conversationState.followUpExpected) {
        console.log('✅ PRIORITY 2: Detected follow-up but no clear action - continuing conversation');
        
        // Continue conversation context without full database search
        response = await this.handleConversationContinuation(userMessage);
        
      } else {
        console.log('🔍 PRIORITY 3: New query - performing database search');
        
        // Handle new query with database search
        response = await this.handleNewQueryWithFallback(userMessage);
      }
      
      // Update conversation state
      this.conversationState.lastAIResponse = response;
      this.conversationState.lastUserQuery = userMessage;
      this.conversationState.followUpExpected = this.detectFollowUpInResponse(response);
      this.conversationState.lastActionOffered = this.extractLastAction(response);
      
      console.log('📊 Updated conversation state:', {
        followUpExpected: this.conversationState.followUpExpected,
        lastActionOffered: this.conversationState.lastActionOffered,
        responsePreview: response.substring(0, 100) + '...'
      });
      
      console.log('✨ AI response generated with improved conversation flow handling');
      return response;
    } catch (error: any) {
      console.error('❌ Error generating conversation-aware response:', error);
      
      // Fallback to simple response
      console.log('🔄 Falling back to simple response generation...');
      return await this.generateFallbackResponse(userMessage);
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
          // Limit content length to avoid overwhelming the AI and encourage concise responses
          const contentPreview = msg.extracted_text.length > 1000 
            ? msg.extracted_text.substring(0, 1000) + '...[content truncated for brevity]'
            : msg.extracted_text;
          prompt += `CONTENT SUMMARY:\n${contentPreview}\n`;
          // Note: user_intent field not available in current schema
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
          // Note: user_intent field not available in current schema
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
          // Note: user_intent field not available in current schema
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
    
    // Enhanced conversation context for better continuity
    prompt += `RECENT CONVERSATION CONTEXT:\n`;
    if (context.recentMessages.length > 0) {
      // Show more conversation context to help with continuity
      const conversationMessages = context.recentMessages.slice(-5);
      conversationMessages.forEach(msg => {
        const role = msg.is_bot ? 'Bill' : 'User';
        // Include full content for recent messages to maintain context
        prompt += `${role}: ${msg.content}\n`;
      });
    }
    
    // Detect if user is responding positively to a follow-up
    const isPositiveResponse = this.detectPositiveResponse(userMessage);
    const lastBotMessage = context.recentMessages.filter(m => m.is_bot).slice(-1)[0];
    
    if (isPositiveResponse && lastBotMessage) {
      prompt += `\nCONVERSATION CONTINUITY NOTE:
User just responded positively ("${userMessage}") to your previous response: "${lastBotMessage.content}"
Continue naturally from where you left off - don't repeat information you already provided.
If you offered a specific action (like "find similar articles" or "check other PDFs"), DO THAT NOW.
Build on the conversation, don't start over.\n`;
    }
    
    prompt += `\nRespond naturally using the content above. If you have the full document text, answer specifically from that content. If you only have basic info, say so and offer to help differently.`;
    
    return prompt;
  }

  // Detect if user message is a follow-up response (yes, no, sure, etc.)
  private detectFollowUpResponse(userMessage: string): boolean {
    const followUpKeywords = [
      'yes', 'yeah', 'sure', 'okay', 'ok', 'please', 'do it', 'go ahead',
      'no', 'nah', 'nope', 'not really', 'skip', 'pass',
      'more', 'details', 'tell me more', 'explain', 'elaborate',
      'similar', 'other', 'different', 'another', 'next'
    ];
    
    const lowerMessage = userMessage.toLowerCase().trim();
    
    // Enhanced detection: prioritize short responses that are clearly follow-ups
    const isShortResponse = userMessage.length <= 20;
    const isExactMatch = followUpKeywords.includes(lowerMessage);
    const startsWithKeyword = followUpKeywords.some(keyword => lowerMessage.startsWith(keyword + ' '));
    const containsKeyword = followUpKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // Short responses with keywords are almost always follow-ups
    let isFollowUp = false;
    if (isShortResponse && (isExactMatch || startsWithKeyword)) {
      isFollowUp = true;
    } else if (isExactMatch) {
      isFollowUp = true;
    } else if (containsKeyword && userMessage.length <= 50) {
      isFollowUp = true;
    }
    
    console.log('🔍 Enhanced follow-up detection:', {
      message: userMessage,
      messageLength: userMessage.length,
      lowerMessage,
      isShortResponse,
      isExactMatch,
      startsWithKeyword,
      containsKeyword,
      isFollowUp,
      matchedKeywords: followUpKeywords.filter(keyword => 
        lowerMessage === keyword || 
        lowerMessage.startsWith(keyword + ' ') ||
        lowerMessage.includes(keyword)
      )
    });
    
    return isFollowUp;
  }

  // Detect if user message is a positive response to a follow-up
  private detectPositiveResponse(userMessage: string): boolean {
    const positiveKeywords = [
      'yes', 'yeah', 'sure', 'okay', 'ok', 'please', 'do it', 'go ahead',
      'more', 'details', 'tell me more', 'explain', 'elaborate',
      'similar', 'other', 'different', 'another', 'next'
    ];
    
    const lowerMessage = userMessage.toLowerCase().trim();
    return positiveKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  // Extract the action from the last AI response
  private extractLastAction(aiResponse: string): string {
    // Look for action phrases in the AI response - ENHANCED PATTERNS
    const actionPatterns = [
      /want me to (.+?)\?/i,
      /should i (.+?)\?/i,
      /would you like me to (.+?)\?/i,
      /can i (.+?)\?/i,
      /look for (.+?)\?/i,
      /search for (.+?)\?/i,
      /find (.+?)\?/i,
      /suggest (.+?)\?/i,
      /recommend (.+?)\?/i,
      /provide (.+?)\?/i,
      /give you (.+?)\?/i,
      /show you (.+?)\?/i,
      /help you (.+?)\?/i
    ];
    
    for (const pattern of actionPatterns) {
      const match = aiResponse.match(pattern);
      if (match && match[1]) {
        const action = match[1].trim();
        console.log('🎯 Extracted action:', action);
        return action;
      }
    }
    
    // CRITICAL: Also look for direct offers without question marks
    const directOfferPatterns = [
      /I can suggest (.+?)[.!]/i,
      /I can recommend (.+?)[.!]/i,
      /I'll suggest (.+?)[.!]/i,
      /I'll recommend (.+?)[.!]/i,
      /Let me suggest (.+?)[.!]/i
    ];
    
    for (const pattern of directOfferPatterns) {
      const match = aiResponse.match(pattern);
      if (match && match[1]) {
        const action = `suggest ${match[1].trim()}`;
        console.log('🎯 Extracted direct offer:', action);
        return action;
      }
    }
    
    console.log('❌ No action extracted from response:', aiResponse.substring(0, 100) + '...');
    return '';
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

  // Generate focused response for reply functionality
  async generateFocusedResponse(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response generated');
      }

      return response;
    } catch (error) {
      console.error('❌ Error generating focused response:', error);
      throw error;
    }
  }

  // Generate intent-based follow-up question for a specific message
  async generateIntentBasedFollowUp(
    messageContent: string, 
    messageType: string, 
    userIntent?: string, 
    tags?: string[]
  ): Promise<string> {
    try {
      console.log('🎯 Generating intent-based follow-up for:', { messageType, userIntent, tags });

      // Build context from user intent and tags
      let contextClues = '';
      if (userIntent) {
        contextClues += `User's intent/note: "${userIntent}"`;
      }
      if (tags && tags.length > 0) {
        contextClues += `${contextClues ? '\n' : ''}User's tags: ${tags.join(', ')}`;
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are Bill, an AI assistant generating personalized follow-up questions based on user intent and context.

INSTRUCTIONS:
- Generate ONE specific, actionable follow-up question based on the user's intent and content
- Make it relevant to what the user seems to want to do with this content
- Keep it conversational and helpful (8-15 words)
- Consider the user's custom note/intent if provided
- Use the tags to understand the user's categorization intent

INTENT-BASED PERSONALIZATION:
- If user_intent suggests research/learning → suggest deeper analysis or connections
- If user_intent suggests work/productivity → suggest organization or application  
- If user_intent suggests personal interest → suggest exploration or related content
- If user_intent suggests reference → suggest retrieval or comparison scenarios
- If no specific intent → generate relevant content-specific question

EXAMPLES:
- Intent "for work presentation" → "Want me to extract key points for your presentation?"
- Intent "weekend reading" → "Should I find similar articles for your reading list?"
- Intent "research project" → "Need me to connect this with your other research?"
- No intent, but tagged "fitness" → "Want suggestions for related workout content?"

Return only the follow-up question, no explanations.`
          },
          {
            role: 'user',
            content: `Content: ${messageContent.substring(0, 200)}
Type: ${messageType}
${contextClues || 'No specific intent provided'}

Generate a personalized follow-up question:`
          }
        ],
        max_tokens: 30,
        temperature: 0.7,
      });

      const followUp = completion.choices[0]?.message?.content?.trim();
      
      if (!followUp || !followUp.includes('?')) {
        // Fallback to content-type specific questions
        return this.getDefaultFollowUpByType(messageType, tags);
      }

      console.log('✅ Generated intent-based follow-up:', followUp);
      return followUp;

    } catch (error) {
      console.error('❌ Error generating intent-based follow-up:', error);
      return this.getDefaultFollowUpByType(messageType, tags);
    }
  }

  // Fallback follow-up questions by content type
  private getDefaultFollowUpByType(messageType: string, tags?: string[]): string {
    const tagContext = tags && tags.length > 0 ? ` ${tags[0].toLowerCase()}` : '';
    
    switch (messageType) {
      case 'image':
        return `Want me to analyze this${tagContext} image in more detail?`;
      case 'file':
        return `Should I extract key insights from this${tagContext} document?`;
      case 'link':
        return `Want me to find related${tagContext} articles or content?`;
      default:
        return `Need help organizing this${tagContext} content?`;
    }
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

  // Enhanced PDF Q&A using the enhanced PDF processor
  async answerPDFQuestion(query: string): Promise<string> {
    try {
      console.log('📄 Answering PDF question with enhanced processing:', query);
      
      // Import the enhanced PDF processor dynamically to avoid circular dependency
      const EnhancedPDFProcessor = await import('./enhanced-pdf-processor');
      const enhancedPDFProcessor = EnhancedPDFProcessor.default.getInstance();
      
      // Use the enhanced PDF processor to answer questions about all PDFs
      const answer = await enhancedPDFProcessor.answerQuestionAboutPDFs(query);
      
      console.log('✅ PDF question answered successfully');
      return answer;
    } catch (error) {
      console.error('❌ Error answering PDF question:', error);
      
      // Fallback to regular database search
      console.log('🔄 Falling back to regular database search...');
      return await this.generateResponseWithDatabaseContext(query);
    }
  }

  // Detect if a query is specifically about PDFs
  private isPDFQuery(query: string): boolean {
    const pdfKeywords = [
      'pdf', 'document', 'file', 'paper', 'report', 'research',
      'study', 'article', 'book', 'manual', 'guide', 'documentation'
    ];
    
    const lowerQuery = query.toLowerCase();
    return pdfKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Reply to a specific message - pulls ONLY from that message's content
   */
  async replyToSpecificMessage(messageId: string, userQuery: string): Promise<string> {
    try {
      console.log('📍 REPLY TO SPECIFIC: Replying to message', messageId, 'with query:', userQuery);
      
      // Get the specific message
      const specificMessage = await this.chatService.getMessage(messageId);
      
      if (!specificMessage) {
        return "I can't find that specific message to reply to. It might have been deleted.";
      }
      
      console.log('📄 REPLY TO SPECIFIC: Found message:', {
        id: specificMessage.id,
        type: specificMessage.type,
        title: specificMessage.extracted_title,
        hasExtractedText: !!specificMessage.extracted_text,
        contentLength: specificMessage.content.length
      });
      
      // Create focused context ONLY from this specific message
      let messageContent = '';
      let contentType = '';
      
      if (specificMessage.extracted_text && specificMessage.extracted_text.length > 100) {
        // Use extracted content for documents/PDFs/links
        contentType = `${specificMessage.type.toUpperCase()} DOCUMENT`;
        messageContent = `SPECIFIC ${contentType} CONTENT:\n`;
        messageContent += `Title: ${specificMessage.extracted_title || 'Untitled'}\n`;
        messageContent += `Filename: ${specificMessage.filename || 'N/A'}\n`;
        messageContent += `Word Count: ${specificMessage.word_count || 'Unknown'}\n\n`;
        messageContent += `FULL EXTRACTED TEXT:\n${specificMessage.extracted_text}\n`;
        
        console.log('📄 REPLY TO SPECIFIC: Using extracted text content');
      } else if (specificMessage.type === 'image' && specificMessage.content.includes('Image shared -')) {
        // Use image analysis content
        contentType = 'IMAGE';
        const imageAnalysis = specificMessage.content.replace('Image shared - ', '').replace('...', '');
        messageContent = `SPECIFIC IMAGE CONTENT:\n`;
        messageContent += `Filename: ${specificMessage.filename || 'Unknown'}\n`;
        messageContent += `File URL: ${specificMessage.file_url || 'N/A'}\n\n`;
        messageContent += `VISUAL ANALYSIS:\n${imageAnalysis}\n`;
        
        console.log('📄 REPLY TO SPECIFIC: Using image analysis content');
      } else {
        // Use basic message content
        contentType = specificMessage.type.toUpperCase();
        messageContent = `SPECIFIC ${contentType} CONTENT:\n`;
        if (specificMessage.filename) messageContent += `Filename: ${specificMessage.filename}\n`;
        if (specificMessage.file_url) messageContent += `URL: ${specificMessage.file_url}\n`;
        messageContent += `Content: ${specificMessage.content}\n`;
        
        console.log('📄 REPLY TO SPECIFIC: Using basic content');
      }
      
      // Generate response focused ONLY on this specific content
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You're Bill, responding to a user's question about a SPECIFIC piece of content they uploaded. 

CRITICAL RULES:
1. Answer ONLY based on the specific content provided below
2. Do NOT reference any other documents, images, or content
3. Do NOT pull from conversation history or other materials
4. If the specific content doesn't contain the answer, say "That specific ${contentType.toLowerCase()} doesn't contain information about [topic]"
5. Be conversational and helpful, but stay focused on ONLY this one piece of content
6. Use phrases like "In this ${contentType.toLowerCase()}..." or "This specific document shows..."

Keep it natural and helpful, but absolutely constrained to this one item.`
          },
          {
            role: 'user',
            content: `User's question: "${userQuery}"\n\n${messageContent}\n\nAnswer based ONLY on the content above. Do not reference anything else.`
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return `I couldn't generate a response about that specific ${contentType.toLowerCase()}. Please try again.`;
      }

      console.log('✅ REPLY TO SPECIFIC: Generated focused response');
      return response;
      
    } catch (error) {
      console.error('❌ REPLY TO SPECIFIC: Error replying to specific message:', error);
      return "I encountered an error while analyzing that specific content. Please try again.";
    }
  }

  /**
   * Enhanced method to get a specific message with all content
   */
  private async getSpecificMessageContent(messageId: string): Promise<ChatMessage | null> {
    try {
      const message = await this.chatService.getMessage(messageId);
      return message;
    } catch (error) {
      console.error('❌ Error getting specific message:', error);
      return null;
    }
  }

  // Get recent conversation messages for context
  private async getRecentConversationContext(limit: number = 5): Promise<any[]> {
    try {
      const messages = await this.chatService.getUserMessages(limit);
      // Return most recent messages (reverse order since getUserMessages returns chronological)
      return messages.slice(-limit).reverse();
    } catch (error) {
      console.error('❌ Error getting recent conversation context:', error);
      return [];
    }
  }

  // Handle follow-up responses (yes, no, etc.) - IMPROVED
  private async handleFollowUpResponse(userMessage: string, isPositive: boolean): Promise<string> {
    try {
      const lastAction = this.conversationState.lastActionOffered;
      const lastResponse = this.conversationState.lastAIResponse;
      const conversationContext = this.conversationState.conversationContext;
      
      console.log('🔄 Handling follow-up response:', {
        userMessage,
        isPositive,
        lastAction,
        lastResponsePreview: lastResponse.substring(0, 100) + '...',
        contextPreview: conversationContext.substring(0, 100) + '...'
      });
      
      // Get recent conversation context for better responses
      const recentMessages = await this.getRecentConversationContext(5);
      
      if (isPositive && lastAction) {
        // User said yes to an action - execute it
        console.log('✅ User agreed to action:', lastAction);
        return await this.executeOfferedAction(lastAction);
      } else {
        // Generate contextual response using recent conversation
        console.log('🎯 Generating contextual follow-up response');
        return await this.generateContextualFollowUp(userMessage, recentMessages, isPositive);
      }
    } catch (error) {
      console.error('❌ Error handling follow-up response:', error);
      return "Sorry, I got confused. What would you like to know about your saved content?";
    }
  }

  // Generate contextual follow-up response based on recent conversation
  private async generateContextualFollowUp(userMessage: string, recentMessages: any[], isPositive: boolean): Promise<string> {
    try {
      // Build conversation context from recent messages
      const conversationHistory = recentMessages.map(msg => {
        if (msg.type === 'link' && msg.referencedContent) {
          return `User shared: ${msg.referencedContent.title || 'Link'} - ${msg.referencedContent.description || 'No description'}`;
        } else if (msg.type === 'image') {
          return `User shared: Image`;
        } else if (msg.type === 'file') {
          return `User shared: ${msg.filename || 'File'}`;
        } else {
          return `${msg.isBot ? 'AI' : 'User'}: ${msg.content}`;
        }
      }).join('\n');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant engaged in a conversation about content the user has shared. 

Based on the conversation history, provide a relevant, contextual response to the user's follow-up message. 

Guidelines:
- Reference the content they've shared when relevant
- Provide specific, helpful insights rather than generic responses
- If they're asking for a summary, provide a concise 2-3 sentence overview
- If they want details, focus on the most important points
- Keep responses conversational and engaging
- Don't repeat information you've already provided

Recent conversation context:
${conversationHistory}`
          },
          {
            role: 'user',
            content: `User's follow-up message: "${userMessage}"\n\nProvide a contextual, helpful response based on our conversation about the content they've shared.`
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || "I'd be happy to help you with that. What specific aspect would you like to explore?";
      
      // Update conversation state
      this.conversationState.followUpExpected = response.includes('?') || response.includes('Would you like') || response.includes('want to');
      this.conversationState.lastActionOffered = '';
      
      return response;
    } catch (error) {
      console.error('❌ Error generating contextual follow-up:', error);
      return "I'd be happy to help you explore that topic further. What specific aspect interests you most?";
    }
  }

  // Handle positive response when no specific action was offered
  private async handlePositiveResponseWithoutAction(userMessage: string): Promise<string> {
    try {
      // Try to continue based on the last conversation context
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `The user responded positively ("${userMessage}") to your previous response. Continue the conversation naturally by providing more information or asking what specific help they need.\n\nKeep it short and helpful. Don't repeat what you just said.`
          },
          {
            role: 'user',
            content: `My previous response: "${this.conversationState.lastAIResponse}"\n\nUser's positive response: "${userMessage}"\n\nContinue naturally.`
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      return response || "Great! What specific information are you looking for?";
    } catch (error) {
      console.error('❌ Error handling positive response without action:', error);
      return "Great! What specific information are you looking for?";
    }
  }

  // Handle conversation continuation for follow-ups without clear actions
  private async handleConversationContinuation(userMessage: string): Promise<string> {
    try {
      console.log('🔄 Handling conversation continuation...');
      
      // Use the context from the last response to continue naturally
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You're Bill continuing a conversation. The user just responded with "${userMessage}" to your previous response: "${this.conversationState.lastAIResponse}".\n\nContinue the conversation naturally:\n- Don't repeat what you just said\n- Build on the previous context\n- Keep it short and conversational\n- If they seem to want more info, provide it\n- If they seem done with the topic, offer to help with something else`
          },
          {
            role: 'user',
            content: `Continue our conversation. My response: "${userMessage}"`
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      return response || "What else would you like to know about your saved content?";
    } catch (error) {
      console.error('❌ Error in conversation continuation:', error);
      return "What else would you like to know about your saved content?";
    }
  }

  // Handle new queries with database search and better fallback
  private async handleNewQueryWithFallback(userMessage: string): Promise<string> {
    try {
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
      
      // CRITICAL: Check if we have relevant content before proceeding
      if (dbContext.relevantContent.length === 0 && !requiresRealTimeInfo) {
        console.log('⚠️ No relevant content found - providing helpful LLM response');
        return await this.generateHelpfulLLMResponse(userMessage);
      }
      
      // Format context for AI
      const contextPrompt = this.formatDatabaseContextForAI(dbContext, userMessage) + realTimeContext;
      
      // Generate response using full context
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You're Bill, a chill personal assistant. Talk like a helpful friend, not a formal AI.\n\nKeep responses SHORT and natural:\n- 1-2 sentences max unless they ask for details\n- Use casual language like "I see you saved..." or "Looks like..."\n- No formal phrases or AI-speak\n- If you don't find relevant saved content, be a helpful LLM and answer the question directly\n\nINTENT-BASED PERSONALIZATION:\n- Pay attention to USER'S INTENT/NOTE fields - these show WHY they saved content\n- Tailor your follow-ups based on their stated purpose:\n  * "work project" → suggest organization, key points, or presentation help\n  * "weekend reading" → suggest similar content or related topics\n  * "research" → offer deeper analysis or connections to other content\n  * "reference" → suggest ways to categorize or retrieve later\n- If no intent given, use tags and content type to infer purpose\n\nFOLLOW-UP GUIDELINES:\n- Instead of generic "want to dive deeper?" make follow-ups SPECIFIC to:\n  1. What you just discussed\n  2. Their stated intent/purpose for the content\n- Examples: "Want me to extract key points for your work presentation?" or "Should I find similar weekend reading materials?"\n- Base follow-ups on actual content AND user intent\n\nCONVERSATION CONTINUITY:\n- Remember what you just told them when they respond positively\n- Build on the previous response, don't start over\n- If they say "yes", "sure", "please do" - take the specific action you offered\n\nNO SAVED CONTENT HANDLING:\n- If no relevant saved content is found, answer the question using your knowledge as an LLM\n- Don't say "I don't have that in your saved content" - just answer helpfully\n- Be a smart assistant who can help even when database is empty\n\nThink: texting a friend who knows your goals and remembers the conversation flow.`
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

      return response;
    } catch (error) {
      console.error('❌ Error handling new query:', error);
      return await this.generateHelpfulLLMResponse(userMessage);
    }
  }

  // Generate helpful LLM response when no database content is found
  private async generateHelpfulLLMResponse(userMessage: string): Promise<string> {
    try {
      console.log('🧠 Generating helpful LLM response for:', userMessage);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You're Bill, a helpful AI assistant. The user asked a question but doesn't have relevant saved content for it.\n\nProvide a concise but thorough response (2-4 sentences) based on your knowledge, but be conservative and accurate.\n\nGuidelines:\n- Keep responses concise but helpful\n- Be helpful but don't overstate or guess\n- If you're not confident about something, say so\n- Suggest they save related content for future reference\n- Don't mention "saved content" or "database" - just answer naturally`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 250,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      return response || "I'm not sure about that one. Want to save some content about it so I can help better next time?";
    } catch (error) {
      console.error('❌ Error generating helpful LLM response:', error);
      return "I'm not sure about that one. Want to save some content about it so I can help better next time?";
    }
  }

  // Improved fallback response
  private async generateFallbackResponse(userMessage: string): Promise<string> {
    try {
      return await this.generateResponse(userMessage);
    } catch (error) {
      console.error('❌ All response methods failed:', error);
      return "I'm having some trouble right now. Could you try asking me something else?";
    }
  }

  // Handle new queries with database search
  private async handleNewQuery(userMessage: string): Promise<string> {
    try {
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
      
      // Generate response using full context
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You're Bill, a helpful AI assistant. Answer questions based ONLY on the provided content. 

CRITICAL RULES:
- ONLY use information from the provided documents/content
- If the answer isn't in the provided content, say "I don't have that specific information in your saved content"
- NEVER make up or guess information
- NEVER mention external knowledge or sources not provided

RESPONSE STYLE:
- Keep responses concise but thorough (2-4 sentences)
- Use casual, friendly tone
- Reference specific details from the provided content
- If you reference content, mention what you're looking at (e.g., "Looking at your saved article about...")
- When asked for summaries, provide 2-3 key points, not the full content
- Focus on the most important insights rather than repeating everything

EXAMPLES:
- "Based on your saved article, the main point is... The document also mentions... This suggests that..."
- "From your document, I can see that... This is important because..."
- "I don't have that specific information in your saved content"

Remember: Only use what's provided, be concise but helpful, and stay relevant.`
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

      return response;
    } catch (error) {
      console.error('❌ Error handling new query:', error);
      return "I'm having trouble accessing your saved content right now. Try asking me something specific about what you've saved.";
    }
  }

  // Execute the action that was offered to the user
  private async executeOfferedAction(action: string): Promise<string> {
    try {
      console.log('🚀 Executing offered action:', action);
      
      // Parse the action and execute accordingly - be more specific about actions
      if (action.includes('suggest') && (action.includes('websites') || action.includes('blogs') || action.includes('resources'))) {
        return await this.provideSpecificSuggestions(action);
      } else if (action.includes('recommend') && (action.includes('websites') || action.includes('resources'))) {
        return await this.provideSpecificSuggestions(action);
      } else if (action.includes('find similar') || action.includes('similar articles')) {
        return await this.findSimilarContent();
      } else if (action.includes('check other') || action.includes('other PDFs')) {
        return await this.findRelatedDocuments();
      } else if (action.includes('more details') || action.includes('elaborate')) {
        return await this.provideMoreDetails();
      } else if (action.includes('similar articles') || action.includes('similar content') || action.includes('similar photography') || action.includes('similar images')) {
        return await this.findSimilarContent();
      } else if (action.includes('more details') || action.includes('elaborate') || action.includes('details about')) {
        return await this.provideMoreDetails();
      } else if (action.includes('find') || action.includes('search') || action.includes('look for')) {
        return await this.executeSearchAction(action);
      } else {
        // For any other specific action, try to fulfill it directly
        return await this.executeSpecificAction(action);
      }
    } catch (error) {
      console.error('❌ Error executing action:', error);
      return "Sorry, I couldn't complete that action. What else would you like to know about your saved content?";
    }
  }

  // Provide specific suggestions when the AI offered to suggest resources/websites
  private async provideSpecificSuggestions(action: string): Promise<string> {
    try {
      console.log('💡 Providing specific suggestions for action:', action);
      
      // Use the conversation context to determine what suggestions to provide
      const lastQuery = this.conversationState.lastUserQuery.toLowerCase();
      const lastResponse = this.conversationState.lastAIResponse.toLowerCase();
      
      // Generate relevant suggestions based on the context
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You're Bill. The user asked about "${this.conversationState.lastUserQuery}" and you offered to suggest resources. Now they said yes, so provide the specific suggestions you offered. Be helpful and specific - give actual website names, blogs, or resources related to their topic.

Keep it conversational and helpful. Don't mention "saved content" - just provide the suggestions you promised.`
          },
          {
            role: 'user',
            content: `User asked: "${this.conversationState.lastUserQuery}"
Your previous response: "${this.conversationState.lastAIResponse}"
Action you offered: "${action}"

Now provide the specific suggestions you offered.`
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      return response || "Here are some great resources I'd recommend checking out!";
      
    } catch (error) {
      console.error('❌ Error providing specific suggestions:', error);
      return "I'd be happy to help you find those resources! What specific topic are you most interested in?";
    }
  }

  // Execute search-related actions
  private async executeSearchAction(action: string): Promise<string> {
    try {
      console.log('🔍 Executing search action:', action);
      
      // Try to search based on the last user query and the specific action
      const searchQuery = this.conversationState.lastUserQuery;
      const dbContext = await this.buildDatabaseContext(searchQuery);
      
      if (dbContext.relevantContent.length > 0) {
        const item = dbContext.relevantContent[0];
        const itemName = item.extracted_title || item.filename || 'content';
        return `I found this in your saved content: ${itemName}. ${item.content.substring(0, 150)}...`;
      } else {
        return `I don't have any saved content about "${searchQuery}" yet. Want to save some articles or documents about this topic?`;
      }
    } catch (error) {
      console.error('❌ Error in search action:', error);
      return "I couldn't search your content right now. What else can I help you with?";
    }
  }

  // Execute any other specific action the AI offered
  private async executeSpecificAction(action: string): Promise<string> {
    try {
      console.log('⚡ Executing specific action:', action);
      
      // Use AI to understand and execute the specific action based on context
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You're Bill. You previously offered to do something specific: "${action}". The user said yes, so now do exactly what you offered. Be specific and helpful.

If you offered to provide information, provide it.
If you offered to suggest something, suggest it.
If you offered to find something, try to find it.

Don't fall back to generic responses - fulfill the specific action you offered.`
          },
          {
            role: 'user',
            content: `Please execute this action you offered: "${action}"

Context - User asked: "${this.conversationState.lastUserQuery}"
Your previous response: "${this.conversationState.lastAIResponse}"`
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      return response || `I'll help you with ${action}. Let me know if you need anything else!`;
      
    } catch (error) {
      console.error('❌ Error executing specific action:', error);
      return "I'll help you with that. What specific information are you looking for?";
    }
  }

  // Handle negative responses
  private async handleNegativeResponse(userMessage: string): Promise<string> {
    return "No problem! What else would you like to know about your saved content?";
  }

  // Detect if the AI response includes a follow-up question
  private detectFollowUpInResponse(response: string): boolean {
    const followUpPatterns = [
      /want me to/i,
      /should i/i,
      /would you like me to/i,
      /can i/i,
      /\?$/
    ];
    
    return followUpPatterns.some(pattern => pattern.test(response));
  }

  // Find similar content based on the last query
  private async findSimilarContent(): Promise<string> {
    try {
      const lastQuery = this.conversationState.lastUserQuery;
      const dbContext = await this.buildDatabaseContext(lastQuery);
      
      if (dbContext.relevantContent.length > 1) {
        const similarItems = dbContext.relevantContent.slice(1, 3);
        const itemNames = similarItems.map(item => {
          if (item.type === 'link') {
            return item.content || 'link';
          } else if (item.type === 'file') {
            return item.filename || 'document';
          } else if (item.type === 'image') {
            return 'image';
          } else {
            return item.content || 'item';
          }
        }).join(', ');
        
        return `I found some similar content in your saved items: ${itemNames}. Would you like me to show you more details about any of these?`;
      } else {
        return "I don't have any similar content in your saved items right now. Would you like me to search for more information about this topic?";
      }
    } catch (error) {
      return "I couldn't find similar content. What else would you like to know?";
    }
  }

  // Find related documents
  private async findRelatedDocuments(): Promise<string> {
    try {
      const allMessages = await this.chatService.getUserMessages(50);
      const documents = allMessages.filter(msg => msg.type === 'file');
      
      if (documents.length > 0) {
        const docNames = documents.slice(0, 3).map(doc => doc.filename || 'document').join(', ');
        return `I found these documents: ${docNames}. Want me to check any of them for related content?`;
      } else {
        return "I don't see any documents in your saved items. Have you uploaded any files yet?";
      }
    } catch (error) {
      return "I couldn't access your documents right now. What else can I help you with?";
    }
  }

  // Provide more details about the last response
  private async provideMoreDetails(): Promise<string> {
    try {
      const lastQuery = this.conversationState.lastUserQuery;
      const dbContext = await this.buildDatabaseContext(lastQuery);
      
      if (dbContext.relevantContent.length > 0) {
        const item = dbContext.relevantContent[0];
        if (item.extracted_text && item.extracted_text.length > 100) {
          const details = item.extracted_text.substring(0, 200) + '...';
          return `Here are more details: ${details}`;
        } else {
          return "I don't have more detailed information about that item. Is there something specific you'd like to know?";
        }
      } else {
        return "I don't have more details about that. What else would you like to know?";
      }
    } catch (error) {
      return "I couldn't get more details right now. What else can I help you with?";
    }
  }

  // Execute a generic action
  private async executeGenericAction(action: string): Promise<string> {
    return `I'll help you ${action}. Let me check your saved content for that information...`;
  }

  // Reset conversation state (useful for new conversations)
  public resetConversationState(): void {
    this.conversationState = {
      lastAIResponse: '',
      lastUserQuery: '',
      conversationContext: '',
      followUpExpected: false,
      lastActionOffered: ''
    };
    console.log('🔄 Conversation state reset');
  }

  // Get current conversation state for debugging
  public getConversationState(): ConversationState {
    return { ...this.conversationState };
  }
}

export default OpenAIService;
