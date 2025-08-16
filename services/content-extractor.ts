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
        console.warn('⚠️ Docling extraction failed, trying enhanced service:', doclingError);
      }

      // Fallback method: Use enhanced PDF service
      try {
        console.log('🔄 Trying enhanced PDF service as fallback...');
        const enhancedServiceUrl = 'https://blii-pdf-extraction-production.up.railway.app';
        
        // Check if enhanced service is available
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const healthResponse = await fetch(`${enhancedServiceUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          console.log('✅ Enhanced PDF service is available:', healthData);
          
          // Call the enhanced extraction endpoint
          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), 60000);
          
          const extractResponse = await fetch(`${enhancedServiceUrl}/extract`, {
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
          
          if (extractResponse.ok) {
            const result = await extractResponse.json();
            
            if (result.success) {
              console.log(`✅ Enhanced PDF extraction successful using ${result.method}`);
              
              // Validate and clean the extracted content
              const validatedContent = this.validateAndCleanExtractedText(result.content);
              
              const cleanedContent = {
                title: result.title || fileName.replace('.pdf', ''),
                content: validatedContent,
                full_text: validatedContent,
                summary: this.generateSummaryFromContent(validatedContent),
                metadata: {
                  ...result.metadata,
                  extractionMethod: result.method,
                  confidence: 0.90,
                  extractedAt: new Date().toISOString(),
                  wordCount: result.word_count,
                  pageCount: result.page_count
                }
              };
              
              return cleanedContent;
            }
          }
        }
      } catch (enhancedError) {
        console.warn('⚠️ Enhanced service failed, trying PDFKit:', enhancedError);
      }

      // Final fallback: Use PDFKit only for local files
      if (filePath.startsWith('file://')) {
        try {
          console.log('📄 Using PDFKit as final fallback for local file...');
          const { pdfKitExtractor } = await import('./pdfkit-extractor');
          const result = await pdfKitExtractor.extractPDFContent(filePath, fileName);
          
          if (result.success && result.content) {
            console.log(`✅ PDF extraction completed using PDFKit ${result.extractionMethod} method`);
            
            // Validate and clean the extracted content
            const validatedContent = {
              ...result.content,
              content: this.validateAndCleanExtractedText(result.content.content),
              full_text: this.validateAndCleanExtractedText(result.content.full_text || result.content.content),
              title: this.validateAndCleanExtractedText(result.content.title),
              summary: this.validateAndCleanExtractedText(result.content.summary || '')
            };
            
            return validatedContent;
          }
        } catch (pdfKitError) {
          console.error('❌ PDFKit extraction also failed:', pdfKitError);
        }
      }

      throw new Error('All PDF extraction methods failed');
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
      console.log('🐍 Calling Docling Python service for:', fileName);
      
      // Import and use the configured service URL
      const { ACTIVE_DOCLING_SERVICE, FALLBACK_DOCLING_SERVICES } = await import('../config/service-urls');
      const doclingServiceUrl = ACTIVE_DOCLING_SERVICE;
      
      // Check if Docling service is running with fallback support
      let serviceAvailable = false;
      let activeServiceUrl = doclingServiceUrl;
      
      // Try the primary service first
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for cloud services
        
        const healthResponse = await fetch(`${activeServiceUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          if (healthData.docling_available) {
            serviceAvailable = true;
            console.log('✅ Primary Docling service is healthy and ready');
          }
        }
      } catch (primaryError) {
        console.warn('⚠️ Primary Docling service health check failed:', primaryError);
      }
      
      // If primary service failed, try fallback services
      if (!serviceAvailable) {
        console.log('🔄 Trying fallback Docling services...');
        
        for (const fallbackUrl of FALLBACK_DOCLING_SERVICES) {
          if (fallbackUrl === activeServiceUrl) continue; // Skip if it's the same as primary
          
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const healthResponse = await fetch(`${fallbackUrl}/health`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (healthResponse.ok) {
              const healthData = await healthResponse.json();
              if (healthData.docling_available) {
                activeServiceUrl = fallbackUrl;
                serviceAvailable = true;
                console.log(`✅ Fallback Docling service is healthy: ${fallbackUrl}`);
                break;
              }
            }
          } catch (fallbackError) {
            console.warn(`⚠️ Fallback service ${fallbackUrl} failed:`, fallbackError);
          }
        }
      }
      
      if (!serviceAvailable) {
        throw new Error('No Docling service available. All services are down.');
      }
      
      // Call extraction endpoint
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 120000); // 2 minute timeout for PDF processing
      
      console.log(`📤 Sending extraction request to Docling service: ${activeServiceUrl}`);
      const extractResponse = await fetch(`${activeServiceUrl}/extract`, {
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
        throw new Error(`Docling extraction failed: ${errorData.error || extractResponse.statusText}`);
      }
      
      const result = await extractResponse.json();
      
      if (!result.success) {
        throw new Error(`Docling extraction failed: ${result.error}`);
      }
      
      // Validate the extracted content
      if (!result.content || typeof result.content !== 'string') {
        throw new Error('Docling returned invalid content format');
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
          extractionMethod: 'docling_cloud',
          extractedAt: new Date().toISOString(),
          ...result.metadata,
          confidence: result.extraction_confidence || 0.95,
          doclingVersion: 'latest',
          wordCount: result.metadata?.word_count || cleanedContent.split(' ').length,
          pageCount: result.metadata?.page_count || 0,
          preview_image: result.preview_image, // Store preview image in metadata
          serviceUrl: activeServiceUrl // Track which service was used
        }
      };
      
      console.log('✅ Docling extraction successful:', {
        title: extractedContent.title,
        contentLength: extractedContent.content.length,
        wordCount: extractedContent.metadata.wordCount,
        pages: extractedContent.metadata.pageCount,
        hasTables: result.metadata?.has_tables || false,
        hasImages: result.metadata?.has_images || false,
        serviceUrl: activeServiceUrl
      });
      
      return extractedContent;
      
    } catch (error) {
      console.error('❌ Docling service extraction failed:', error);
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
      console.log('🧪 Testing Docling service connectivity...');
      
      // Import and use the configured service URL
      const { ACTIVE_DOCLING_SERVICE, FALLBACK_DOCLING_SERVICES } = await import('../config/service-urls');
      const doclingServiceUrl = ACTIVE_DOCLING_SERVICE;
      
      // Test health endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const healthResponse = await fetch(`${doclingServiceUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!healthResponse.ok) {
        console.error('❌ Docling service health check failed:', healthResponse.status);
        return false;
      }
      
      const healthData = await healthResponse.json();
      console.log('✅ Docling service health check passed:', healthData);
      
      if (!healthData.docling_available) {
        console.error('❌ Docling not available in service');
        return false;
      }
      
      console.log('✅ Docling service is ready for extraction');
      return true;
      
    } catch (error) {
      console.error('❌ Docling service test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const contentExtractor = new ContentExtractor();
