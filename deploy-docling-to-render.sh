#!/bin/bash

echo "🚀 Deploying Docling Service to Render..."
echo ""

echo "📋 Prerequisites:"
echo "1. Make sure you have a Render account at render.com"
echo "2. Your GitHub repository is connected to Render"
echo "3. You have the necessary permissions"
echo ""

echo "🔗 Your GitHub repository: https://github.com/diyagk01/blii.ai.git"
echo "📁 Root directory for deployment: python-services"
echo ""

echo "📝 Manual Deployment Steps:"
echo "1. Go to https://render.com"
echo "2. Click 'New +' → 'Web Service'"
echo "3. Connect repository: diyagk01/blii.ai.git"
echo "4. Configure settings:"
echo "   - Name: blii-docling-service"
echo "   - Environment: Docker"
echo "   - Root Directory: python-services"
echo "   - Build Command: pip install -r requirements.txt"
echo "   - Start Command: python3 docling_service.py"
echo "5. Add environment variables:"
echo "   - PORT: 8080"
echo "   - WEB_CONCURRENCY: 1"
echo "   - PYTHONUNBUFFERED: 1"
echo "6. Click 'Create Web Service'"
echo ""

echo "⏱️  Deployment will take 3-5 minutes..."
echo ""

echo "🧪 After deployment, test with:"
echo "curl https://blii-docling-service.onrender.com/health"
echo ""

echo "📱 Update your app with the new URL:"
echo "File: services/content-extractor.ts"
echo "Line: Change doclingServiceUrl to:"
echo "const doclingServiceUrl = 'https://blii-docling-service.onrender.com';"
echo ""

echo "✅ Done! Your Docling service will be available for TestFlight users."





