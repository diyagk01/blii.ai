#!/usr/bin/env python3
"""
Simple test script for the new simplified Docling PDF extraction
"""

from docling.document_converter import DocumentConverter

def test_simple_docling():
    """Test the basic Docling conversion approach"""
    
    # Example PDF URL (you can replace this with any PDF URL)
    test_url = "https://arxiv.org/pdf/2408.09869"
    
    print("🔄 Testing simple Docling PDF extraction...")
    print(f"📄 Processing: {test_url}")
    
    # Create simple converter (just like in our service)
    converter = DocumentConverter()
    print("✅ DocumentConverter initialized")
    
    try:
        # Convert the PDF directly from URL
        result = converter.convert(test_url)
        
        # Export to markdown
        markdown_content = result.document.export_to_markdown()
        
        # Print results
        print(f"✅ Extraction successful!")
        print(f"📊 Content length: {len(markdown_content)} characters")
        print(f"📊 Word count: {len(markdown_content.split())} words")
        print("\n" + "="*50)
        print("EXTRACTED CONTENT (first 500 chars):")
        print("="*50)
        print(markdown_content[:500] + "..." if len(markdown_content) > 500 else markdown_content)
        print("="*50)
        
        return True
        
    except Exception as e:
        print(f"❌ Extraction failed: {e}")
        return False

if __name__ == "__main__":
    success = test_simple_docling()
    if success:
        print("\n🎉 Test completed successfully!")
        print("💡 The simplified Docling approach is working!")
    else:
        print("\n❌ Test failed!")
