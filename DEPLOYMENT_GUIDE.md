# Docling Service Deployment Guide

## Current Issue
The Docling service at https://blii-ai.onrender.com is failing due to missing ONNX model files. The error is:
```
Missing ONNX file: /home/appuser/.cache/huggingface/hub/models--ds4sd--docling-models/snapshots/fc0f2d45e2218ea24bce5045f58a389aed16dc23/model_artifacts/layout/beehive_v0.0.5/model.pt
```

## Solution
I've updated the service to use fallback PDF extraction methods (PyMuPDF and PyPDF2) when Docling fails.

## Files Updated
1. `docling_service.py` - Added fallback extraction methods
2. `python-services/Dockerfile` - Updated to handle HuggingFace cache
3. `python-services/requirements.txt` - Added necessary dependencies
4. `python-services/start.sh` - Updated startup configuration

## Deployment Steps

### Option 1: Automatic Deployment (Recommended)
If your service is connected to a Git repository:

1. **Commit and push the changes:**
   ```bash
   git add .
   git commit -m "Fix Docling service with fallback PDF extraction"
   git push origin main
   ```

2. **Redeploy on Render:**
   - Go to your Render dashboard
   - Find the `blii-docling-service`
   - Click "Manual Deploy" → "Deploy latest commit"

### Option 2: Manual Deployment
If you need to manually update the service:

1. **Update the files in your Render service:**
   - Go to your Render dashboard
   - Find the `blii-docling-service`
   - Go to "Settings" → "Build & Deploy"
   - Update the source code with the new files

2. **Redeploy:**
   - Click "Manual Deploy" → "Deploy latest commit"

## Testing the Deployment

After deployment, test the service:

```bash
# Test health endpoint
curl https://blii-ai.onrender.com/health

# Test extraction endpoint
curl -X POST https://blii-ai.onrender.com/extract \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "filename": "test.pdf"
  }'
```

## Expected Behavior

After the update:
- ✅ Health endpoint should return `docling_available: false`
- ✅ Extraction should work using PyMuPDF or PyPDF2 fallback
- ✅ No more ONNX file errors
- ✅ PDF content extraction should succeed

## Fallback Methods

The service now uses these fallback methods in order:
1. **PyMuPDF** - Better text extraction, handles complex layouts
2. **PyPDF2** - Basic text extraction, works with most PDFs

## Monitoring

Check the service logs in Render to see:
- Which extraction method is being used
- Any errors or warnings
- Memory usage and performance

## Troubleshooting

If the service still fails after deployment:

1. **Check Render logs** for any build or runtime errors
2. **Verify the deployment** completed successfully
3. **Test locally** first using the test script:
   ```bash
   python3 test_docling_deployment.py
   ```

## Next Steps

Once the fallback methods are working, you can:
1. **Fix Docling model issues** by downloading the required ONNX files
2. **Re-enable Docling** for better extraction quality
3. **Optimize performance** based on usage patterns

## Contact

If you need help with the deployment, check the Render documentation or contact support.
