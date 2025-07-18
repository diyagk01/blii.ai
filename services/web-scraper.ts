export interface ScrapedContent {
  title: string;
  content: string;
  author?: string;
  publishDate?: string;
  summary?: string;
  description?: string;
  image?: string;
  domain: string;
  url: string;
  wordCount: number;
  metadata: {
    siteName?: string;
    type?: string;
    language?: string;
    keywords?: string[];
  };
}

export interface MetaTags {
  'og:title'?: string;
  'og:description'?: string;
  'og:image'?: string;
  'og:url'?: string;
  'og:site_name'?: string;
  'og:type'?: string;
  'twitter:title'?: string;
  'twitter:description'?: string;
  'twitter:image'?: string;
  'twitter:card'?: string;
  title?: string;
  description?: string;
  author?: string;
  'article:author'?: string;
  'article:published_time'?: string;
  keywords?: string;
  language?: string;
}

class WebScraperService {
  private static instance: WebScraperService;
  private cache = new Map<string, ScrapedContent>();
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  private readonly TIMEOUT = 15000; // 15 seconds timeout

  private constructor() {}

  public static getInstance(): WebScraperService {
    if (!WebScraperService.instance) {
      WebScraperService.instance = new WebScraperService();
    }
    return WebScraperService.instance;
  }

  /**
   * Scrape content from any web URL
   */
  async scrapeUrl(url: string): Promise<ScrapedContent> {
    try {
      console.log('🕷️ Starting web scraping for:', url);
      
      // Check cache first
      const cached = this.cache.get(url);
      if (cached) {
        console.log('📋 Using cached content for:', url);
        return cached;
      }

      // Normalize URL
      const normalizedUrl = this.normalizeUrl(url);
      const domain = this.extractDomain(normalizedUrl);

      // Fetch HTML content
      const html = await this.fetchHtml(normalizedUrl);
      
      // Extract meta tags
      const metaTags = this.extractMetaTags(html);
      
      // Extract main content
      const mainContent = this.extractMainContent(html);
      
      // Extract additional metadata
      const additionalMeta = this.extractAdditionalMetadata(html);
      
      // Build scraped content object
      const scrapedContent: ScrapedContent = {
        title: this.getBestTitle(metaTags, mainContent),
        content: mainContent.text,
        author: this.getBestAuthor(metaTags, additionalMeta),
        publishDate: this.getBestPublishDate(metaTags, additionalMeta),
        summary: this.generateSummary(mainContent.text),
        description: metaTags['og:description'] || metaTags['twitter:description'] || metaTags.description || '',
        image: this.getBestImage(metaTags, normalizedUrl),
        domain: domain,
        url: normalizedUrl,
        wordCount: mainContent.text.split(/\s+/).filter(word => word.length > 0).length,
        metadata: {
          siteName: metaTags['og:site_name'] || domain,
          type: metaTags['og:type'] || 'article',
          language: metaTags.language || additionalMeta.language || 'en',
          keywords: additionalMeta.keywords || []
        }
      };

      // Cache the result
      this.cache.set(url, scrapedContent);

      console.log('✅ Web scraping completed:', {
        title: scrapedContent.title,
        contentLength: scrapedContent.content.length,
        wordCount: scrapedContent.wordCount,
        domain: scrapedContent.domain,
        hasImage: !!scrapedContent.image,
        hasAuthor: !!scrapedContent.author
      });

      return scrapedContent;
    } catch (error) {
      console.error('❌ Web scraping failed:', error);
      
      // Return fallback content
      const domain = this.extractDomain(url);
      return this.createFallbackContent(url, domain, error);
    }
  }

  /**
   * Fetch HTML content from URL
   */
  private async fetchHtml(url: string): Promise<string> {
    try {
      console.log('🌐 Fetching HTML from:', url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      console.log('📄 HTML fetched successfully, length:', html.length);
      
      return html;
    } catch (error) {
      console.error('❌ Failed to fetch HTML:', error);
      throw error;
    }
  }

  /**
   * Extract meta tags from HTML
   */
  private extractMetaTags(html: string): MetaTags {
    const metaTags: MetaTags = {};
    
    // Define patterns for different meta tag formats
    const patterns = [
      // Open Graph tags
      { key: 'og:title', regex: /<meta\s+property=["']og:title["']\s+content=["']([^"']*?)["']/gi },
      { key: 'og:description', regex: /<meta\s+property=["']og:description["']\s+content=["']([^"']*?)["']/gi },
      { key: 'og:image', regex: /<meta\s+property=["']og:image["']\s+content=["']([^"']*?)["']/gi },
      { key: 'og:url', regex: /<meta\s+property=["']og:url["']\s+content=["']([^"']*?)["']/gi },
      { key: 'og:site_name', regex: /<meta\s+property=["']og:site_name["']\s+content=["']([^"']*?)["']/gi },
      { key: 'og:type', regex: /<meta\s+property=["']og:type["']\s+content=["']([^"']*?)["']/gi },
      
      // Twitter Card tags
      { key: 'twitter:title', regex: /<meta\s+name=["']twitter:title["']\s+content=["']([^"']*?)["']/gi },
      { key: 'twitter:description', regex: /<meta\s+name=["']twitter:description["']\s+content=["']([^"']*?)["']/gi },
      { key: 'twitter:image', regex: /<meta\s+name=["']twitter:image["']\s+content=["']([^"']*?)["']/gi },
      { key: 'twitter:card', regex: /<meta\s+name=["']twitter:card["']\s+content=["']([^"']*?)["']/gi },
      
      // Standard meta tags
      { key: 'title', regex: /<title[^>]*>([^<]*?)<\/title>/gi },
      { key: 'description', regex: /<meta\s+name=["']description["']\s+content=["']([^"']*?)["']/gi },
      { key: 'author', regex: /<meta\s+name=["']author["']\s+content=["']([^"']*?)["']/gi },
      { key: 'keywords', regex: /<meta\s+name=["']keywords["']\s+content=["']([^"']*?)["']/gi },
      { key: 'language', regex: /<meta\s+name=["']language["']\s+content=["']([^"']*?)["']/gi },
      
      // Article specific tags
      { key: 'article:author', regex: /<meta\s+property=["']article:author["']\s+content=["']([^"']*?)["']/gi },
      { key: 'article:published_time', regex: /<meta\s+property=["']article:published_time["']\s+content=["']([^"']*?)["']/gi },
      
      // Alternative formats (content before property/name)
      { key: 'og:title', regex: /<meta\s+content=["']([^"']*?)["']\s+property=["']og:title["']/gi },
      { key: 'og:description', regex: /<meta\s+content=["']([^"']*?)["']\s+property=["']og:description["']/gi },
      { key: 'og:image', regex: /<meta\s+content=["']([^"']*?)["']\s+property=["']og:image["']/gi },
      { key: 'twitter:title', regex: /<meta\s+content=["']([^"']*?)["']\s+name=["']twitter:title["']/gi },
      { key: 'twitter:description', regex: /<meta\s+content=["']([^"']*?)["']\s+name=["']twitter:description["']/gi },
      { key: 'description', regex: /<meta\s+content=["']([^"']*?)["']\s+name=["']description["']/gi }
    ];

    // Extract meta tags using patterns
    patterns.forEach(pattern => {
      const matches = Array.from(html.matchAll(pattern.regex));
      if (matches.length > 0) {
        const value = matches[0][1]?.trim();
        if (value && !metaTags[pattern.key as keyof MetaTags]) {
          metaTags[pattern.key as keyof MetaTags] = this.decodeHtmlEntities(value);
        }
      }
    });

    return metaTags;
  }

  /**
   * Extract main content from HTML
   */
  private extractMainContent(html: string): { text: string; headings: string[] } {
    // Remove script and style tags
    let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleanHtml = cleanHtml.replace(/<!--[\s\S]*?-->/g, '');

    // Try to find main content areas (in order of preference)
    const contentSelectors = [
      // Semantic HTML5 elements
      /<main[^>]*>([\s\S]*?)<\/main>/gi,
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      
      // Common content class names
      /<div[^>]*class=["'][^"']*(?:content|article|post|entry|main)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*id=["'][^"']*(?:content|article|post|entry|main)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
      
      // Specific site patterns
      /<div[^>]*class=["'][^"']*(?:post-content|article-content|entry-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
      
      // Fallback to body content
      /<body[^>]*>([\s\S]*?)<\/body>/gi
    ];

    let mainContent = '';
    let headings: string[] = [];

    // Try each selector until we find content
    for (const selector of contentSelectors) {
      const matches = Array.from(cleanHtml.matchAll(selector));
      if (matches.length > 0) {
        mainContent = matches[0][1] || '';
        break;
      }
    }

    // If no main content found, use the entire cleaned HTML
    if (!mainContent) {
      mainContent = cleanHtml;
    }

    // Extract headings
    const headingMatches = Array.from(mainContent.matchAll(/<h[1-6][^>]*>([^<]*?)<\/h[1-6]>/gi));
    headings = headingMatches.map(match => this.cleanText(match[1])).filter(h => h.length > 0);

    // Extract paragraphs and other text content
    const textContent = this.extractTextFromHtml(mainContent);

    return {
      text: textContent,
      headings: headings
    };
  }

  /**
   * Extract text content from HTML, preserving structure
   */
  private extractTextFromHtml(html: string): string {
    // Replace block elements with newlines
    let text = html.replace(/<\/?(div|p|br|h[1-6]|li|tr|td|th)[^>]*>/gi, '\n');
    
    // Remove all other HTML tags
    text = text.replace(/<[^>]*>/g, ' ');
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\n\s*\n/g, '\n');
    text = text.trim();
    
    // Decode HTML entities
    text = this.decodeHtmlEntities(text);
    
    return text;
  }

  /**
   * Extract additional metadata from HTML
   */
  private extractAdditionalMetadata(html: string): { language?: string; keywords?: string[] } {
    const metadata: { language?: string; keywords?: string[] } = {};

    // Extract language from html tag
    const langMatch = html.match(/<html[^>]*lang=["']([^"']*?)["']/i);
    if (langMatch) {
      metadata.language = langMatch[1];
    }

    // Extract keywords from meta tag
    const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*?)["']/i);
    if (keywordsMatch) {
      metadata.keywords = keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k.length > 0);
    }

    return metadata;
  }

  /**
   * Get the best title from available sources
   */
  private getBestTitle(metaTags: MetaTags, content: { headings: string[] }): string {
    // Priority order for title sources
    const titleSources = [
      metaTags['og:title'],
      metaTags['twitter:title'],
      metaTags.title,
      content.headings[0], // First heading
      'Untitled'
    ];

    for (const title of titleSources) {
      if (title && title.trim().length > 0) {
        return this.cleanText(title).substring(0, 200); // Limit title length
      }
    }

    return 'Untitled';
  }

  /**
   * Get the best author from available sources
   */
  private getBestAuthor(metaTags: MetaTags, additionalMeta: any): string | undefined {
    const authorSources = [
      metaTags['article:author'],
      metaTags.author
    ];

    for (const author of authorSources) {
      if (author && author.trim().length > 0) {
        return this.cleanText(author);
      }
    }

    return undefined;
  }

  /**
   * Get the best publish date from available sources
   */
  private getBestPublishDate(metaTags: MetaTags, additionalMeta: any): string | undefined {
    const dateSources = [
      metaTags['article:published_time']
    ];

    for (const date of dateSources) {
      if (date && date.trim().length > 0) {
        return date;
      }
    }

    return undefined;
  }

  /**
   * Get the best image from available sources
   */
  private getBestImage(metaTags: MetaTags, baseUrl: string): string | undefined {
    const imageSources = [
      metaTags['og:image'],
      metaTags['twitter:image']
    ];

    for (const image of imageSources) {
      if (image && image.trim().length > 0) {
        // Convert relative URLs to absolute
        if (image.startsWith('//')) {
          return 'https:' + image;
        } else if (image.startsWith('/')) {
          const domain = this.extractDomain(baseUrl);
          return `https://${domain}${image}`;
        } else if (image.startsWith('http')) {
          return image;
        }
      }
    }

    return undefined;
  }

  /**
   * Generate a summary from the main content
   */
  private generateSummary(content: string, maxLength: number = 300): string {
    if (!content || content.length === 0) {
      return '';
    }

    // Split into sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length === 0) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    // Take first few sentences that fit within maxLength
    let summary = '';
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (summary.length + trimmed.length + 2 <= maxLength) {
        summary += (summary.length > 0 ? '. ' : '') + trimmed;
      } else {
        break;
      }
    }

    return summary + (summary.length < content.length ? '...' : '');
  }

  /**
   * Clean text content
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&mdash;': '—',
      '&ndash;': '–',
      '&hellip;': '…',
      '&laquo;': '«',
      '&raquo;': '»',
      '&ldquo;': '"',
      '&rdquo;': '"',
      '&lsquo;': "'",
      '&rsquo;': "'"
    };

    let decoded = text;
    
    // Replace named entities
    Object.entries(entities).forEach(([entity, replacement]) => {
      decoded = decoded.replace(new RegExp(entity, 'g'), replacement);
    });
    
    // Replace numeric entities
    decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
      return String.fromCharCode(parseInt(num, 10));
    });
    
    // Replace hex entities
    decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    return decoded;
  }

  /**
   * Normalize URL for consistent processing
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Remove tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'ref', 'source'
      ];
      
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });
      
      // Remove fragment
      urlObj.hash = '';
      
      return urlObj.toString();
    } catch (error) {
      return url;
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Create fallback content when scraping fails
   */
  private createFallbackContent(url: string, domain: string, error: any): ScrapedContent {
    return {
      title: `Content from ${domain}`,
      content: `Unable to extract content from ${url}. ${error?.message || 'Unknown error occurred.'}`,
      summary: `Content extraction failed for ${domain}`,
      description: '',
      domain: domain,
      url: url,
      wordCount: 0,
      metadata: {
        siteName: domain,
        type: 'website'
      }
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Web scraper cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; urls: string[] } {
    return {
      size: this.cache.size,
      urls: Array.from(this.cache.keys())
    };
  }

  /**
   * Test scraping functionality
   */
  async testScraping(url: string): Promise<void> {
    try {
      console.log('🧪 Testing web scraping for:', url);
      
      const result = await this.scrapeUrl(url);
      
      console.log('✅ Scraping test completed:');
      console.log('📰 Title:', result.title);
      console.log('📝 Content length:', result.content.length);
      console.log('📊 Word count:', result.wordCount);
      console.log('👤 Author:', result.author || 'Not found');
      console.log('📅 Publish date:', result.publishDate || 'Not found');
      console.log('🖼️ Image:', result.image || 'Not found');
      console.log('🏷️ Description:', (result.description || '').substring(0, 100) + '...');
      console.log('📄 Content preview:', result.content.substring(0, 200) + '...');
      
    } catch (error) {
      console.error('❌ Scraping test failed:', error);
    }
  }
}

export default WebScraperService;
