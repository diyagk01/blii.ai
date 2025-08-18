#!/usr/bin/env python3
"""
Local Docling Test Script
Tests Docling functionality locally
"""

import requests
import json

def test_local_health():
    """Test local health endpoint"""
    print("🔍 Testing local health endpoint...")
    
    try:
        response = requests.get('http://localhost:8080/health', timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Health check passed")
            print(f"Service: {data.get('service')}")
            print(f"Docling available: {data.get('docling_available')}")
            print(f"Memory usage: {data.get('memory', {}).get('memory_percent', 'N/A')}%")
            
            if data.get('docling_error'):
                print(f"⚠️ Docling error: {data.get('docling_error')}")
                return False
            else:
                print("✅ Docling is working properly")
                return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Health check error: {e}")
        print("💡 Make sure the local service is running: python3 docling_service.py")
        return False

def test_local_extraction():
    """Test local extraction endpoint"""
    print("\n🔍 Testing local extraction endpoint...")
    
    # Test with a simple PDF URL
    test_data = {
        "pdf_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        "filename": "test.pdf"
    }
    
    try:
        response = requests.post(
            'http://localhost:8080/extract',
            json=test_data,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Extraction successful")
                print(f"Title: {data.get('title')}")
                print(f"Word count: {data.get('metadata', {}).get('word_count', 'N/A')}")
                print(f"Extraction method: {data.get('metadata', {}).get('extraction_method', 'N/A')}")
                print(f"Confidence: {data.get('extraction_confidence', 'N/A')}")
                print(f"Content preview: {data.get('content', '')[:100]}...")
                
                if data.get('metadata', {}).get('extraction_method') == 'docling_simple':
                    print("🎉 Docling is working locally!")
                    return True
                else:
                    print("⚠️ Using fallback method")
                    return False
            else:
                print(f"❌ Extraction failed: {data.get('error')}")
                return False
        else:
            print(f"❌ Extraction request failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Extraction error: {e}")
        return False

def main():
    """Run local tests"""
    print("🚀 Local Docling Service Test")
    print("=" * 40)
    
    # Test health endpoint
    health_ok = test_local_health()
    
    if health_ok:
        # Test extraction endpoint
        extraction_ok = test_local_extraction()
        
        # Summary
        print("\n" + "=" * 40)
        print("📊 LOCAL TEST SUMMARY")
        print("=" * 40)
        print(f"Health Check: {'✅ PASS' if health_ok else '❌ FAIL'}")
        print(f"Extraction: {'✅ PASS' if extraction_ok else '❌ FAIL'}")
        
        if health_ok and extraction_ok:
            print("\n🎉 EXCELLENT! Local Docling is working perfectly!")
            print("✅ You can now use this for development")
        else:
            print("\n⚠️ Some issues detected")
            print("Check the logs above for details")
    else:
        print("\n❌ Service not running")
        print("Start the service with: python3 docling_service.py")
    
    print("=" * 40)

if __name__ == "__main__":
    main()

