# Deploy Docling Service to Railway

## Issue Identified
Your public service at `https://blii-pdf-extraction-production.up.railway.app` is currently running the **Simple PDF Extraction Service** instead of the **Docling PDF Extraction Service**.

## Fixed Files
✅ **Dockerfile** - Updated to use `docling_service.py` instead of `simple_pdf_service.py`
✅ **requirements.txt** - Added `docling==1.8.0` dependency

## Steps to Redeploy

### Option 1: Railway Dashboard (Recommended)
1. Go to your Railway dashboard
2. Navigate to your `blii-pdf-extraction-production` service
3. Go to the **Deployments** tab
4. Click **Deploy** to trigger a new deployment with the updated files

### Option 2: Git Push (if connected to GitHub)
1. Commit the changes:
   ```bash
   git add python-services/Dockerfile python-services/requirements.txt
   git commit -m "Fix deployment: Use Docling service instead of simple PDF service"
   git push
   ```

### Option 3: Railway CLI
If you have Railway CLI installed:
```bash
cd python-services
railway up
```

## Verification Steps

After redeployment, run this test:
```bash
python3 test_actual_docling_service.py
```

The test should now show:
- ✅ Service name: "docling_extraction_service" 
- ✅ `docling_available: true`
- ✅ Successful PDF extraction using Docling

## Expected Service Response

After correct deployment, the health endpoint should return:
```json
{
  "status": "healthy",
  "service": "docling_extraction_service", 
  "docling_available": true
}
```

## Changes Made

### Dockerfile Changes:
```diff
- COPY simple_pdf_service.py .
+ COPY docling_service.py .

- CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "120", "simple_pdf_service:app"]
+ CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "120", "docling_service:app"]
```

### requirements.txt Changes:
```diff
  PyMuPDF==1.23.8
  Pillow==10.0.1
+
+ # Docling for advanced PDF processing
+ docling==1.8.0
```

## Troubleshooting

If deployment fails:

1. **Check Railway logs** for build errors
2. **Memory issues**: Docling requires more memory than simple PDF service
3. **Build timeout**: First build with Docling takes longer (5-10 minutes)

### If Docling fails to install:
Railway might need more resources. You can:
1. Upgrade your Railway plan temporarily for the build
2. Or use a different deployment method

## Test Local Docling Service First (Optional)

Before deploying, you can test locally:
```bash
cd python-services
python3 docling_service.py
# In another terminal:
python3 ../test_actual_docling_service.py
```

Change the service_url in the test script to `http://localhost:8080` for local testing.

## Next Steps

1. **Redeploy** using one of the methods above
2. **Wait** for deployment to complete (5-10 minutes for first Docling build)  
3. **Test** using `python3 test_actual_docling_service.py`
4. **Verify** your React Native app now uses the proper Docling service

The deployment should fix the issue and your public service will properly use Docling for high-quality PDF extraction!
