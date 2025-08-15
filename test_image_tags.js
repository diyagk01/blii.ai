// Test script to verify image analysis and tag generation
const { FastImageAnalyzer } = require('./services/fast-image-analyzer');

async function testImageTagGeneration() {
  console.log('🧪 Testing image analysis and tag generation...');
  
  try {
    // Test with a sample image
    const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg';
    
    const analyzer = FastImageAnalyzer.getInstance();
    const analysis = await analyzer.analyzeImageFast(testImageUrl);
    const tags = analyzer.generateTags(analysis);
    
    console.log('✅ Image Analysis Results:');
    console.log('📝 Description:', analysis.description);
    console.log('🏷️ Generated Tags:', tags);
    console.log('⏱️ Processing Time:', analysis.processingTime + 'ms');
    console.log('📊 Confidence:', analysis.confidence);
    
    return { success: true, tags, analysis };
  } catch (error) {
    console.error('❌ Image analysis test failed:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
testImageTagGeneration().then(result => {
  if (result.success) {
    console.log('\n🎉 Image tag generation is working properly!');
    console.log('📋 Tags generated:', result.tags.length);
  } else {
    console.log('\n❌ Image tag generation test failed');
  }
}); 