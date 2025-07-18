import OpenAI from 'openai';

interface PerplexityResponse {
  content: string;
  title?: string;
  summary: string;
  keyPoints: string[];
  source: string;
  timestamp: string;
  wordCount: number;
}

interface LinkAnalysis {
  url: string;
  content: string;
  title: string;
  summary: string;
  keyPoints: string[];
  metadata: {
    author?: string;
    publishDate?: string;
    domain: string;
    type: 'article' | 'video' | 'document' | 'social' | 'other';
  };
  extractedAt: string;
}

class PerplexityService {
  private static instance: PerplexityService;
  private openai: OpenAI;

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

  public static getInstance(): PerplexityService {
    if (!PerplexityService.instance) {
      PerplexityService.instance = new PerplexityService();
    }
    return PerplexityService.instance;
  }

  /**
   * Extract and analyze content from a URL using Perplexity/Sonar
   */
  async extractLinkContent(url: string): Promise<LinkAnalysis> {
    try {
      console.log('🔗 Starting Perplexity link extraction for:', url);
      
      const domain = this.extractDomain(url);
      const urlType = this.detectUrlType(url, domain);
      
      // Try different models based on domain and content type
      let responseText = '';
      let modelUsed = '';
      
      // For Paul Graham essays and similar content, try GPT-4o first
      if (domain === 'paulgraham.com' || domain.includes('essay') || domain.includes('blog')) {
        try {
          console.log('🔍 Using GPT-4o with web browsing for content extraction...');
          const completion = await this.openai.chat.completions.create({
            model: 'openai/gpt-4o',
            messages: [
              {
                role: 'user',
                content: `Go to this URL and copy the ENTIRE article text word-for-word: ${url}
                
                DO NOT summarize, analyze, or rewrite anything. Copy the full article text exactly as it appears on the webpage. Include every paragraph, quote, and detail. Return ONLY the raw article content with no additional commentary, analysis, or formatting.
                
                If you cannot access the full article, tell me exactly what you can see and why the content is limited.`
              }
            ],
            max_tokens: 3000,
            temperature: 0.0
          });
          
          responseText = completion.choices[0]?.message?.content || '';
          modelUsed = 'gpt-4o';
        } catch (error) {
          console.log('⚠️ GPT-4o failed, trying Perplexity/Sonar Deep Research...');
        }
      }
      
      // Try Perplexity/Sonar Deep Research with web browsing enabled
      if (!responseText) {
        try {
          console.log('🔍 Using Perplexity/Sonar Deep Research for content extraction...');
          const completion = await this.openai.chat.completions.create({
            model: 'perplexity/sonar-deep-research',
            messages: [
              {
                role: 'user',
                content: `Go to this URL and copy the ENTIRE article text word-for-word: ${url}
                
                DO NOT summarize, analyze, or rewrite anything. Copy the full article text exactly as it appears on the webpage. Include every paragraph, quote, and detail. Return ONLY the raw article content with no additional commentary, analysis, or formatting.
                
                If you cannot access the full article, tell me exactly what you can see and why the content is limited.`
              }
            ],
            max_tokens: 2000, // Reduced to avoid credit limit
            temperature: 0.0
          });
          
          responseText = completion.choices[0]?.message?.content || '';
          modelUsed = 'perplexity/sonar-deep-research';
        } catch (error) {
          console.log('⚠️ Perplexity/Sonar Deep Research failed, trying regular Sonar...');
        }
      }
      
      // Fallback to regular Perplexity/Sonar without browsing
      if (!responseText) {
        console.log('🔍 Using Perplexity/Sonar for content extraction...');
        const completion = await this.openai.chat.completions.create({
          model: 'perplexity/sonar',
          messages: [
            {
              role: 'user',
              content: `Go to this URL and copy the ENTIRE article text word-for-word: ${url}
              
              DO NOT summarize, analyze, or rewrite anything. Copy the full article text exactly as it appears on the webpage. Include every paragraph, quote, and detail. Return ONLY the raw article content with no additional commentary, analysis, or formatting.
              
              If you cannot access the full article, tell me exactly what you can see and why the content is limited.`
            }
          ],
          max_tokens: 2000, // Reduced to avoid credit limit
          temperature: 0.0
        });
        
        responseText = completion.choices[0]?.message?.content || '';
        modelUsed = 'perplexity/sonar';
      }
      
      if (!responseText) {
        throw new Error('No response from content extraction');
      }

      // Parse the text response to extract structured information
      let parsedResponse = this.parseTextResponse(responseText, url, domain, urlType);
      
      // Check if we got full content or just a summary
      // If content is too short (less than 200 words), try to get raw content
      const wordCount = parsedResponse.content.split(' ').length;
      if (wordCount < 200) {
        console.log('⚠️ Content seems too short, attempting raw content extraction...');
        const rawContent = await this.extractRawContent(url);
        if (rawContent.length > parsedResponse.content.length) {
          console.log('✅ Raw content is longer, using it instead');
          parsedResponse.content = rawContent;
        }
      }

      const analysis: LinkAnalysis = {
        url,
        content: parsedResponse.content || 'Content extraction failed',
        title: parsedResponse.title || `Content from ${domain}`,
        summary: parsedResponse.summary || 'Summary not available',
        keyPoints: parsedResponse.keyPoints || [],
        metadata: {
          author: parsedResponse.metadata?.author,
          publishDate: parsedResponse.metadata?.publishDate,
          domain,
          type: urlType
        },
        extractedAt: new Date().toISOString()
      };

      console.log('✅ Perplexity extraction completed:', {
        title: analysis.title,
        contentLength: analysis.content.length,
        keyPoints: analysis.keyPoints.length,
        domain: analysis.metadata.domain,
        modelUsed
      });

      return analysis;
    } catch (error) {
      console.error('❌ Perplexity extraction failed:', error);
      
      // Return fallback analysis
      const domain = this.extractDomain(url);
      return {
        url,
        content: `Unable to extract content from ${url}. This may be due to access restrictions or the content not being publicly available.`,
        title: `Content from ${domain}`,
        summary: `Content extraction failed for ${domain}`,
        keyPoints: [],
        metadata: {
          domain,
          type: 'other'
        },
        extractedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Search for information about a topic using Perplexity
   */
  async searchTopic(topic: string): Promise<PerplexityResponse> {
    try {
      console.log('🔍 Starting Perplexity topic search for:', topic);
      
      const completion = await this.openai.chat.completions.create({
        model: 'perplexity/sonar',
        messages: [
          {
            role: 'user',
            content: `Please search for and provide current, accurate information about: ${topic}
            
            Provide comprehensive, well-researched information with recent data and sources.`
          }
        ],
        max_tokens: 3000,
        temperature: 0.3
      });

      const responseText = completion.choices[0]?.message?.content || '';
      if (!responseText) {
        throw new Error('No response from Perplexity');
      }

      // Parse the text response to extract structured information
      const parsedResponse = this.parseTextResponse(responseText, topic, 'search', 'other');

      const response: PerplexityResponse = {
        content: parsedResponse.content || 'Search failed',
        title: parsedResponse.title || `Information about ${topic}`,
        summary: parsedResponse.summary || 'Summary not available',
        keyPoints: parsedResponse.keyPoints || [],
        source: parsedResponse.source || 'Perplexity search',
        timestamp: parsedResponse.timestamp || new Date().toISOString(),
        wordCount: parsedResponse.wordCount || parsedResponse.content?.split(' ').length || 0
      };

      console.log('✅ Perplexity search completed:', {
        title: response.title,
        contentLength: response.content.length,
        keyPoints: response.keyPoints.length
      });

      return response;
    } catch (error) {
      console.error('❌ Perplexity search failed:', error);
      throw error;
    }
  }

  /**
   * Analyze multiple links and provide comparative analysis
   */
  async analyzeMultipleLinks(urls: string[]): Promise<{
    individualAnalyses: LinkAnalysis[];
    comparativeAnalysis: string;
    commonThemes: string[];
  }> {
    try {
      console.log('🔗 Starting multi-link analysis for:', urls.length, 'URLs');
      
      // Extract content from each URL
      const analyses = await Promise.all(
        urls.map(url => this.extractLinkContent(url))
      );

      // Generate comparative analysis
      const completion = await this.openai.chat.completions.create({
        model: 'perplexity/sonar',
        messages: [
          {
            role: 'user',
            content: `Please analyze these ${analyses.length} pieces of content and provide a comparative analysis:
            
            ${analyses.map((analysis, index) => `
            Content ${index + 1} (${analysis.url}):
            Title: ${analysis.title}
            Summary: ${analysis.summary}
            Key Points: ${analysis.keyPoints.join(', ')}
            `).join('\n')}
            
            Provide a detailed comparison and identify common themes.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      const responseText = completion.choices[0]?.message?.content || '';
      const comparativeData = {
        comparativeAnalysis: responseText || 'Comparative analysis failed',
        commonThemes: this.extractThemesFromText(responseText)
      };

      return {
        individualAnalyses: analyses,
        comparativeAnalysis: comparativeData.comparativeAnalysis || 'Analysis failed',
        commonThemes: comparativeData.commonThemes || []
      };
    } catch (error) {
      console.error('❌ Multi-link analysis failed:', error);
      throw error;
    }
  }

  /**
   * Extract raw content from URL as fallback when Perplexity doesn't provide full content
   */
  private async extractRawContent(url: string): Promise<string> {
    try {
      console.log('🔄 Attempting raw content extraction as fallback...');
      
      // Try different models with web browsing capabilities
      let rawContent = '';
      
      // First try Perplexity/Sonar Deep Research
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'perplexity/sonar-deep-research',
          messages: [
            {
              role: 'user',
              content: `Extract the complete article text from: ${url}
              
              Return ONLY the article content. No summaries, no analysis, no commentary. Just the raw text.`
            }
          ],
          max_tokens: 1000, // Further reduced to avoid credit limit
          temperature: 0.0 // Zero temperature for exact extraction
        });

        rawContent = completion.choices[0]?.message?.content || '';
        console.log('📄 Raw content extracted with sonar-deep-research, length:', rawContent.length);
      } catch (error) {
        console.log('⚠️ sonar-deep-research failed, trying GPT-4o...');
      }
      
      // Fallback to GPT-4o if sonar-deep-research fails
      if (!rawContent) {
        try {
          const completion = await this.openai.chat.completions.create({
            model: 'openai/gpt-4o',
            messages: [
              {
                role: 'user',
                content: `Extract the complete article text from: ${url}
                
                Return ONLY the article content. No summaries, no analysis, no commentary. Just the raw text.`
              }
            ],
            max_tokens: 1000,
            temperature: 0.0
          });

          rawContent = completion.choices[0]?.message?.content || '';
          console.log('📄 Raw content extracted with GPT-4o, length:', rawContent.length);
        } catch (error) {
          console.log('⚠️ GPT-4o failed, trying regular sonar...');
        }
      }
      
      // Final fallback to regular sonar
      if (!rawContent) {
        const completion = await this.openai.chat.completions.create({
          model: 'perplexity/sonar',
          messages: [
            {
              role: 'user',
              content: `Extract the complete article text from: ${url}
              
              Return ONLY the article content. No summaries, no analysis, no commentary. Just the raw text.`
            }
          ],
          max_tokens: 1000, // Further reduced to avoid credit limit
          temperature: 0.0 // Zero temperature for exact extraction
        });

        rawContent = completion.choices[0]?.message?.content || '';
        console.log('📄 Raw content extracted with regular sonar, length:', rawContent.length);
      }
      
      return rawContent;
    } catch (error) {
      console.error('❌ Raw content extraction failed:', error);
      return '';
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  private detectUrlType(url: string, domain: string): 'article' | 'video' | 'document' | 'social' | 'other' {
    const lowerUrl = url.toLowerCase();
    const lowerDomain = domain.toLowerCase();

    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || 
        lowerUrl.includes('vimeo.com') || lowerUrl.includes('video')) {
      return 'video';
    }
    
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com') || 
        lowerUrl.includes('facebook.com') || lowerUrl.includes('instagram.com') ||
        lowerUrl.includes('linkedin.com') || lowerUrl.includes('reddit.com')) {
      return 'social';
    }
    
    if (lowerUrl.includes('.pdf') || lowerUrl.includes('document') || 
        lowerUrl.includes('doc') || lowerUrl.includes('slides')) {
      return 'document';
    }
    
    if (lowerUrl.includes('article') || lowerUrl.includes('blog') || 
        lowerUrl.includes('news') || lowerUrl.includes('post')) {
      return 'article';
    }
    
    return 'other';
  }

  private parseTextResponse(text: string, url: string, domain: string, type: string): any {
    // Parse Perplexity's text response to extract structured information
    const lines = text.split('\n').filter(line => line.trim());
    
    // Try to extract title from the first few lines
    let title = `Content from ${domain}`;
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length > 10 && firstLine.length < 200) {
        title = firstLine;
      }
    }
    
    // Extract key points (look for bullet points, numbered lists, or key phrases)
    const keyPoints: string[] = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || 
          trimmed.match(/^\d+\./) || trimmed.includes('Key point') || trimmed.includes('Important')) {
        keyPoints.push(trimmed.replace(/^[•\-*\d\.\s]+/, '').trim());
      }
    });
    
    // For full content extraction, we want the entire text as content
    // Remove any metadata sections that might be at the beginning
    let content = text;
    
    // If the response starts with metadata (like "Title:", "Author:", etc.), 
    // try to find where the actual content begins
    const contentStartIndex = text.search(/\n\n|\n[A-Z][a-z]+:/);
    if (contentStartIndex > 0 && contentStartIndex < text.length / 2) {
      content = text.substring(contentStartIndex).trim();
    }
    
    // Create summary from first few sentences of the content
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const summary = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');
    
    // Extract author and date if present
    let author: string | undefined;
    let publishDate: string | undefined;
    
    const authorMatch = text.match(/Author[:\s]+([^\n]+)/i);
    if (authorMatch) {
      author = authorMatch[1].trim();
    }
    
    const dateMatch = text.match(/(?:Published|Date|Published on)[:\s]+([^\n]+)/i);
    if (dateMatch) {
      publishDate = dateMatch[1].trim();
    }
    
    return {
      title: title,
      content: content, // This should be the full article content
      summary: summary,
      keyPoints: keyPoints.length > 0 ? keyPoints : [],
      metadata: {
        author,
        publishDate,
        domain,
        type
      }
    };
  }

  private extractThemesFromText(text: string): string[] {
    // Extract themes from text by looking for common patterns
    const themes: string[] = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.includes('theme') || trimmed.includes('common') || trimmed.includes('similar') ||
          trimmed.includes('shared') || trimmed.includes('overlap')) {
        // Extract potential theme words
        const words = trimmed.split(/\s+/);
        words.forEach(word => {
          if (word.length > 4 && !themes.includes(word)) {
            themes.push(word);
          }
        });
      }
    });
    
    return themes.slice(0, 5); // Return up to 5 themes
  }
}

export default PerplexityService;
