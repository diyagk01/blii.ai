#!/usr/bin/env python3
"""
Test script for improved PDF extraction services
Tests both Docling and Simple PDF services with various scenarios
"""

import requests
import json
import os
import tempfile
import time
from pathlib import Path

# Service URLs
DOCLING_SERVICE_URL = "https://blii-pdf-extraction-production.up.railway.app"
SIMPLE_PDF_SERVICE_URL = "http://localhost:8080"  # Update if different

# Test PDFs
TEST_PDFS = [
    {
        "name": "W3C Dummy PDF",
        "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        "expected_words": 4
    },
    {
        "name": "IRS Form W-4",
        "url": "https://www.irs.gov/pub/irs-pdf/fw4.pdf",
        "expected_words": 3000  # Approximate
    },
    {
        "name": "Learning Container Sample",
        "url": "https://www.learningcontainer.com/wp-content/uploads/2019/09/sample-pdf-download-10-mb.pdf",
        "expected_words": 4000  # Approximate
    }
]

def print_header(title):
    """Print a formatted header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_subheader(title):
    """Print a formatted subheader"""
    print(f"\n{'-'*40}")
    print(f"  {title}")
    print(f"{'-'*40}")

def test_service_health(service_name, health_url):
    """Test service health endpoint"""
    print(f"\n🔍 Testing {service_name} health...")
    
    try:
        response = requests.get(health_url, timeout=10)
        if response.ok:
            data = response.json()
            print(f"✅ {service_name} is healthy")
            print(f"   Status: {data.get('status', 'unknown')}")
            if 'docling_available' in data:
                print(f"   Docling Available: {data['docling_available']}")
            return True
        else:
            print(f"❌ {service_name} health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ {service_name} is not reachable: {e}")
        return False

def test_docling_url_extraction(pdf_info):
    """Test Docling service URL extraction"""
    print(f"\n📄 Testing Docling URL extraction: {pdf_info['name']}")
    
    try:
        payload = {
            "pdf_url": pdf_info["url"],
            "filename": f"{pdf_info['name']}.pdf"
        }
        
        response = requests.post(
            f"{DOCLING_SERVICE_URL}/extract",
            json=payload,
            timeout=60
        )
        
        if response.ok:
            data = response.json()
            if data.get('success'):
                word_count = data.get('metadata', {}).get('word_count', 0)
                print(f"✅ Docling extraction successful")
                print(f"   Word count: {word_count}")
                print(f"   Method: {data.get('metadata', {}).get('extraction_method')}")
                print(f"   Content preview: {data.get('content', '')[:100]}...")
                return True
            else:
                print(f"❌ Docling extraction failed: {data.get('error')}")
                return False
        else:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            print(f"❌ Docling request failed: {response.status_code}")
            print(f"   Error: {error_data.get('error', response.text[:200])}")
            return False
            
    except Exception as e:
        print(f"❌ Docling extraction error: {e}")
        return False

def test_docling_upload():
    """Test Docling service file upload"""
    print(f"\n📤 Testing Docling upload endpoint...")
    
    try:
        # Create a simple test PDF content
        test_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Hello World Test) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF"""
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_file.write(test_content)
            temp_file_path = temp_file.name
        
        try:
            # Test upload
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test_upload.pdf', f, 'application/pdf')}
                response = requests.post(
                    f"{DOCLING_SERVICE_URL}/upload",
                    files=files,
                    timeout=60
                )
            
            if response.ok:
                data = response.json()
                if data.get('success'):
                    word_count = data.get('metadata', {}).get('word_count', 0)
                    print(f"✅ Docling upload successful")
                    print(f"   Word count: {word_count}")
                    print(f"   Method: {data.get('metadata', {}).get('extraction_method')}")
                    print(f"   Content preview: {data.get('content', '')[:100]}...")
                    return True
                else:
                    print(f"❌ Docling upload extraction failed: {data.get('error')}")
                    return False
            else:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                print(f"❌ Docling upload failed: {response.status_code}")
                print(f"   Error: {error_data.get('error', response.text[:200])}")
                return False
                
        finally:
            # Clean up
            try:
                os.unlink(temp_file_path)
            except:
                pass
                
    except Exception as e:
        print(f"❌ Docling upload test error: {e}")
        return False

def test_simple_pdf_url_extraction(pdf_info):
    """Test Simple PDF service URL extraction"""
    print(f"\n📄 Testing Simple PDF URL extraction: {pdf_info['name']}")
    
    try:
        payload = {
            "pdf_url": pdf_info["url"]
        }
        
        response = requests.post(
            f"{SIMPLE_PDF_SERVICE_URL}/extract",
            json=payload,
            timeout=60
        )
        
        if response.ok:
            data = response.json()
            if data.get('success'):
                word_count = data.get('word_count', 0)
                print(f"✅ Simple PDF extraction successful")
                print(f"   Word count: {word_count}")
                print(f"   Method: {data.get('method')}")
                print(f"   Content preview: {data.get('content', '')[:100]}...")
                return True
            else:
                print(f"❌ Simple PDF extraction failed: {data.get('error')}")
                return False
        else:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            print(f"❌ Simple PDF request failed: {response.status_code}")
            print(f"   Error: {error_data.get('error', response.text[:200])}")
            return False
            
    except Exception as e:
        print(f"❌ Simple PDF extraction error: {e}")
        return False

def test_simple_pdf_upload():
    """Test Simple PDF service file upload"""
    print(f"\n📤 Testing Simple PDF upload endpoint...")
    
    try:
        # Create the same test PDF content
        test_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Hello World Test) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF"""
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_file.write(test_content)
            temp_file_path = temp_file.name
        
        try:
            # Test upload
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test_upload.pdf', f, 'application/pdf')}
                response = requests.post(
                    f"{SIMPLE_PDF_SERVICE_URL}/upload",
                    files=files,
                    timeout=60
                )
            
            if response.ok:
                data = response.json()
                if data.get('success'):
                    word_count = data.get('word_count', 0)
                    print(f"✅ Simple PDF upload successful")
                    print(f"   Word count: {word_count}")
                    print(f"   Method: {data.get('method')}")
                    print(f"   Content preview: {data.get('content', '')[:100]}...")
                    return True
                else:
                    print(f"❌ Simple PDF upload extraction failed: {data.get('error')}")
                    return False
            else:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                print(f"❌ Simple PDF upload failed: {response.status_code}")
                print(f"   Error: {error_data.get('error', response.text[:200])}")
                return False
                
        finally:
            # Clean up
            try:
                os.unlink(temp_file_path)
            except:
                pass
                
    except Exception as e:
        print(f"❌ Simple PDF upload test error: {e}")
        return False

def test_local_file_handling():
    """Test local file path handling"""
    print(f"\n📱 Testing local file path handling...")
    
    try:
        # Test file:// URL with Simple PDF service
        payload = {
            "pdf_url": "file:///var/mobile/Containers/Data/Application/test.pdf"
        }
        
        response = requests.post(
            f"{SIMPLE_PDF_SERVICE_URL}/extract",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            error_code = data.get('code')
            print(f"✅ Local file handling working correctly")
            print(f"   Error code: {error_code}")
            print(f"   Message: {data.get('error', '')[:100]}...")
            
            if error_code in ['LOCAL_FILE_UPLOAD_REQUIRED', 'LOCAL_FILE_ACCESS_DENIED']:
                print(f"   ✅ Correct error code returned")
                return True
            else:
                print(f"   ⚠️ Unexpected error code: {error_code}")
                return False
        else:
            print(f"❌ Expected 400 status for local file, got: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Local file test error: {e}")
        return False

def main():
    """Run all tests"""
    print_header("PDF Extraction Services Test Suite")
    print("Testing improved PDF extraction with local file support")
    
    # Test service health
    print_subheader("Service Health Checks")
    docling_healthy = test_service_health("Docling Service", f"{DOCLING_SERVICE_URL}/health")
    simple_healthy = test_service_health("Simple PDF Service", f"{SIMPLE_PDF_SERVICE_URL}/health")
    
    # Track test results
    results = {
        'docling_health': docling_healthy,
        'simple_health': simple_healthy,
        'docling_url_tests': [],
        'docling_upload': False,
        'simple_url_tests': [],
        'simple_upload': False,
        'local_file_handling': False
    }
    
    # Test URL extraction if services are healthy
    if docling_healthy:
        print_subheader("Docling Service URL Extraction Tests")
        for pdf_info in TEST_PDFS:
            success = test_docling_url_extraction(pdf_info)
            results['docling_url_tests'].append(success)
            time.sleep(1)  # Brief pause between requests
        
        print_subheader("Docling Service Upload Test")
        results['docling_upload'] = test_docling_upload()
    
    if simple_healthy:
        print_subheader("Simple PDF Service URL Extraction Tests")
        for pdf_info in TEST_PDFS:
            success = test_simple_pdf_url_extraction(pdf_info)
            results['simple_url_tests'].append(success)
            time.sleep(1)  # Brief pause between requests
        
        print_subheader("Simple PDF Service Upload Test")
        results['simple_upload'] = test_simple_pdf_upload()
        
        print_subheader("Local File Handling Test")
        results['local_file_handling'] = test_local_file_handling()
    
    # Print summary
    print_header("Test Results Summary")
    
    print(f"🏥 Service Health:")
    print(f"   Docling Service: {'✅ Healthy' if results['docling_health'] else '❌ Unhealthy'}")
    print(f"   Simple PDF Service: {'✅ Healthy' if results['simple_health'] else '❌ Unhealthy'}")
    
    if results['docling_health']:
        print(f"\n🐍 Docling Service Tests:")
        url_success_count = sum(results['docling_url_tests'])
        print(f"   URL Extraction: {url_success_count}/{len(results['docling_url_tests'])} passed")
        print(f"   Upload Endpoint: {'✅ Passed' if results['docling_upload'] else '❌ Failed'}")
    
    if results['simple_health']:
        print(f"\n🔧 Simple PDF Service Tests:")
        url_success_count = sum(results['simple_url_tests'])
        print(f"   URL Extraction: {url_success_count}/{len(results['simple_url_tests'])} passed")
        print(f"   Upload Endpoint: {'✅ Passed' if results['simple_upload'] else '❌ Failed'}")
        print(f"   Local File Handling: {'✅ Passed' if results['local_file_handling'] else '❌ Failed'}")
    
    # Overall status
    all_critical_tests_passed = (
        results['docling_health'] and 
        results['docling_upload'] and
        results['simple_health'] and
        results['local_file_handling']
    )
    
    print(f"\n🎯 Overall Status: {'✅ All Critical Tests Passed' if all_critical_tests_passed else '⚠️ Some Tests Failed'}")
    
    if all_critical_tests_passed:
        print("\n🚀 Your PDF extraction system is ready for production!")
        print("   • Local file handling works correctly")
        print("   • Upload endpoints are functional")
        print("   • Docling service is processing PDFs")
    else:
        print("\n🔧 Next Steps:")
        if not results['docling_health']:
            print("   • Check Docling service deployment")
        if not results['simple_health']:
            print("   • Start Simple PDF service locally")
        if not results['local_file_handling']:
            print("   • Review local file handling implementation")

if __name__ == "__main__":
    main()
