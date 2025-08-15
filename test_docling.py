#!/usr/bin/env python3
"""
Test script for Docling PDF extraction service
"""
import requests
import json
import time

def test_docling_service():
    """Test the Docling service setup and extraction"""
    
    service_url = "http://localhost:8080"
    
    print("🧪 Testing Docling PDF Extraction Service")
    print("=" * 50)
    
    # Test 1: Health check
    print("1. Testing service health...")
    try:
        response = requests.get(f"{service_url}/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Service is healthy: {health_data}")
            
            if not health_data.get('docling_available'):
                print("❌ Docling is not available in the service")
                return False
        else:
            print(f"❌ Health check failed with status: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to Docling service: {e}")
        print("💡 Make sure to start the service first:")
        print("   cd python-services")
        print("   python3 docling_service.py")
        return False
    
    # Test 2: PDF extraction with a sample URL
    print("\n2. Testing PDF extraction with sample document...")
    test_pdf_url = "https://arxiv.org/pdf/2408.09869"  # Docling technical report
    
    try:
        start_time = time.time()
        
        response = requests.post(f"{service_url}/extract", 
            json={
                "pdf_url": test_pdf_url,
                "filename": "docling_technical_report.pdf"
            },
            timeout=120  # 2 minutes for PDF processing
        )
        
        processing_time = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"✅ PDF extraction successful!")
                print(f"📊 Processing time: {processing_time:.2f} seconds")
                print(f"📄 Title: {result.get('title', 'N/A')}")
                print(f"📝 Content length: {len(result.get('content', ''))}")
                print(f"🔢 Word count: {result.get('metadata', {}).get('word_count', 'N/A')}")
                print(f"📑 Pages: {result.get('metadata', {}).get('page_count', 'N/A')}")
                print(f"🔍 Has tables: {result.get('metadata', {}).get('has_tables', 'N/A')}")
                print(f"🖼️ Has images: {result.get('metadata', {}).get('has_images', 'N/A')}")
                
                # Show first 300 characters of extracted content
                content_preview = result.get('content', '')[:300]
                print(f"\n📝 Content preview:")
                print("-" * 40)
                print(content_preview + ("..." if len(result.get('content', '')) > 300 else ""))
                print("-" * 40)
                
                return True
            else:
                print(f"❌ PDF extraction failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Request failed with status: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error details: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out (PDF processing took too long)")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False

if __name__ == "__main__":
    success = test_docling_service()
    
    if success:
        print("\n🎉 All tests passed! Docling service is working correctly.")
        print("💡 Your React Native app can now use the service at http://localhost:8080")
    else:
        print("\n❌ Tests failed. Please check the service setup.")
        print("\n🔧 To start the Docling service:")
        print("   cd python-services")
        print("   chmod +x start_docling_service.sh")
        print("   ./start_docling_service.sh")
        print("\n   OR")
        print("\n   python3 docling_service.py")
