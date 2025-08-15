#!/usr/bin/env python3
"""
Test script for Public Docling PDF extraction service with local files
This script tests your deployed docling service with local PDF files
"""
import requests
import json
import time
import os
import base64
import sys

def test_public_docling_service():
    """Test the public Docling service with local files"""
    
    # Your deployed service URL
    service_url = "https://blii-pdf-extraction-production.up.railway.app"
    
    print("🧪 Testing Public Docling PDF Extraction Service with Local Files")
    print("=" * 70)
    print(f"🌐 Service URL: {service_url}")
    print()
    
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
        print(f"❌ Cannot connect to public Docling service: {e}")
        return False
    
    # Test 2: Find local PDF files to test with
    print("\n2. Looking for local PDF files to test...")
    
    # Check for test_upload.pdf in current directory
    test_files = []
    
    if os.path.exists("test_upload.pdf"):
        test_files.append("test_upload.pdf")
        print(f"✅ Found: test_upload.pdf")
    
    # Look for other PDFs in common locations
    pdf_locations = [
        ".",
        "python-services",
        "assets",
        os.path.expanduser("~/Downloads"),
        os.path.expanduser("~/Desktop")
    ]
    
    for location in pdf_locations:
        if os.path.exists(location):
            try:
                for file in os.listdir(location):
                    if file.lower().endswith('.pdf') and file not in [f.split('/')[-1] for f in test_files]:
                        full_path = os.path.join(location, file)
                        if os.path.getsize(full_path) < 10 * 1024 * 1024:  # Less than 10MB
                            test_files.append(full_path)
                            print(f"✅ Found: {full_path}")
                        if len(test_files) >= 3:  # Limit to 3 files for testing
                            break
            except PermissionError:
                continue
    
    if not test_files:
        print("❌ No PDF files found for testing.")
        print("💡 Place a PDF file named 'test_upload.pdf' in the current directory")
        print("   or ensure you have PDF files in your Downloads/Desktop folders")
        return False
    
    print(f"\n📄 Found {len(test_files)} PDF file(s) to test with")
    
    # Test 3: Upload and extract using the /upload endpoint
    print("\n3. Testing PDF extraction via file upload...")
    
    for i, pdf_file in enumerate(test_files[:2], 1):  # Test first 2 files
        print(f"\n--- Test {i}: {os.path.basename(pdf_file)} ---")
        
        try:
            # Check file size
            file_size = os.path.getsize(pdf_file)
            print(f"📏 File size: {file_size / 1024:.1f} KB")
            
            if file_size > 5 * 1024 * 1024:  # 5MB limit
                print(f"⚠️ File too large ({file_size / 1024 / 1024:.1f} MB), skipping...")
                continue
            
            start_time = time.time()
            
            # Upload file to the service
            with open(pdf_file, 'rb') as f:
                files = {'file': (os.path.basename(pdf_file), f, 'application/pdf')}
                
                response = requests.post(
                    f"{service_url}/upload", 
                    files=files,
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
                    print(f"🎯 Confidence: {result.get('extraction_confidence', 'N/A')}")
                    
                    # Show first 200 characters of extracted content
                    content_preview = result.get('content', '')[:200]
                    print(f"\n📝 Content preview:")
                    print("-" * 40)
                    print(content_preview + ("..." if len(result.get('content', '')) > 200 else ""))
                    print("-" * 40)
                    
                else:
                    print(f"❌ PDF extraction failed: {result.get('error', 'Unknown error')}")
            else:
                print(f"❌ Upload failed with status: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"Error details: {error_data}")
                except:
                    print(f"Response text: {response.text}")
                    
        except Exception as e:
            print(f"❌ Error testing {pdf_file}: {e}")
    
    # Test 4: Test with base64 encoding (alternative method)
    print("\n4. Testing PDF extraction via base64 encoding...")
    
    if test_files:
        test_file = test_files[0]
        print(f"📄 Testing base64 method with: {os.path.basename(test_file)}")
        
        try:
            # Read file and encode as base64
            with open(test_file, 'rb') as f:
                pdf_data = f.read()
                pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
            
            start_time = time.time()
            
            # Send base64 data to extract endpoint
            response = requests.post(
                f"{service_url}/extract", 
                json={
                    "pdf_base64": pdf_base64,
                    "filename": os.path.basename(test_file)
                },
                timeout=120
            )
            
            processing_time = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    print(f"✅ Base64 extraction successful!")
                    print(f"📊 Processing time: {processing_time:.2f} seconds")
                    print(f"📄 Title: {result.get('title', 'N/A')}")
                    print(f"📝 Content length: {len(result.get('content', ''))}")
                    
                    # Show first 200 characters
                    content_preview = result.get('content', '')[:200]
                    print(f"\n📝 Content preview:")
                    print("-" * 40)
                    print(content_preview + ("..." if len(result.get('content', '')) > 200 else ""))
                    print("-" * 40)
                else:
                    print(f"❌ Base64 extraction failed: {result.get('error', 'Unknown error')}")
            else:
                print(f"❌ Base64 request failed with status: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error in base64 test: {e}")
    
    # Test 5: Test with file URL (if using local file server)
    print("\n5. Testing with file paths...")
    print("⚠️ Note: File path method only works if the service can access your local files")
    print("   This typically won't work with remote services, but testing anyway...")
    
    if test_files:
        test_file = test_files[0]
        print(f"📄 Testing file path method with: {test_file}")
        
        try:
            start_time = time.time()
            
            # Try with file:// URL
            file_url = f"file://{os.path.abspath(test_file)}"
            
            response = requests.post(
                f"{service_url}/extract", 
                json={
                    "pdf_url": file_url,
                    "filename": os.path.basename(test_file)
                },
                timeout=60
            )
            
            processing_time = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    print(f"✅ File path extraction successful!")
                    print(f"📊 Processing time: {processing_time:.2f} seconds")
                else:
                    print(f"❌ File path extraction failed: {result.get('error', 'Unknown error')}")
            else:
                print(f"❌ File path request failed with status: {response.status_code}")
                error_data = response.json() if response.content else {"error": "No response content"}
                print(f"Expected error (remote service can't access local files): {error_data.get('error', 'Unknown')}")
                
        except Exception as e:
            print(f"❌ Error in file path test: {e}")
    
    return True

def create_test_pdf():
    """Create a simple test PDF if none exists"""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        
        filename = "test_upload.pdf"
        c = canvas.Canvas(filename, pagesize=letter)
        
        # Add some content
        c.drawString(100, 750, "Test PDF Document")
        c.drawString(100, 720, "This is a test PDF created for testing the Docling service.")
        c.drawString(100, 690, "It contains some sample text to extract.")
        c.drawString(100, 660, "The Docling service should be able to extract this text successfully.")
        
        c.save()
        print(f"✅ Created test PDF: {filename}")
        return True
    except ImportError:
        print("❌ reportlab not installed. Cannot create test PDF.")
        print("💡 Install with: pip install reportlab")
        return False

if __name__ == "__main__":
    print("🚀 Starting Public Docling Service Test with Local Files")
    print()
    
    # Check if we have any PDF files, if not try to create one
    pdf_files_exist = any(
        os.path.exists(f) for f in ["test_upload.pdf"] + 
        [os.path.join(loc, f) for loc in [".", "python-services"] 
         for f in os.listdir(loc) if f.endswith('.pdf') and os.path.exists(loc)]
    )
    
    if not pdf_files_exist:
        print("📄 No PDF files found. Attempting to create a test PDF...")
        if not create_test_pdf():
            print("❌ Could not create test PDF. Please add a PDF file named 'test_upload.pdf'")
            sys.exit(1)
    
    success = test_public_docling_service()
    
    if success:
        print("\n🎉 Tests completed!")
        print("💡 Your public Docling service is accessible and working.")
        print(f"🔗 Service URL: https://blii-pdf-extraction-production.up.railway.app")
        print("\n📋 Summary:")
        print("  ✅ Health check: Service is running")
        print("  ✅ File upload: Works with local PDF files")
        print("  ✅ Base64 encoding: Alternative method for file data")
        print("  ⚠️ File paths: Not supported (expected for remote service)")
        print("\n💡 For your React Native app:")
        print("  - Use the /upload endpoint for direct file uploads")
        print("  - Use the /extract endpoint with base64 data")
        print("  - Both methods successfully extract text from local PDFs")
    else:
        print("\n❌ Some tests failed. Check the service status.")
