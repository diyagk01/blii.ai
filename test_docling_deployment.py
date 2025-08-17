#!/usr/bin/env python3
"""
Test script for Docling service deployment
"""

import requests
import json
import time

def test_health_endpoint():
    """Test the health endpoint"""
    print("🔍 Testing health endpoint...")
    
    try:
        response = requests.get('https://blii-ai.onrender.com/health', timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Health check passed")
            print(f"Service: {data.get('service')}")
            print(f"Docling available: {data.get('docling_available')}")
            print(f"Memory usage: {data.get('memory', {}).get('memory_percent', 'N/A')}%")
            
            if data.get('docling_error'):
                print(f"❌ Docling error: {data.get('docling_error')}")
                return False
            else:
                print("✅ Docling is working properly")
                return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_extraction_endpoint():
    """Test the extraction endpoint with a sample PDF"""
    print("\n🔍 Testing extraction endpoint...")
    
    # Test with a simple PDF URL (you can replace this with your own test PDF)
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
                print(f"Content preview: {data.get('content', '')[:100]}...")
                return True
            else:
                print(f"❌ Extraction failed: {data.get('error')}")
                return False
        else:
            print(f"❌ Extraction request failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Extraction error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing Docling service deployment...")
    print("=" * 50)
    
    # Test health endpoint
    health_ok = test_health_endpoint()
    
    if health_ok:
        # Test extraction endpoint
        extraction_ok = test_extraction_endpoint()
        
        if extraction_ok:
            print("\n🎉 All tests passed! Docling service is working properly.")
        else:
            print("\n⚠️ Health check passed but extraction failed.")
    else:
        print("\n❌ Health check failed. Service may not be properly deployed.")
    
    print("=" * 50)

if __name__ == "__main__":
    main()
