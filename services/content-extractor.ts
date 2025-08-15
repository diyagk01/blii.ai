// Direct web scraping service for extracting content from any web URL
// This replaces the Perplexity-based approach with a more reliable direct scraper

export interface ExtractedContent {
  title: string;
  content: string;
  author?: string;
  publish_date?: string;
  summary?: string;
  full_text?: string;
  preview_image?: string; // For PDF preview images
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
   * Extract content from PDF files using enhanced service with OCR capabilities
   */
  async extractPDFContent(filePath: string, fileName: string): Promise<ExtractedContent> {
    try {
      console.log('📄 Processing PDF with enhanced service (PyPDF2 + OCR):', fileName);
      
      // First try the new enhanced PDF service
      try {
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
              
              // Clean the extracted content
              const cleanedContent = {
                title: result.title || fileName.replace('.pdf', ''),
                content: result.content,
                full_text: result.content,
                summary: this.generateSummaryFromContent(result.content),
                preview_image: result.preview_image, // Include the preview image
                metadata: {
                  ...result.metadata,
                  extractionMethod: result.method,
                  confidence: 0.95,
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
        console.warn('⚠️ Enhanced service failed, trying fallback methods:', enhancedError);
      }

      // For local files, prioritize PDFKit for better performance
      if (filePath.startsWith('file://')) {
        try {
          console.log('📄 Using PDFKit for local file extraction...');
          const { pdfKitExtractor } = await import('./pdfkit-extractor');
          const result = await pdfKitExtractor.extractPDFContent(filePath, fileName);
          
          if (result.success && result.content) {
            console.log(`✅ PDF extraction completed using PDFKit ${result.extractionMethod} method`);
            return result.content;
          }
        } catch (pdfKitError) {
          console.warn('⚠️ PDFKit extraction failed, trying enhanced extractor:', pdfKitError);
        }
      }

      // Fallback to enhanced content extractor (for remote URLs or if PDFKit fails)
      try {
        const { enhancedContentExtractor } = await import('./enhanced-content-extractor');
        const result = await enhancedContentExtractor.extractPDFContent(filePath, fileName);
        
        if (result.success && result.content) {
          console.log(`✅ PDF extraction completed using enhanced ${result.method} method`);
          
          // Clean the extracted content to prevent database issues
          const cleanedContent = {
            ...result.content,
            content: this.cleanTextForDatabase(result.content.content),
            full_text: this.cleanTextForDatabase(result.content.full_text || result.content.content),
            title: this.cleanTextForDatabase(result.content.title),
            summary: this.cleanTextForDatabase(result.content.summary || '')
          };
          
          return cleanedContent;
        }
      } catch (enhancedError) {
        console.warn('⚠️ Enhanced extraction failed, trying PDFKit extractor:', enhancedError);
      }

      // Final fallback to local PDFKit extractor (for remote URLs)
      if (!filePath.startsWith('file://')) {
        try {
          console.log('📄 Falling back to PDFKit extractor...');
          const { pdfKitExtractor } = await import('./pdfkit-extractor');
          const result = await pdfKitExtractor.extractPDFContent(filePath, fileName);
          
          if (result.success && result.content) {
            console.log(`✅ PDF extraction completed using PDFKit ${result.extractionMethod} method`);
            return result.content;
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
      
      const doclingServiceUrl = 'https://blii-docling-service.onrender.com';
      
      // Check if Docling service is running
      try {
        // Create a timeout controller for React Native compatibility
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const healthResponse = await fetch(`${doclingServiceUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!healthResponse.ok) {
          throw new Error('Docling service health check failed');
        }
        
        const healthData = await healthResponse.json();
        if (!healthData.docling_available) {
          throw new Error('Docling not available in service');
        }
        
        console.log('✅ Docling service is healthy and ready');
      } catch (healthError) {
        console.error('❌ Docling service health check failed:', healthError);
        throw new Error(`Docling service unavailable: ${healthError}`);
      }
      
      // Call extraction endpoint
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 60000); // 60 second timeout for PDF processing
      
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
        throw new Error(`Docling extraction failed: ${errorData.error || extractResponse.statusText}`);
      }
      
      const result = await extractResponse.json();
      
      if (!result.success) {
        throw new Error(`Docling extraction failed: ${result.error}`);
      }
      
      // Convert Docling result to ExtractedContent format
      const extractedContent: ExtractedContent = {
        title: result.title || fileName.replace('.pdf', ''),
        content: result.content, // This is the markdown content from Docling
        full_text: result.raw_text || result.content,
        summary: this.generateSummaryFromContent(result.content),
        preview_image: result.preview_image, // Include the preview image
        metadata: {
          fileType: 'pdf',
          fileName,
          extractionMethod: 'docling',
          extractedAt: new Date().toISOString(),
          ...result.metadata,
          confidence: result.extraction_confidence || 0.95,
          doclingVersion: 'latest'
        }
      };
      
      console.log('✅ Docling extraction successful:', {
        title: extractedContent.title,
        contentLength: extractedContent.content.length,
        wordCount: result.metadata?.word_count || 0,
        pages: result.metadata?.page_count || 0,
        hasTables: result.metadata?.has_tables || false,
        hasImages: result.metadata?.has_images || false
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
      console.log('� Extracting file content from:', filePath, 'Type:', fileType);
      
      // Handle PDF files specifically
      if (fileType.toLowerCase().includes('pdf') || fileName?.toLowerCase().endsWith('.pdf')) {
        return await this.extractPDFContent(filePath, fileName || 'document.pdf');
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
}

// Export singleton instance
export const contentExtractor = new ContentExtractor();
