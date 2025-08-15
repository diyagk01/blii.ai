// Test script to debug document extraction and retrieval
// Run this in your React Native environment to check if extracted content is being stored and retrieved properly

import ChatService from './services/chat';
import OpenAIService from './services/openai';

async function testDocumentExtraction() {
  console.log('🧪 Testing document extraction and retrieval...');
  
  try {
    const chatService = ChatService.getInstance();
    const openAIService = OpenAIService.getInstance();
    
    // Step 1: Check if there are any messages with extracted content
    console.log('\n📊 Step 1: Checking for messages with extracted content...');
    const debugResult = await chatService.debugExtractedContent();
    console.log('Debug result:', JSON.stringify(debugResult, null, 2));
    
    // Step 2: Test AI response generation with a sample query
    console.log('\n🤖 Step 2: Testing AI response generation...');
    const testQuery = 'What documents do I have saved?';
    console.log('Test query:', testQuery);
    
    const response = await openAIService.generateResponseWithDatabaseContext(testQuery);
    console.log('AI Response:', response);
    
    // Step 3: Test with a more specific query
    console.log('\n🔍 Step 3: Testing specific content query...');
    const specificQuery = 'Tell me about the content in my saved documents';
    console.log('Specific query:', specificQuery);
    
    const specificResponse = await openAIService.generateResponseWithDatabaseContext(specificQuery);
    console.log('Specific Response:', specificResponse);
    
    console.log('\n✅ Document extraction test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in React Native
export default testDocumentExtraction;

// If running in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = testDocumentExtraction;
}
