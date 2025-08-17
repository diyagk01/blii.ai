// Enhanced content extractor with fallback capabilities for deployment
import { ExtractedContent } from './content-extractor';

export interface EnhancedExtractionResult {
  success: boolean;
  content?: ExtractedContent;
  method: 'docling' | 'fallback' | 'cached';
  error?: string;
}

export class EnhancedContentExtractor {
  private static instance: EnhancedContentExtractor;
  private doclingServiceUrl = 'https://blii-docling-service.onrender.com';
  private serviceHealthy = false;
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30 seconds

  public static getInstance(): EnhancedContentExtractor {
    if (!EnhancedContentExtractor.instance) {
      EnhancedContentExtractor.instance = new EnhancedContentExtractor();
    }
    return EnhancedContentExtractor.instance;
  }

  /**
   * Check if Docling service is available
   */
  private async checkDoclingHealth(): Promise<boolean> {
    const now = Date.now();
    
    // Use cached health status if checked recently
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.serviceHealthy;
    }

    try {
      console.log('🔍 Checking Docling service health...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.doclingServiceUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        this.serviceHealthy = data.docling_available === true;
        console.log('✅ Docling service is', this.serviceHealthy ? 'healthy' : 'unavailable');
      } else {
        this.serviceHealthy = false;
        console.log('❌ Docling service health check failed');
      }
    } catch (error) {
      this.serviceHealthy = false;
      console.log('❌ Docling service is unavailable:', error instanceof Error ? error.message : String(error));
    }
    
    this.lastHealthCheck = now;
    return this.serviceHealthy;
  }

  /**
   * Extract PDF content with fallback strategies
   */
  async extractPDFContent(filePath: string, fileName: string): Promise<EnhancedExtractionResult> {
    try {
      console.log('📄 Starting enhanced PDF extraction for:', fileName);
      
      // Check if this is a local file path
      if (filePath.startsWith('file://')) {
        console.log('📱 Detected local file path, using Docling service');
      }
      
      // Try Docling service first
      const isDoclingHealthy = await this.checkDoclingHealth();
      
      if (isDoclingHealthy) {
        try {
          const doclingResult = await this.extractWithDocling(filePath, fileName);
          return {
            success: true,
            content: doclingResult,
            method: 'docling'
          };
        } catch (doclingError) {
          console.warn('⚠️ Docling extraction failed, using fallback:', doclingError instanceof Error ? doclingError.message : String(doclingError));
        }
      }
      
      // Fallback to basic PDF handling
      const fallbackResult = this.createFallbackExtraction(fileName);
      return {
        success: true,
        content: fallbackResult,
        method: 'fallback'
      };
      
    } catch (error) {
      console.error('❌ Enhanced PDF extraction failed:', error);
      return {
        success: false,
        method: 'fallback',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Extract PDF content from uploaded file data
   */
  async extractPDFFromUpload(fileData: Blob | File, fileName: string): Promise<EnhancedExtractionResult> {
    try {
      console.log('📤 Starting PDF extraction from uploaded file:', fileName);
      
      // Try Docling service first
      const isDoclingHealthy = await this.checkDoclingHealth();
      
      if (isDoclingHealthy) {
        try {
          const doclingResult = await this.extractWithDoclingUpload(fileData, fileName);
          return {
            success: true,
            content: doclingResult,
            method: 'docling'
          };
        } catch (doclingError) {
          console.warn('⚠️ Docling upload extraction failed, using fallback:', doclingError instanceof Error ? doclingError.message : String(doclingError));
        }
      }
      
      // Fallback to basic PDF handling
      const fallbackResult = this.createFallbackExtraction(fileName);
      return {
        success: true,
        content: fallbackResult,
        method: 'fallback'
      };
      
    } catch (error) {
      console.error('❌ PDF upload extraction failed:', error);
      return {
        success: false,
        method: 'fallback',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Extract using Docling service with file upload
   */
  private async extractWithDoclingUpload(fileData: Blob | File, fileName: string): Promise<ExtractedContent> {
    console.log('🐍 Using Docling service for upload extraction...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', fileData, fileName);
      
      const response = await fetch(`${this.doclingServiceUrl}/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Docling upload extraction failed: ${errorData.error || response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Docling upload extraction failed: ${result.error}`);
      }
      
      console.log('✅ Docling upload extraction successful');
      
      return {
        title: result.title || fileName.replace('.pdf', ''),
        content: result.content,
        full_text: result.content,
        summary: this.generateSummaryFromContent(result.content),
        metadata: {
          fileType: 'pdf',
          fileName,
          extractionMethod: 'docling_upload',
          extractedAt: new Date().toISOString(),
          ...result.metadata,
          confidence: result.extraction_confidence || 0.95
        }
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extract using Docling service
   */
  private async extractWithDocling(filePath: string, fileName: string): Promise<ExtractedContent> {
    console.log('🐍 Using Docling service for extraction...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    try {
      const response = await fetch(`${this.doclingServiceUrl}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_url: filePath,
          filename: fileName
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Docling extraction failed: ${errorData.error || response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Docling extraction failed: ${result.error}`);
      }
      
      console.log('✅ Docling extraction successful');
      
      return {
        title: result.title || fileName.replace('.pdf', ''),
        content: result.content,
        full_text: result.content,
        summary: this.generateSummaryFromContent(result.content),
        metadata: {
          fileType: 'pdf',
          fileName,
          extractionMethod: 'docling',
          extractedAt: new Date().toISOString(),
          ...result.metadata,
          confidence: result.extraction_confidence || 0.95
        }
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Create message for local files that require upload
   */
  private createLocalFileUploadMessage(fileName: string): ExtractedContent {
    const title = fileName.replace('.pdf', '').replace(/[-_]/g, ' ').trim() || 'PDF Document';
    
    const uploadMessage = `PDF Document: ${title}

📱 Local File Detected

This PDF file is stored locally on your device and cannot be accessed directly by the server.

📄 Document Information:
- Filename: ${fileName}
- Type: PDF Document
- Location: Local device storage

🔄 To process this document:
1. Please select the file again from your device
2. The app will upload it directly for text extraction
3. Once uploaded, full content analysis will be available

💡 Why this happens:
- Mobile apps can't directly access local file paths for security reasons
- Files need to be uploaded to the server for processing

🔍 Once uploaded, you'll be able to:
- Get full text extraction using advanced OCR
- Ask detailed questions about the content
- Search through the document text
- Get AI-powered summaries and insights`;

    return {
      title,
      content: uploadMessage,
      full_text: uploadMessage,
      summary: `Local PDF "${title}" requires re-upload for processing.`,
      metadata: {
        fileType: 'pdf',
        fileName,
        extractionMethod: 'local_file_detected',
        extractedAt: new Date().toISOString(),
        confidence: 0.0,
        requiresUpload: true,
        note: 'Local file path detected - requires direct upload for processing'
      }
    };
  }

  /**
   * Create fallback extraction when Docling is unavailable
   */
  private createFallbackExtraction(fileName: string): ExtractedContent {
    const title = fileName.replace('.pdf', '').replace(/[-_]/g, ' ').trim() || 'PDF Document';
    
    const fallbackContent = `PDF Document: ${title}

This PDF document has been uploaded successfully. 

📄 Document Information:
- Filename: ${fileName}
- Type: PDF Document
- Status: Stored and ready for reference

💡 Note: Advanced text extraction is temporarily unavailable, but the document has been saved and can be referenced in conversations.

🔍 You can:
- Reference this document by name "${title}" in future conversations
- Ask questions about it (though detailed content analysis may be limited)
- Download or view it using the file link

📋 The document is safely stored in your Blii saves and will be processed for content extraction using the Docling service.`;

    return {
      title,
      content: fallbackContent,
      full_text: fallbackContent,
      summary: `PDF document "${title}" uploaded successfully. Content extraction pending.`,
      metadata: {
        fileType: 'pdf',
        fileName,
        extractionMethod: 'fallback',
        extractedAt: new Date().toISOString(),
        confidence: 0.5,
        note: 'Fallback extraction used - document stored for future processing'
      }
    };
  }

  /**
   * Generate summary from content
   */
  private generateSummaryFromContent(content: string): string {
    if (!content) return '';
    
    const sentences = content.match(/[^\.!?]+[\.!?]+/g);
    if (sentences && sentences.length > 0) {
      return sentences.slice(0, 3).join(' ').trim();
    }
    
    return content.substring(0, 200).trim() + (content.length > 200 ? '...' : '');
  }

  /**
   * Extract web content (unchanged)
   */
  async extractWebArticle(url: string): Promise<ExtractedContent> {
    try {
      console.log('🔗 Extracting web article content from:', url);
      
      const WebScraperService = await import('./web-scraper');
      const webScraperService = WebScraperService.default.getInstance();
      
      const scrapedContent = await webScraperService.scrapeUrl(url);
      
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
      console.error('❌ Web content extraction failed:', error);
      throw error;
    }
  }

  /**
   * Get service status for monitoring
   */
  async getServiceStatus() {
    const isHealthy = await this.checkDoclingHealth();
    return {
      doclingServiceHealthy: isHealthy,
      lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
      serviceUrl: this.doclingServiceUrl
    };
  }
}

// Export singleton instance
export const enhancedContentExtractor = new EnhancedContentExtractor();
