// Test script for local Docling service
const fetch = require('node-fetch');

async function testDoclingService() {
  console.log('🧪 Testing local Docling service...');
  
  try {
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:8080/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!healthResponse.ok) {
      console.error('❌ Health check failed:', healthResponse.status);
      return false;
    }
    
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData);
    
    if (!healthData.docling_available) {
      console.error('❌ Docling not available');
      return false;
    }
    
    console.log('✅ Local Docling service is ready!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testDoclingService().then(success => {
  if (success) {
    console.log('🎉 Docling service is working correctly!');
  } else {
    console.log('💥 Docling service test failed');
  }
});

