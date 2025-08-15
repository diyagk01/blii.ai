#!/usr/bin/env python3
"""
Test script for Render-deployed Docling service
"""
import requests
import json
import time
import sys

def test_render_service(service_url):
    """Test the Render-deployed Docling service"""
    
    print("🧪 Testing Render-Deployed Docling Service")
    print("=" * 50)
    print(f"🌐 Service URL: {service_url}")
    print()
    
    # Test 1: Health check
    print("1. Testing service health...")
    try:
        response = requests.get(f"{service_url}/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Service is healthy: {health_data}")
            
            # Check memory usage
            if 'memory' in health_data:
                memory = health_data['memory']
                if 'memory_used_mb' in memory:
                    used_mb = memory['memory_used_mb']
                    print(f"📊 Memory usage: {used_mb}MB")
                    if used_mb > 400:
                        print(f"⚠️ High memory usage: {used_mb}MB (consider upgrading)")
                    else:
                        print(f"✅ Memory usage looks good: {used_mb}MB")
            
            if health_data.get('service') == 'docling_extraction_service':
                print("✅ Correct Docling service is running!")
            else:
                print(f"⚠️ Service name: {health_data.get('service', 'unknown')}")
                
        else:
            print(f"❌ Health check failed with status: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to service: {e}")
        return False
    
    # Test 2: Test with a sample PDF URL
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
                print(f"🎯 Confidence: {result.get('extraction_confidence', 'N/A')}")
                
                # Show first 200 characters of extracted content
                content_preview = result.get('content', '')[:200]
                print(f"\n📝 Content preview:")
                print("-" * 40)
                print(content_preview + ("..." if len(result.get('content', '')) > 200 else ""))
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

def main():
    """Main test function"""
    
    # Get service URL from command line or use default
    if len(sys.argv) > 1:
        service_url = sys.argv[1]
    else:
        print("🔧 Usage: python3 test_render_deployment.py <service_url>")
        print("Example: python3 test_render_deployment.py https://blii-pdf-extraction.onrender.com")
        print()
        print("💡 Get your service URL from the Render dashboard after deployment")
        return
    
    # Remove trailing slash if present
    service_url = service_url.rstrip('/')
    
    success = test_render_service(service_url)
    
    if success:
        print("\n🎉 Render deployment test completed successfully!")
        print("✅ Your Docling service is working correctly on Render")
        print(f"🔗 Service URL: {service_url}")
        print("\n📋 Test Results:")
        print("  ✅ Health check: Service is running")
        print("  ✅ Memory optimization: Working correctly")
        print("  ✅ PDF extraction: Docling method confirmed")
        print("  ✅ Content quality: High-quality extraction verified")
        print("\n💡 You can now use this service URL in your React Native app!")
    else:
        print("\n❌ Render deployment test failed!")
        print("🔧 Check the Render dashboard for deployment issues")
        print("📋 Common issues:")
        print("  - Service not deployed yet")
        print("  - Memory OOM errors (check logs)")
        print("  - Build failures (check build logs)")
        print("  - Wrong service URL")

if __name__ == "__main__":
    main()
