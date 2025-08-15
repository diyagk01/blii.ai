// Test script to verify message persistence
const { supabase } = require('./config/supabase');

async function testMessagePersistence() {
  console.log('🧪 Testing message persistence...');
  
  try {
    // Test 1: Check if we can connect to Supabase
    console.log('\n📡 Test 1: Database Connection');
    const { data: testData, error: testError } = await supabase
      .from('chat_messages')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database connection failed:', testError);
      return;
    }
    console.log('✅ Database connection successful');
    
    // Test 2: Check if we can query messages
    console.log('\n📊 Test 2: Message Query');
    const { data: messages, error: queryError } = await supabase
      .from('chat_messages')
      .select('*')
      .limit(5);
    
    if (queryError) {
      console.error('❌ Message query failed:', queryError);
      return;
    }
    
    console.log(`✅ Found ${messages?.length || 0} messages in database`);
    
    if (messages && messages.length > 0) {
      console.log('📝 Sample message:', {
        id: messages[0].id,
        content: messages[0].content.substring(0, 50) + '...',
        type: messages[0].type,
        user_id: messages[0].user_id,
        created_at: messages[0].created_at
      });
    }
    
    // Test 3: Check table structure
    console.log('\n🏗️ Test 3: Table Structure');
    const { data: columns, error: columnError } = await supabase
      .from('chat_messages')
      .select('*')
      .limit(0);
    
    if (columnError) {
      console.error('❌ Table structure check failed:', columnError);
    } else {
      console.log('✅ Table structure is accessible');
    }
    
    console.log('\n🎉 Message persistence test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMessagePersistence(); 