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
   * Extract content from PDF files using Docling as primary method
   */
  async extractPDFContent(filePath: string, fileName: string): Promise<ExtractedContent> {
    try {
      console.log('📄 Processing PDF with Docling as primary method:', fileName);
      
      // Primary method: Use Docling service
      try {
        console.log('🐍 Attempting Docling extraction...');
        return await this.extractWithDoclingService(filePath, fileName);
      } catch (doclingError) {
        console.error('❌ Docling extraction failed:', doclingError);
        throw new Error(`Docling PDF extraction failed: ${doclingError instanceof Error ? doclingError.message : String(doclingError)}`);
      }
    } catch (error) {
      console.error('❌ PDF processing failed:', error);
      throw error;
    }
  }

  /**
   * Extract PDF content using Docling Python service
   */
  private async extractWithDoclingService(filePath: string, fileName: string): Promise<ExtractedContent> {
    try {
      console.log('🐍 Calling local Docling Python service for:', fileName);
      
      // Use deployed Docling service
      const doclingServiceUrl = 'https://blii-ai.onrender.com';
      
      // Check if local Docling service is running
      try {
        // Create a timeout controller for React Native compatibility
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check
        
        const healthResponse = await fetch(`${doclingServiceUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!healthResponse.ok) {
          throw new Error(`Local Docling service health check failed: ${healthResponse.status}`);
        }
        
        const healthData = await healthResponse.json();
        if (!healthData.docling_available) {
          throw new Error('Docling not available in local service');
        }
        
        console.log('✅ Local Docling service is healthy and ready');
      } catch (healthError) {
        console.error('❌ Local Docling service health check failed:', healthError);
        console.log('💡 To start the local Docling service manually:');
        console.log('   1. Open a new terminal');
        console.log('   2. Navigate to the python-services directory');
        console.log('   3. Run: source venv/bin/activate && python3 docling_service.py');
        throw new Error(`Local Docling service unavailable. Please start it manually: ${healthError}`);
      }
      
      // Call extraction endpoint
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 120000); // 2 minute timeout for PDF processing
      
      console.log('📤 Sending extraction request to local Docling...');
      const extractResponse = await fetch(`${doclingServiceUrl}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_url: filePath,
          filename: fileName,
          generate_preview: true
        }),
        signal: controller2.signal
      });
      
      clearTimeout(timeoutId2);
      
      if (!extractResponse.ok) {
        const errorData = await extractResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Local Docling extraction failed: ${errorData.error || extractResponse.statusText}`);
      }
      
      const result = await extractResponse.json();
      
      if (!result.success) {
        throw new Error(`Local Docling extraction failed: ${result.error}`);
      }
      
      // Validate the extracted content
      if (!result.content || typeof result.content !== 'string') {
        throw new Error('Local Docling returned invalid content format');
      }
      
      // Clean and validate the extracted content
      const cleanedContent = this.validateAndCleanExtractedText(result.content);
      const cleanedTitle = this.validateAndCleanExtractedText(result.title || fileName.replace('.pdf', ''));
      
      // Convert Docling result to ExtractedContent format
      const extractedContent: ExtractedContent = {
        title: cleanedTitle,
        content: cleanedContent,
        full_text: cleanedContent,
        summary: this.generateSummaryFromContent(cleanedContent),
        metadata: {
          fileType: 'pdf',
          fileName,
          extractionMethod: 'docling_local',
          extractedAt: new Date().toISOString(),
          ...result.metadata,
          confidence: result.extraction_confidence || 0.95,
          doclingVersion: 'latest',
          wordCount: result.metadata?.word_count || cleanedContent.split(' ').length,
          pageCount: result.metadata?.page_count || 0,
          preview_image: result.preview_image, // Store preview image in metadata
          serviceUrl: doclingServiceUrl // Track which service was used
        }
      };
      
      console.log('✅ Local Docling extraction successful:', {
        title: extractedContent.title,
        contentLength: extractedContent.content.length,
        wordCount: extractedContent.metadata.wordCount,
        pages: extractedContent.metadata.pageCount,
        hasTables: result.metadata?.has_tables || false,
        hasImages: result.metadata?.has_images || false,
        serviceUrl: doclingServiceUrl
      });
      
      return extractedContent;
      
    } catch (error) {
      console.error('❌ Local Docling service extraction failed:', error);
      throw error;
    }
  }

  /**
   * Generate a summary from content (first few sentences)
   */
  private generateSummaryFromContent(content: string): string {
    if (!content) return '';
    
    // Split by sentences and take first 2-3
    const sentences = content.match(/[^\.!?]+[\.!?]+/g);
    if (sentences && sentences.length > 0) {
      return sentences.slice(0, 3).join(' ').trim();
    }
    
    // Fallback to first 200 characters
    return content.substring(0, 200).trim() + (content.length > 200 ? '...' : '');
  }

  /**
   * Validate and clean extracted text to detect corrupted content
   */
  private validateAndCleanExtractedText(text: string): string {
    if (!text) return '';
    
    // Check for corrupted binary data patterns
    const corruptedPatterns = [
      /[^\x00-\x7F]{10,}/g, // Long sequences of non-ASCII characters
      /[^\x20-\x7E]{20,}/g, // Long sequences of non-printable characters
      /[^\w\s\.,!?;:'"()-]{50,}/g, // Long sequences of unusual characters
      /\0{3,}/g, // Multiple null characters
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]{5,}/g, // Multiple control characters
    ];
    
    // Check if content appears to be corrupted
    const isCorrupted = corruptedPatterns.some(pattern => pattern.test(text));
    
    if (isCorrupted) {
      console.warn('⚠️ Detected corrupted PDF content, attempting to clean...');
      
      // Try to extract readable text by removing corrupted parts
      let cleanedText = text
        .replace(/\0/g, '') // Remove null characters
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .replace(/[^\x20-\x7E]{10,}/g, ' ') // Replace long non-printable sequences with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // If still corrupted, return a fallback message
      if (cleanedText.length < 50 || /[^\x20-\x7E]{20,}/.test(cleanedText)) {
        console.error('❌ PDF content is severely corrupted, using fallback');
        return 'PDF content extraction failed. The document may be corrupted or password-protected.';
      }
      
      return cleanedText;
    }
    
    // Clean text for database storage
    return this.cleanTextForDatabase(text);
  }

  /**
   * Clean text to remove problematic characters for database storage
   */
  private cleanTextForDatabase(text: string): string {
    if (!text) return '';
    
    return text
      // Remove null bytes and other control characters that cause database issues
      .replace(/\u0000/g, '') // Remove null bytes
      .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Remove other control characters
      .replace(/\uFFFD/g, '') // Remove replacement characters
      .replace(/[\uE000-\uF8FF]/g, '') // Remove private use area characters
      .replace(/[\uFFF0-\uFFFF]/g, '') // Remove specials
      // Clean up common PDF artifacts
      .replace(/\s+/g, ' ') // Multiple whitespace to single space
      .replace(/([.!?])\s*([.!?])+/g, '$1') // Remove repeated punctuation
      .replace(/\s+([.!?,:;])/g, '$1') // Remove space before punctuation
      // Remove non-printable Unicode categories
      .replace(/[\p{C}]/gu, '') // Remove all control characters (Unicode category C)
      .replace(/[\p{Z}\p{S}]{3,}/gu, ' ') // Replace multiple symbols/separators with single space
      // Final cleanup
      .trim()
      .replace(/\s+/g, ' '); // Final whitespace normalization
  }


  /**
   * Extract content from various file types
   */
  async extractFileContent(filePath: string, fileType: string, fileName?: string): Promise<ExtractedContent> {
    try {
      console.log('📄 Extracting file content from:', filePath, 'Type:', fileType);
      
      // Handle PDF files specifically
      if (fileType.toLowerCase().includes('pdf') || fileName?.toLowerCase().endsWith('.pdf')) {
        console.log('📄 Detected PDF file, using PDF extraction...');
        const result = await this.extractPDFContent(filePath, fileName || 'document.pdf');
        
        // Additional validation before returning
        if (!result.content || result.content.length < 10) {
          console.warn('⚠️ Extracted content is too short, may be corrupted');
          throw new Error('Extracted content is too short or corrupted');
        }
        
        console.log('✅ PDF extraction completed successfully:', {
          title: result.title,
          contentLength: result.content.length,
          wordCount: result.content.split(' ').length
        });
        
        return result;
      }
      
      // Handle other file types (placeholder for future implementation)
      const fileNameOnly = fileName || filePath.split('/').pop() || 'document';
      
      return {
        title: `File: ${fileNameOnly}`,
        content: `File "${fileNameOnly}" of type ${fileType} has been uploaded. Content extraction for this file type is not yet fully implemented.`,
        full_text: `File "${fileNameOnly}" of type ${fileType} has been uploaded. Content extraction for this file type is not yet fully implemented.`,
        metadata: {
          fileType,
          fileName: fileNameOnly,
          extractionStatus: 'not_implemented'
        }
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

  /**
   * Test Docling service connectivity and functionality
   */
  async testDoclingService(): Promise<boolean> {
    try {
      console.log('🧪 Testing local Docling service connectivity...');
      
      const doclingServiceUrl = 'https://blii-ai.onrender.com';
      
      // Test health endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const healthResponse = await fetch(`${doclingServiceUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!healthResponse.ok) {
        console.error('❌ Local Docling service health check failed:', healthResponse.status);
        return false;
      }
      
      const healthData = await healthResponse.json();
      console.log('✅ Local Docling service health check passed:', healthData);
      
      if (!healthData.docling_available) {
        console.error('❌ Docling not available in local service');
        return false;
      }
      
      console.log('✅ Local Docling service is ready for extraction');
      return true;
      
    } catch (error) {
      console.error('❌ Local Docling service test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const contentExtractor = new ContentExtractor();
