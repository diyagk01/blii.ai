// Test script to verify tag input functionality
console.log('🧪 Testing tag input functionality...');

// Simulate the tag input functions
function addTag(tag) {
  const trimmedTag = tag.trim().toLowerCase();
  if (trimmedTag && trimmedTag.length > 0) {
    console.log('✅ Tag added:', trimmedTag);
    return true;
  } else {
    console.log('❌ Tag not added:', trimmedTag, 'Reason:', !trimmedTag ? 'empty' : 'invalid');
    return false;
  }
}

function handleTagInputSubmit(input) {
  console.log('🔄 Tag input submit triggered with:', input);
  if (input.trim()) {
    return addTag(input);
  } else {
    console.log('❌ Empty tag input, not adding');
    return false;
  }
}

// Test cases
const testCases = [
  'work',
  'personal',
  'important',
  '   project   ', // Should trim to 'project'
  '', // Should fail
  '   ', // Should fail
  'very-long-tag-name-that-might-be-too-long',
  'tag with spaces',
  'TAG_WITH_CAPS',
];

console.log('\n📋 Running tag input tests...\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: "${testCase}"`);
  const result = handleTagInputSubmit(testCase);
  console.log(`Result: ${result ? 'PASS' : 'FAIL'}\n`);
});

console.log('🎉 Tag input test completed!'); 