
export interface LinkPreviewData {
  title: string;
  description: string;
  image: string;
  domain: string;
  url: string;
  favicon?: string;
  siteName?: string;
  type?: 'article' | 'video' | 'image' | 'website' | 'document' | 'social' | 'other';
  author?: string;
  publishedTime?: string;
}

export interface LinkMetadata {
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
}

class LinkPreviewService {
  private static instance: LinkPreviewService;
  private cache = new Map<string, LinkPreviewData>();
  private readonly USER_AGENT = 'WhatsApp/2.22.20.72 A'; // Mimic WhatsApp user agent
  private readonly TIMEOUT = 10000; // 10 seconds timeout
  private readonly MAX_IMAGE_SIZE = 600 * 1024; // 600KB max image size
  private readonly MIN_IMAGE_WIDTH = 300; // 300px minimum width
  private readonly MAX_ASPECT_RATIO = 4; // 4:1 max aspect ratio

  private constructor() {}

  public static getInstance(): LinkPreviewService {
    if (!LinkPreviewService.instance) {
      LinkPreviewService.instance = new LinkPreviewService();
    }
    return LinkPreviewService.instance;
  }

  /**
   * Generate link preview following WhatsApp's specifications
   */
  async generatePreview(url: string, acceptLanguage?: string): Promise<LinkPreviewData> {
    try {
      console.log('🔗 Generating link preview for:', url);
      
      // Check cache first
      const cached = this.cache.get(url);
      if (cached) {
        console.log('📋 Using cached preview for:', url);
        return cached;
      }

      // Validate and normalize URL
      const normalizedUrl = this.normalizeUrl(url);
      const domain = this.extractDomain(normalizedUrl);

      // Try multiple methods to get preview data
      let previewData: LinkPreviewData | null = null;

      // Method 1: Try to fetch HTML and parse meta tags (primary method)
      try {
        previewData = await this.fetchAndParseHtml(normalizedUrl, acceptLanguage);
      } catch (error) {
        console.log('⚠️ HTML parsing failed, trying fallback methods:', error);
      }

      // Method 2: Use Perplexity as fallback for content extraction
      if (!previewData || this.isPreviewIncomplete(previewData)) {
        try {
          previewData = await this.generatePreviewWithPerplexity(normalizedUrl);
        } catch (error) {
          console.log('⚠️ Perplexity fallback failed:', error);
        }
      }

      // Method 3: Generate basic preview as final fallback
      if (!previewData) {
        previewData = this.generateBasicPreview(normalizedUrl, domain);
      }

      // Validate and enhance the preview
      const enhancedPreview = await this.enhancePreview(previewData, normalizedUrl, domain);

      // Cache the result
      this.cache.set(url, enhancedPreview);

      console.log('✅ Link preview generated:', {
        title: enhancedPreview.title,
        domain: enhancedPreview.domain,
        hasImage: !!enhancedPreview.image,
        hasDescription: !!enhancedPreview.description
      });

      return enhancedPreview;
    } catch (error) {
      console.error('❌ Link preview generation failed:', error);
      
      // Return minimal fallback preview
      const domain = this.extractDomain(url);
      return this.generateBasicPreview(url, domain);
    }
  }

  /**
   * Fetch HTML content and parse meta tags (following WhatsApp's approach)
   */
  private async fetchAndParseHtml(url: string, acceptLanguage?: string): Promise<LinkPreviewData | null> {
    try {
      console.log('🌐 Fetching HTML content for:', url);

      // Direct fetch approach with proper headers
      const headers: Record<string, string> = {
        'User-Agent': this.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': acceptLanguage || 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };

      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get only the first 300KB as per WhatsApp specs
      const text = await response.text();
      const html = text.substring(0, 300 * 1024);

      // Parse meta tags from HTML
      const metadata = this.parseHtmlMetaTags(html);

      if (Object.keys(metadata).length === 0) {
        return null;
      }

      // Convert metadata to preview data
      const domain = this.extractDomain(url);
      const previewData: LinkPreviewData = {
        title: metadata['og:title'] || metadata['twitter:title'] || metadata.title || `Link from ${domain}`,
        description: metadata['og:description'] || metadata['twitter:description'] || metadata.description || '',
        image: metadata['og:image'] || metadata['twitter:image'] || this.generateFallbackImage(domain),
        domain: domain,
        url: metadata['og:url'] || url,
        siteName: metadata['og:site_name'],
        type: this.mapContentType(metadata['og:type']),
        author: metadata.author || metadata['article:author'],
        publishedTime: metadata['article:published_time']
      };

      return previewData;
    } catch (error) {
      console.error('❌ HTML parsing failed:', error);
      return null;
    }
  }
  /**
   * Parse HTML meta tags from raw HTML content
   */
  private parseHtmlMetaTags(html: string): LinkMetadata {
    const metadata: LinkMetadata = {};
    
    // Extract meta tags using regex patterns
    const metaPatterns = [
      { key: 'og:title', regex: /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i },
      { key: 'og:description', regex: /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i },
      { key: 'og:image', regex: /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i },
      { key: 'og:url', regex: /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i },
      { key: 'og:site_name', regex: /<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i },
      { key: 'og:type', regex: /<meta\s+property=["']og:type["']\s+content=["']([^"']+)["']/i },
      { key: 'twitter:title', regex: /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i },
      { key: 'twitter:description', regex: /<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i },
      { key: 'twitter:image', regex: /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i },
      { key: 'title', regex: /<title[^>]*>([^<]+)<\/title>/i },
      { key: 'description', regex: /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i },
      { key: 'author', regex: /<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i },
      { key: 'article:author', regex: /<meta\s+property=["']article:author["']\s+content=["']([^"']+)["']/i },
      { key: 'article:published_time', regex: /<meta\s+property=["']article:published_time["']\s+content=["']([^"']+)["']/i }
    ];

    // Also try alternative formats
    const altPatterns = [
      { key: 'og:title', regex: /<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i },
      { key: 'og:description', regex: /<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i },
      { key: 'og:image', regex: /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i },
      { key: 'twitter:title', regex: /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:title["']/i },
      { key: 'twitter:description', regex: /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:description["']/i },
      { key: 'twitter:image', regex: /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i },
      { key: 'description', regex: /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i }
    ];

    // Parse with primary patterns
    metaPatterns.forEach(pattern => {
      const match = html.match(pattern.regex);
      if (match && match[1]) {
        metadata[pattern.key as keyof LinkMetadata] = this.decodeHtmlEntities(match[1].trim());
      }
    });

    // Try alternative patterns for missing data
    altPatterns.forEach(pattern => {
      if (!metadata[pattern.key as keyof LinkMetadata]) {
        const match = html.match(pattern.regex);
        if (match && match[1]) {
          metadata[pattern.key as keyof LinkMetadata] = this.decodeHtmlEntities(match[1].trim());
        }
      }
    });

    return metadata;
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
      '&nbsp;': ' '
    };

    return text.replace(/&[#\w]+;/g, (entity) => {
      return entities[entity] || entity;
    });
  }

  /**
   * Parse metadata from text response when JSON parsing fails
   */
  private parseMetadataFromText(text: string): LinkMetadata {
    const metadata: LinkMetadata = {};
    
    // Common patterns for meta tag extraction
    const patterns = [
      { key: 'og:title', regex: /og:title["\s]*content=["']([^"']+)["']/i },
      { key: 'og:description', regex: /og:description["\s]*content=["']([^"']+)["']/i },
      { key: 'og:image', regex: /og:image["\s]*content=["']([^"']+)["']/i },
      { key: 'og:url', regex: /og:url["\s]*content=["']([^"']+)["']/i },
      { key: 'og:site_name', regex: /og:site_name["\s]*content=["']([^"']+)["']/i },
      { key: 'twitter:title', regex: /twitter:title["\s]*content=["']([^"']+)["']/i },
      { key: 'twitter:description', regex: /twitter:description["\s]*content=["']([^"']+)["']/i },
      { key: 'twitter:image', regex: /twitter:image["\s]*content=["']([^"']+)["']/i },
      { key: 'title', regex: /<title[^>]*>([^<]+)<\/title>/i },
      { key: 'description', regex: /name=["']description["'][^>]*content=["']([^"']+)["']/i },
      { key: 'author', regex: /name=["']author["'][^>]*content=["']([^"']+)["']/i }
    ];

    patterns.forEach(pattern => {
      const match = text.match(pattern.regex);
      if (match && match[1]) {
        metadata[pattern.key as keyof LinkMetadata] = match[1].trim();
      }
    });

    return metadata;
  }

  /**
   * Use Perplexity to generate preview when HTML parsing fails
   */
  private async generatePreviewWithPerplexity(url: string): Promise<LinkPreviewData | null> {
    try {
      console.log('🤖 Generating preview with Perplexity for:', url);
      
      const PerplexityService = await import('./perplexity');
      const perplexityService = PerplexityService.default.getInstance();
      
      const analysis = await perplexityService.extractLinkContent(url);
      
      const domain = this.extractDomain(url);
      return {
        title: analysis.title || `Content from ${domain}`,
        description: analysis.summary || 'No description available',
        image: this.generateContentTypeImage(analysis.metadata.type, domain),
        domain: domain,
        url: url,
        type: analysis.metadata.type,
        author: analysis.metadata.author,
        publishedTime: analysis.metadata.publishDate
      };
    } catch (error) {
      console.error('❌ Perplexity preview generation failed:', error);
      return null;
    }
  }

  /**
   * Generate basic preview as final fallback
   */
  private generateBasicPreview(url: string, domain: string): LinkPreviewData {
    return {
      title: `Link from ${domain}`,
      description: 'Link preview unavailable',
      image: this.generateFallbackImage(domain),
      domain: domain,
      url: url,
      type: 'website'
    };
  }

  /**
   * Enhance preview data with validation and improvements
   */
  private async enhancePreview(preview: LinkPreviewData, url: string, domain: string): Promise<LinkPreviewData> {
    // Validate and fix title
    if (!preview.title || preview.title.trim().length === 0) {
      preview.title = `Link from ${domain}`;
    }
    
    // Limit title to 2 lines (approximately 80 characters)
    if (preview.title.length > 80) {
      preview.title = preview.title.substring(0, 77) + '...';
    }

    // Validate and fix description
    if (!preview.description) {
      preview.description = '';
    }
    
    // Limit description to 80 characters for WhatsApp compatibility
    if (preview.description.length > 80) {
      preview.description = preview.description.substring(0, 77) + '...';
    }

    // Validate and fix image
    if (!preview.image || !this.isValidImageUrl(preview.image)) {
      preview.image = this.generateFallbackImage(domain);
    }

    // Ensure absolute URL for image
    if (preview.image && !preview.image.startsWith('http')) {
      preview.image = new URL(preview.image, url).href;
    }

    // Validate image size and dimensions (simulate WhatsApp's validation)
    try {
      const isValidImage = await this.validateImage(preview.image);
      if (!isValidImage) {
        preview.image = this.generateFallbackImage(domain);
      }
    } catch (error) {
      console.log('⚠️ Image validation failed, using fallback');
      preview.image = this.generateFallbackImage(domain);
    }

    return preview;
  }

  /**
   * Validate image according to WhatsApp specifications
   */
  private async validateImage(imageUrl: string): Promise<boolean> {
    try {
      // For now, we'll do basic URL validation
      // In a real implementation, you'd want to check:
      // - Image size < 600KB
      // - Width >= 300px
      // - Aspect ratio <= 4:1
      
      const url = new URL(imageUrl);
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const hasValidExtension = validExtensions.some(ext => 
        url.pathname.toLowerCase().includes(ext)
      );
      
      return hasValidExtension || imageUrl.includes('placeholder') || imageUrl.includes('via.placeholder');
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if preview data is incomplete
   */
  private isPreviewIncomplete(preview: LinkPreviewData): boolean {
    return !preview.title || 
           preview.title === `Link from ${preview.domain}` ||
           !preview.description ||
           preview.description === 'Link preview unavailable';
  }

  /**
   * Generate fallback image for domains
   */
  private generateFallbackImage(domain: string): string {
    // Create a more visually appealing fallback image
    const domainColors: Record<string, string> = {
      'youtube.com': 'FF0000',
      'twitter.com': '1DA1F2',
      'facebook.com': '1877F2',
      'instagram.com': 'E4405F',
      'linkedin.com': '0077B5',
      'github.com': '333333',
      'medium.com': '00AB6C',
      'reddit.com': 'FF4500',
      'news.ycombinator.com': 'FF6600',
      'stackoverflow.com': 'F58025'
    };

    const domainIcons: Record<string, string> = {
      'youtube.com': '▶️',
      'twitter.com': '🐦',
      'facebook.com': '📘',
      'instagram.com': '📷',
      'linkedin.com': '💼',
      'github.com': '🐙',
      'medium.com': '📝',
      'reddit.com': '🤖',
      'news.ycombinator.com': '🔶',
      'stackoverflow.com': '❓'
    };

    // Get domain-specific color and icon, or use defaults
    const color = domainColors[domain] || this.getColorFromDomain(domain);
    const icon = domainIcons[domain] || '🔗';
    
    const encodedIcon = encodeURIComponent(icon);
    const encodedDomain = encodeURIComponent(domain.substring(0, 15)); // Limit domain length
    
    return `https://via.placeholder.com/400x300/${color}/white?text=${encodedIcon}+${encodedDomain}`;
  }

  /**
   * Generate a consistent color from domain name
   */
  private getColorFromDomain(domain: string): string {
    const colors = ['4285F4', '34A853', 'FBBC05', 'EA4335', '9C27B0', '673AB7', '3F51B5', '2196F3', '00BCD4', '009688'];
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Generate content-type specific images
   */
  private generateContentTypeImage(type: string, domain: string): string {
    const typeImages = {
      article: '📰',
      video: '▶️',
      document: '📄',
      social: '💬',
      other: '🔗'
    };
    
    const typeColors = {
      article: '4285f4',
      video: 'FF0000',
      document: '34A853',
      social: '1da1f2',
      other: '666666'
    };
    
    const icon = encodeURIComponent(typeImages[type as keyof typeof typeImages] || typeImages.other);
    const color = typeColors[type as keyof typeof typeColors] || typeColors.other;
    
    return `https://via.placeholder.com/400x300/${color}/white?text=${icon}+${domain}`;
  }

  /**
   * Normalize URL for consistent caching and processing
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Remove tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
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
   * Map og:type to our content types
   */
  private mapContentType(ogType?: string): 'article' | 'video' | 'image' | 'website' | 'document' | 'social' | 'other' {
    if (!ogType) return 'website';
    
    const type = ogType.toLowerCase();
    if (type.includes('article')) return 'article';
    if (type.includes('video')) return 'video';
    if (type.includes('image')) return 'image';
    if (type.includes('document')) return 'document';
    if (type.includes('social')) return 'social';
    
    return 'other';
  }

  /**
   * Check if URL is a valid image URL
   */
  private isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      return validExtensions.some(ext => 
        urlObj.pathname.toLowerCase().endsWith(ext)
      ) || url.includes('placeholder') || url.includes('via.placeholder');
    } catch {
      return false;
    }
  }

  /**
   * Detect if text contains URLs
   */
  static detectUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches || [];
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Link preview cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; urls: string[] } {
    return {
      size: this.cache.size,
      urls: Array.from(this.cache.keys())
    };
  }

  /**
   * Preload preview for a URL (useful for better UX)
   */
  async preloadPreview(url: string): Promise<void> {
    try {
      await this.generatePreview(url);
      console.log('📋 Preview preloaded for:', url);
    } catch (error) {
      console.log('⚠️ Preview preload failed for:', url);
    }
  }

  /**
   * Batch generate previews for multiple URLs
   */
  async generateMultiplePreviews(urls: string[]): Promise<LinkPreviewData[]> {
    const previews = await Promise.allSettled(
      urls.map(url => this.generatePreview(url))
    );
    
    return previews.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`❌ Preview failed for ${urls[index]}:`, result.reason);
        return this.generateBasicPreview(urls[index], this.extractDomain(urls[index]));
      }
    });
  }
}

export default LinkPreviewService;
