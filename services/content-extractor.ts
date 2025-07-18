// Direct web scraping service for extracting content from any web URL
// This replaces the Perplexity-based approach with a more reliable direct scraper

export interface ExtractedContent {
  title: string;
  content: string;
  author?: string;
  publish_date?: string;
  summary?: string;
  full_text?: string;
  metadata?: any;
}

export class ContentExtractor {
  /**
   * Extract content from a web article using direct web scraping
   */
  async extractWebArticle(url: string): Promise<ExtractedContent> {
    try {
      console.log('🔗 Extracting web article content from:', url);
      
      // Import Web Scraper service
      const WebScraperService = await import('./web-scraper');
      const webScraperService = WebScraperService.default.getInstance();
      
      // Use direct web scraping for content extraction
      const scrapedContent = await webScraperService.scrapeUrl(url);
      
      console.log('✅ Content extraction completed:', {
        title: scrapedContent.title,
        contentLength: scrapedContent.content.length,
        wordCount: scrapedContent.wordCount,
        author: scrapedContent.author,
        publishDate: scrapedContent.publishDate,
        domain: scrapedContent.domain
      });
      
      return {
        title: scrapedContent.title,
        content: scrapedContent.content,
        author: scrapedContent.author,
        publish_date: scrapedContent.publishDate,
        summary: scrapedContent.summary,
        full_text: scrapedContent.content,
        metadata: {
          domain: scrapedContent.domain,
          siteName: scrapedContent.metadata.siteName,
          type: scrapedContent.metadata.type,
          language: scrapedContent.metadata.language,
          keywords: scrapedContent.metadata.keywords,
          image: scrapedContent.image,
          description: scrapedContent.description,
          wordCount: scrapedContent.wordCount
        }
      };
    } catch (error) {
      console.error('❌ Content extraction failed:', error);
      throw error;
    }
  }

  /**
   * Extract content from a file (placeholder for future implementation)
   */
  async extractFileContent(filePath: string, fileType: string): Promise<ExtractedContent> {
    try {
      console.log('📄 Extracting file content from:', filePath, 'Type:', fileType);
      
      // For now, return a placeholder - this can be expanded later
      return {
        title: `File: ${filePath.split('/').pop()}`,
        content: `Content extraction for ${fileType} files is not yet implemented.`,
        full_text: `Content extraction for ${fileType} files is not yet implemented.`
      };
    } catch (error) {
      console.error('❌ File content extraction failed:', error);
      throw error;
    }
  }

  /**
   * Test the content extraction system
   */
  async testExtraction(url: string): Promise<ExtractedContent> {
    try {
      console.log('🧪 Testing content extraction with web scraper for:', url);
      
      const result = await this.extractWebArticle(url);
      
      console.log('✅ Test extraction completed successfully');
      return result;
    } catch (error) {
      console.error('❌ Test extraction failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const contentExtractor = new ContentExtractor();
