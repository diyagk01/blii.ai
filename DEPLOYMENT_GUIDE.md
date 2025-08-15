# Blii App Deployment Guide 🚀

## Overview
This guide will help you deploy both the PDF extraction server and the React Native app to production for TestFlight distribution.

## Prerequisites
- EAS CLI installed (current version: 16.16.0)
- Apple Developer account
- Expo account
- Git repository access

## Step 1: Deploy PDF Extraction Server

### Option A: Railway (Recommended - Easy)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Navigate to Python service directory
cd python-services

# Initialize Railway project
railway new

# Deploy
railway up

# Get your service URL (something like: https://your-app.railway.app)
```

### Option B: Render (Alternative)
```bash
# 1. Push your code to GitHub
git add -A
git commit -m "Add PDF extraction service"
git push origin main

# 2. Go to render.com
# 3. Connect GitHub repository
# 4. Select python-services folder
# 5. Use the render.yaml configuration
# 6. Deploy automatically
```

### Option C: Docker (Manual)
```bash
cd python-services
docker build -t blii-pdf-extraction .
docker run -p 8080:8080 blii-pdf-extraction

# Then deploy to your preferred cloud provider
```

## Step 2: Update Service URL

After deploying the Python service, update the production URL:

1. Open `services/enhanced-content-extractor.ts`
2. Replace `'https://blii-pdf-extraction.railway.app'` with your actual service URL
3. Example:
```typescript
private doclingServiceUrl = process.env.NODE_ENV === 'production' 
  ? 'https://your-actual-service-url.railway.app' 
  : 'http://localhost:8080';
```

## Step 3: Prepare iOS App for TestFlight

### Update App Configuration
```bash
# Make sure you're in the root directory
cd /Users/diyagirishkumar/Desktop/New\ Folder\ With\ Items\ 2/blii

# Install dependencies
npm install

# Update EAS CLI (if needed with sudo)
sudo npm install -g eas-cli@latest
```

### Configure EAS Build
```bash
# Configure EAS
eas build:configure

# Login to Expo
eas login
```

## Step 4: Build for iOS TestFlight

### Production Build
```bash
# Build for iOS production
eas build --platform ios --profile production

# This will:
# - Create an optimized build
# - Upload to EAS servers
# - Generate an IPA file ready for TestFlight
```

### Monitor Build Progress
```bash
# Check build status
eas build:list

# View specific build details
eas build:view [build-id]
```

## Step 5: Submit to App Store Connect

### Automatic Submission (Recommended)
```bash
# Submit directly to TestFlight
eas submit --platform ios --latest

# This will:
# - Upload the IPA to App Store Connect
# - Create a TestFlight build
# - Generate TestFlight link
```

### Manual Submission (Alternative)
1. Download IPA from EAS dashboard
2. Use Xcode or Transporter app
3. Upload to App Store Connect
4. Process in TestFlight

## Step 6: TestFlight Configuration

### After Successful Upload:
1. Go to App Store Connect → TestFlight
2. Add internal testers
3. Add external testers (if needed)
4. Configure testing information
5. Share TestFlight link

## Verification Steps

### 1. Test PDF Service
```bash
# Test your deployed service
curl https://your-service-url/health

# Should return:
{
  "status": "healthy",
  "service": "docling_extraction_service",
  "docling_available": true
}
```

### 2. Test App Functionality
- Install from TestFlight
- Upload a PDF
- Ask questions about the PDF
- Verify extraction works

## Environment Configuration

### Production Environment Variables
The app automatically detects production environment and uses the correct service URL.

### Development vs Production
- **Development**: Uses `http://localhost:8080`
- **Production**: Uses your deployed service URL

## Troubleshooting

### PDF Service Issues
- Check service health endpoint
- Verify service logs
- Test with simple PDF first

### App Build Issues
- Clear Expo cache: `expo r -c`
- Update dependencies: `npm update`
- Check EAS build logs

### TestFlight Issues
- Verify bundle identifier matches
- Check Apple Developer account status
- Ensure app complies with App Store guidelines

## Quick Deployment Commands

### Complete Deployment (Copy & Paste)
```bash
# 1. Deploy PDF Service (Railway)
cd python-services
npm install -g @railway/cli
railway login
railway new
railway up

# 2. Update service URL in app (manual step)
# Edit services/enhanced-content-extractor.ts

# 3. Build and deploy app
cd ..
eas build --platform ios --profile production
eas submit --platform ios --latest
```

## Service URLs to Update

After deployment, update these URLs in your app:

1. **services/enhanced-content-extractor.ts**
   - Replace Railway URL with your actual deployment URL

## Expected Results

### Successful Deployment Should Provide:
1. ✅ Live PDF extraction service
2. ✅ TestFlight build link
3. ✅ Working PDF Q&A in production app
4. ✅ Automatic fallback if service is down

## Support

### If Issues Arise:
1. Check build logs in EAS dashboard
2. Test service endpoints manually
3. Verify all environment configurations
4. Test fallback functionality

---

## Next Steps After Deployment

1. **Share TestFlight Link** with testers
2. **Monitor Service Health** via health check endpoint
3. **Test PDF Extraction** with various document types
4. **Scale Service** if needed based on usage
5. **Update App Store Listing** for full release

Your app will now have:
- ✅ Live PDF extraction service
- ✅ TestFlight distribution
- ✅ Automatic fallback capabilities
- ✅ Production-ready deployment

🎉 **Your Blii app is ready for TestFlight testing!**
