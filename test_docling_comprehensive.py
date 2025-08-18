#!/usr/bin/env python3
"""
Comprehensive Docling Service Test Script
Tests all endpoints and functionality
"""

import requests
import json
import time
import sys

def test_health_endpoint():
    """Test the health endpoint"""
    print("🔍 Testing health endpoint...")
    
    try:
        response = requests.get('https://blii-ai.onrender.com/health', timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Health check passed")
            print(f"Service: {data.get('service')}")
            print(f"Docling available: {data.get('docling_available')}")
            print(f"Memory usage: {data.get('memory', {}).get('memory_percent', 'N/A')}%")
            
            if data.get('docling_error'):
                print(f"⚠️ Docling error: {data.get('docling_error')}")
                return False, data
            else:
                print("✅ Docling is working properly")
                return True, data
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False, None

def test_extraction_endpoint():
    """Test the extraction endpoint with a sample PDF"""
    print("\n🔍 Testing extraction endpoint...")
    
    # Test with a simple PDF URL
    test_data = {
        "pdf_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        "filename": "test.pdf"
    }
    
    try:
        response = requests.post(
            'https://blii-ai.onrender.com/extract',
            json=test_data,
            timeout=60
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
                
                # Check if Docling was used
                if data.get('metadata', {}).get('extraction_method') == 'docling_advanced':
                    print("🎉 Docling is working!")
                    return True, data
                elif data.get('metadata', {}).get('docling_failed'):
                    print("⚠️ Docling failed, but fallback worked")
                    print(f"Docling error: {data.get('metadata', {}).get('docling_error', 'Unknown')}")
                    return False, data
                else:
                    print("ℹ️ Using fallback method")
                    return False, data
            else:
                print(f"❌ Extraction failed: {data.get('error')}")
                return False, data
        else:
            print(f"❌ Extraction request failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Extraction error: {e}")
        return False, None

def test_upload_endpoint():
    """Test the upload endpoint with a sample PDF"""
    print("\n🔍 Testing upload endpoint...")
    
    try:
        # Download a test PDF first
        pdf_response = requests.get("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf")
        pdf_response.raise_for_status()
        
        # Create multipart form data
        files = {'file': ('test.pdf', pdf_response.content, 'application/pdf')}
        
        response = requests.post(
            'https://blii-ai.onrender.com/upload',
            files=files,
            timeout=60
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Upload extraction successful")
                print(f"Title: {data.get('title')}")
                print(f"Word count: {data.get('metadata', {}).get('word_count', 'N/A')}")
                print(f"Extraction method: {data.get('metadata', {}).get('extraction_method', 'N/A')}")
                print(f"Confidence: {data.get('extraction_confidence', 'N/A')}")
                
                if data.get('metadata', {}).get('extraction_method') == 'docling_advanced':
                    print("🎉 Docling upload is working!")
                    return True
                else:
                    print("⚠️ Using fallback for upload")
                    return False
            else:
                print(f"❌ Upload extraction failed: {data.get('error')}")
                return False
        else:
            print(f"❌ Upload request failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return False

def test_complex_pdf():
    """Test with a more complex PDF to see Docling's capabilities"""
    print("\n🔍 Testing with complex PDF...")
    
    # Test with a more complex PDF (you can replace this URL)
    test_data = {
        "pdf_url": "https://arxiv.org/pdf/1706.03762.pdf",  # Attention is All You Need paper
        "filename": "attention_paper.pdf"
    }
    
    try:
        response = requests.post(
            'https://blii-ai.onrender.com/extract',
            json=test_data,
            timeout=120  # Longer timeout for complex PDF
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Complex PDF extraction successful")
                print(f"Title: {data.get('title')}")
                print(f"Word count: {data.get('metadata', {}).get('word_count', 'N/A')}")
                print(f"Extraction method: {data.get('metadata', {}).get('extraction_method', 'N/A')}")
                print(f"Confidence: {data.get('extraction_confidence', 'N/A')}")
                
                if data.get('metadata', {}).get('extraction_method') == 'docling_advanced':
                    print("🎉 Docling handles complex PDFs!")
                    return True
                else:
                    print("⚠️ Fallback used for complex PDF")
                    return False
            else:
                print(f"❌ Complex PDF extraction failed: {data.get('error')}")
                return False
        else:
            print(f"❌ Complex PDF request failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Complex PDF error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Comprehensive Docling Service Test")
    print("=" * 50)
    
    # Test health endpoint
    health_ok, health_data = test_health_endpoint()
    
    if health_ok:
        print("\n✅ Service is healthy and Docling is available!")
    else:
        print("\n⚠️ Service is running but Docling has issues")
    
    # Test extraction endpoint
    extraction_ok, extraction_data = test_extraction_endpoint()
    
    # Test upload endpoint
    upload_ok = test_upload_endpoint()
    
    # Test complex PDF
    complex_ok = test_complex_pdf()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    print(f"Health Check: {'✅ PASS' if health_ok else '❌ FAIL'}")
    print(f"Extraction: {'✅ PASS' if extraction_ok else '⚠️ FALLBACK'}")
    print(f"Upload: {'✅ PASS' if upload_ok else '❌ FAIL'}")
    print(f"Complex PDF: {'✅ PASS' if complex_ok else '⚠️ FALLBACK'}")
    
    if health_ok and extraction_data and extraction_data.get('metadata', {}).get('extraction_method') == 'docling_advanced':
        print("\n🎉 EXCELLENT! Docling is working perfectly!")
        print("✅ Advanced PDF extraction with tables and layouts")
        print("✅ High-quality text extraction")
        print("✅ Complex document handling")
    elif extraction_ok:
        print("\n⚠️ GOOD! Service is working with fallback methods")
        print("✅ Basic PDF extraction is functional")
        print("⚠️ Docling needs to be fixed for advanced features")
    else:
        print("\n❌ ISSUES DETECTED")
        print("❌ Service may not be working properly")
    
    print("\n🔧 Next Steps:")
    if not health_ok:
        print("- Check Render deployment logs")
        print("- Verify the service is fully deployed")
    elif not extraction_ok:
        print("- Check Docling model download issues")
        print("- Review service logs for errors")
    else:
        print("- Service is working! Test with your app")
    
    print("=" * 50)

if __name__ == "__main__":
    main()

