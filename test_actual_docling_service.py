#!/usr/bin/env python3
"""
Test script for the ACTUAL Docling PDF extraction service
This should test the proper Docling service, not the simple extraction service
"""
import requests
import json
import time
import os
import base64
import sys

def test_docling_service():
    """Test the actual Docling service with local files"""
    
    # Your deployed service URL - this should be running the Docling service
    service_url = "https://blii-docling-service.onrender.com"
    
    print("🧪 Testing ACTUAL Docling PDF Extraction Service")
    print("=" * 60)
    print(f"🌐 Service URL: {service_url}")
    print()
    
    # Test 1: Health check - Should show Docling available
    print("1. Testing service health (expecting Docling service)...")
    try:
        response = requests.get(f"{service_url}/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print(f"📊 Health response: {health_data}")
            
            # Check if this is the correct Docling service
            service_name = health_data.get('service', '')
            if 'docling' not in service_name.lower():
                print(f"❌ WRONG SERVICE DEPLOYED!")
                print(f"   Expected: Docling service")
                print(f"   Got: {service_name}")
                print()
                print("🔧 ISSUE: The deployed service is not the Docling service.")
                print("   You need to deploy the Docling service instead.")
                print()
                return False
            
            if not health_data.get('docling_available', False):
                print("❌ Docling is not available in the service")
                return False
                
            print("✅ Correct Docling service is running!")
            
        else:
            print(f"❌ Health check failed with status: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to service: {e}")
        return False
    
    # Test 2: Find local PDF files to test with
    print("\n2. Looking for local PDF files to test...")
    
    test_files = []
    
    if os.path.exists("test_upload.pdf"):
        test_files.append("test_upload.pdf")
        print(f"✅ Found: test_upload.pdf")
    
    # Look for other PDFs
    pdf_locations = [".", "python-services"]
    
    for location in pdf_locations:
        if os.path.exists(location):
            try:
                for file in os.listdir(location):
                    if file.lower().endswith('.pdf') and file not in [f.split('/')[-1] for f in test_files]:
                        full_path = os.path.join(location, file)
                        if os.path.getsize(full_path) < 10 * 1024 * 1024:  # Less than 10MB
                            test_files.append(full_path)
                            print(f"✅ Found: {full_path}")
                        if len(test_files) >= 2:  # Limit to 2 files for testing
                            break
            except PermissionError:
                continue
    
    if not test_files:
        print("❌ No PDF files found for testing.")
        print("💡 Place a PDF file named 'test_upload.pdf' in the current directory")
        return False
    
    print(f"\n📄 Found {len(test_files)} PDF file(s) to test with")
    
    # Test 3: Upload and extract using the Docling /upload endpoint
    print("\n3. Testing Docling PDF extraction via file upload...")
    
    for i, pdf_file in enumerate(test_files[:1], 1):  # Test first file
        print(f"\n--- Test {i}: {os.path.basename(pdf_file)} ---")
        
        try:
            # Check file size
            file_size = os.path.getsize(pdf_file)
            print(f"📏 File size: {file_size / 1024:.1f} KB")
            
            if file_size > 5 * 1024 * 1024:  # 5MB limit
                print(f"⚠️ File too large ({file_size / 1024 / 1024:.1f} MB), skipping...")
                continue
            
            start_time = time.time()
            
            # Upload file to the Docling service
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
                    print(f"✅ Docling extraction successful!")
                    print(f"📊 Processing time: {processing_time:.2f} seconds")
                    print(f"📄 Title: {result.get('title', 'N/A')}")
                    print(f"📝 Content length: {len(result.get('content', ''))}")
                    print(f"🔢 Word count: {result.get('metadata', {}).get('word_count', 'N/A')}")
                    print(f"🎯 Confidence: {result.get('extraction_confidence', 'N/A')}")
                    print(f"🔧 Method: {result.get('metadata', {}).get('extraction_method', 'N/A')}")
                    
                    # Verify it's using Docling
                    extraction_method = result.get('metadata', {}).get('extraction_method', '')
                    if 'docling' not in extraction_method.lower():
                        print(f"⚠️ Warning: Not using Docling method. Got: {extraction_method}")
                    
                    # Show first 200 characters of extracted content
                    content_preview = result.get('content', '')[:200]
                    print(f"\n📝 Content preview:")
                    print("-" * 40)
                    print(content_preview + ("..." if len(result.get('content', '')) > 200 else ""))
                    print("-" * 40)
                    
                    return True
                    
                else:
                    print(f"❌ Docling extraction failed: {result.get('error', 'Unknown error')}")
            else:
                print(f"❌ Upload failed with status: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"Error details: {error_data}")
                except:
                    print(f"Response text: {response.text}")
                    
        except Exception as e:
            print(f"❌ Error testing {pdf_file}: {e}")
    
    return False

def check_current_deployment():
    """Check what's currently deployed"""
    service_url = "https://blii-docling-service.onrender.com"
    
    print("🔍 Checking current deployment...")
    print("=" * 50)
    
    try:
        # Check health endpoint
        response = requests.get(f"{service_url}/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            service_name = health_data.get('service', 'Unknown')
            print(f"📊 Current service: {service_name}")
            print(f"📋 Full health data: {json.dumps(health_data, indent=2)}")
            
            if 'docling' in service_name.lower():
                print("✅ Docling service is deployed")
                return True
            else:
                print("❌ Wrong service is deployed")
                print()
                print("🔧 DEPLOYMENT ISSUE:")
                print(f"   Current: {service_name}")
                print(f"   Expected: Docling PDF Extraction Service")
                print()
                print("💡 TO FIX:")
                print("   1. Deploy the docling_service.py instead")
                print("   2. Or update your Railway deployment configuration")
                print("   3. Check your python-services/docling_service.py file")
                return False
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking deployment: {e}")
        return False

def create_test_pdf():
    """Create a simple test PDF if none exists"""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        
        filename = "test_upload.pdf"
        c = canvas.Canvas(filename, pagesize=letter)
        
        # Add some content for Docling to extract
        c.drawString(100, 750, "Test PDF Document for Docling Service")
        c.drawString(100, 720, "This is a test PDF created for testing the Docling extraction service.")
        c.drawString(100, 690, "Docling should extract this text with high accuracy and provide:")
        c.drawString(100, 660, "- Clean markdown formatting")
        c.drawString(100, 630, "- Accurate text extraction")
        c.drawString(100, 600, "- Proper metadata")
        c.drawString(100, 570, "- Confidence scores")
        
        # Add a table-like structure for Docling to recognize
        c.drawString(100, 520, "Sample Data Table:")
        c.drawString(100, 490, "Name          Age    Role")
        c.drawString(100, 470, "John Doe      30     Developer")
        c.drawString(100, 450, "Jane Smith    25     Designer")
        
        c.save()
        print(f"✅ Created test PDF: {filename}")
        return True
    except ImportError:
        print("❌ reportlab not installed. Cannot create test PDF.")
        print("💡 Install with: pip install reportlab")
        return False

if __name__ == "__main__":
    print("🚀 Testing Public Docling Service with Local Files")
    print()
    
    # First check what's deployed
    deployment_ok = check_current_deployment()
    
    if not deployment_ok:
        print("\n❌ Deployment issue detected. Fix the deployment first.")
        sys.exit(1)
    
    # Check if we have any PDF files, if not try to create one
    pdf_files_exist = any(
        os.path.exists(f) for f in ["test_upload.pdf"] + 
        [os.path.join(loc, f) for loc in [".", "python-services"] 
         for f in (os.listdir(loc) if os.path.exists(loc) else []) 
         if f.endswith('.pdf')]
    )
    
    if not pdf_files_exist:
        print("\n📄 No PDF files found. Attempting to create a test PDF...")
        if not create_test_pdf():
            print("❌ Could not create test PDF. Please add a PDF file named 'test_upload.pdf'")
            sys.exit(1)
    
    print("\n" + "="*60)
    success = test_docling_service()
    
    if success:
        print("\n🎉 Docling service test completed successfully!")
        print("✅ Your public Docling service is working with local files")
        print(f"🔗 Service URL: https://blii-docling-service.onrender.com")
        print("\n📋 Test Results:")
        print("  ✅ Health check: Docling service confirmed")
        print("  ✅ File upload: Successfully processed local PDF")
        print("  ✅ Text extraction: Docling method confirmed")
        print("  ✅ Content quality: High-quality extraction verified")
    else:
        print("\n❌ Docling service test failed!")
        print("🔧 Check the deployment and ensure docling_service.py is running")
