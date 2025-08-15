// Test script for React Native integration
// This shows how to test the enhanced PDF extraction in your app

import { enhancedContentExtractor } from './services/enhanced-content-extractor';

/**
 * Test enhanced PDF extraction with different scenarios
 */
export class PDFExtractionTester {
  
  /**
   * Test URL-based PDF extraction
   */
  static async testURLExtraction() {
    console.log('🔗 Testing URL-based PDF extraction...');
    
    const testURL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    const fileName = 'dummy.pdf';
    
    try {
      const result = await enhancedContentExtractor.extractPDFContent(testURL, fileName);
      
      console.log('📄 URL Extraction Result:', {
        success: result.success,
        method: result.method,
        wordCount: result.content?.metadata?.word_count || 0,
        title: result.content?.title,
        hasContent: !!result.content?.content,
        contentPreview: result.content?.content?.substring(0, 100) + '...'
      });
      
      return result;
    } catch (error) {
      console.error('❌ URL extraction failed:', error);
      return null;
    }
  }
  
  /**
   * Test local file path handling
   */
  static async testLocalFileDetection() {
    console.log('📱 Testing local file detection...');
    
    const localFilePath = 'file:///var/mobile/Containers/Data/Application/test.pdf';
    const fileName = 'test.pdf';
    
    try {
      const result = await enhancedContentExtractor.extractPDFContent(localFilePath, fileName);
      
      console.log('📱 Local File Detection Result:', {
        success: result.success,
        method: result.method,
        error: result.error,
        requiresUpload: result.content?.metadata?.requiresUpload,
        message: result.content?.content?.substring(0, 200) + '...'
      });
      
      // Should return error code for local files
      if (result.error === 'LOCAL_FILE_UPLOAD_REQUIRED') {
        console.log('✅ Local file detection working correctly');
        return true;
      } else {
        console.log('❌ Local file detection not working as expected');
        return false;
      }
    } catch (error) {
      console.error('❌ Local file detection failed:', error);
      return false;
    }
  }
  
  /**
   * Test file upload extraction (simulated)
   */
  static async testFileUploadExtraction() {
    console.log('📤 Testing file upload extraction...');
    
    // Simulate file blob (in real app, this would come from DocumentPicker)
    const mockFileContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Hello World Test Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF`;
    
    try {
      // Create a Blob from the PDF content
      const fileBlob = new Blob([mockFileContent], { type: 'application/pdf' });
      const fileName = 'test_upload.pdf';
      
      const result = await enhancedContentExtractor.extractPDFFromUpload(fileBlob, fileName);
      
      console.log('📤 Upload Extraction Result:', {
        success: result.success,
        method: result.method,
        wordCount: result.content?.metadata?.word_count || 0,
        title: result.content?.title,
        extractionMethod: result.content?.metadata?.extractionMethod,
        confidence: result.content?.metadata?.confidence
      });
      
      return result;
    } catch (error) {
      console.error('❌ Upload extraction failed:', error);
      return null;
    }
  }
  
  /**
   * Test service health status
   */
  static async testServiceHealth() {
    console.log('🏥 Testing service health...');
    
    try {
      const status = await enhancedContentExtractor.getServiceStatus();
      
      console.log('🏥 Service Health Status:', {
        doclingHealthy: status.doclingServiceHealthy,
        lastHealthCheck: status.lastHealthCheck,
        serviceUrl: status.serviceUrl
      });
      
      return status;
    } catch (error) {
      console.error('❌ Service health check failed:', error);
      return null;
    }
  }
  
  /**
   * Run comprehensive test suite
   */
  static async runAllTests() {
    console.log('🧪 Starting comprehensive PDF extraction tests...');
    
    const results = {
      serviceHealth: await this.testServiceHealth(),
      urlExtraction: await this.testURLExtraction(),
      localFileDetection: await this.testLocalFileDetection(),
      uploadExtraction: await this.testFileUploadExtraction()
    };
    
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(50));
    
    // Service Health
    const healthStatus = results.serviceHealth?.doclingServiceHealthy ? '✅' : '❌';
    console.log(`${healthStatus} Service Health: ${results.serviceHealth?.doclingServiceHealthy ? 'Healthy' : 'Unhealthy'}`);
    
    // URL Extraction
    const urlStatus = results.urlExtraction?.success ? '✅' : '❌';
    console.log(`${urlStatus} URL Extraction: ${results.urlExtraction?.success ? 'Working' : 'Failed'}`);
    
    // Local File Detection
    const localStatus = results.localFileDetection ? '✅' : '❌';
    console.log(`${localStatus} Local File Detection: ${results.localFileDetection ? 'Working' : 'Failed'}`);
    
    // Upload Extraction
    const uploadStatus = results.uploadExtraction?.success ? '✅' : '❌';
    console.log(`${uploadStatus} Upload Extraction: ${results.uploadExtraction?.success ? 'Working' : 'Failed'}`);
    
    const allPassed = (
      results.serviceHealth?.doclingServiceHealthy &&
      results.urlExtraction?.success &&
      results.localFileDetection &&
      results.uploadExtraction?.success
    );
    
    console.log('\n🎯 Overall Status:', allPassed ? '✅ All Tests Passed' : '⚠️ Some Tests Failed');
    
    if (allPassed) {
      console.log('\n🚀 Your PDF extraction system is working perfectly!');
      console.log('• Local file detection works');
      console.log('• Upload extraction works');
      console.log('• URL extraction works');
      console.log('• Docling service is healthy');
    } else {
      console.log('\n🔧 Issues detected:');
      if (!results.serviceHealth?.doclingServiceHealthy) {
        console.log('• Docling service is not healthy');
      }
      if (!results.urlExtraction?.success) {
        console.log('• URL extraction is not working');
      }
      if (!results.localFileDetection) {
        console.log('• Local file detection is not working');
      }
      if (!results.uploadExtraction?.success) {
        console.log('• Upload extraction is not working');
      }
    }
    
    return results;
  }
}

/**
 * Example usage in your React Native app
 */
export const exampleUsage = {
  
  // When user selects a PDF from DocumentPicker
  handleDocumentPick: async (result) => {
    if (result.type === 'success') {
      const { uri, name } = result;
      
      console.log('📄 Processing selected PDF:', name);
      
      // Check if it's a local file
      if (uri.startsWith('file://')) {
        console.log('📱 Local file detected, need to upload...');
        
        // Option 1: Show user they need to re-select the file
        const extractionResult = await enhancedContentExtractor.extractPDFContent(uri, name);
        if (extractionResult.error === 'LOCAL_FILE_UPLOAD_REQUIRED') {
          // Show user the helpful message
          console.log(extractionResult.content.content);
          return;
        }
        
        // Option 2: Convert to blob and upload directly
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const uploadResult = await enhancedContentExtractor.extractPDFFromUpload(blob, name);
          
          if (uploadResult.success) {
            console.log('✅ Upload extraction successful!');
            // Save to database, show content, etc.
          }
        } catch (error) {
          console.error('❌ Upload failed:', error);
        }
        
      } else {
        // Regular URL-based extraction
        const extractionResult = await enhancedContentExtractor.extractPDFContent(uri, name);
        
        if (extractionResult.success) {
          console.log('✅ PDF extraction successful!');
          // Save to database, show content, etc.
        }
      }
    }
  },
  
  // Test the system during app development
  runDevelopmentTests: async () => {
    console.log('🧪 Running development tests...');
    await PDFExtractionTester.runAllTests();
  }
};

// Export for easy testing
export default PDFExtractionTester;
