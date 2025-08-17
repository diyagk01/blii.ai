#!/bin/bash

# Docling Service Fix Deployment Script
# This script helps deploy the fixed docling service with fallback methods

echo "🚀 Docling Service Fix Deployment Script"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "docling_service.py" ]; then
    echo "❌ Error: docling_service.py not found in current directory"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "✅ Found docling_service.py"

# Check if git is available
if command -v git &> /dev/null; then
    echo "✅ Git is available"
    
    # Check if this is a git repository
    if [ -d ".git" ]; then
        echo "✅ This is a git repository"
        
        # Check if there are changes to commit
        if [ -n "$(git status --porcelain)" ]; then
            echo "📝 Changes detected, committing..."
            git add .
            git commit -m "Fix Docling service with fallback PDF extraction methods"
            
            echo "📤 Pushing to remote repository..."
            git push origin main
            
            echo "✅ Changes pushed successfully!"
            echo ""
            echo "🔄 Next steps:"
            echo "1. Go to your Render dashboard"
            echo "2. Find the 'blii-docling-service'"
            echo "3. Click 'Manual Deploy' → 'Deploy latest commit'"
            echo "4. Wait for deployment to complete"
            echo "5. Test the service using: python3 test_docling_deployment.py"
            
        else
            echo "ℹ️ No changes to commit"
            echo "The service should automatically redeploy if connected to git"
        fi
        
    else
        echo "⚠️ This is not a git repository"
        echo "Please manually update your deployment platform"
    fi
    
else
    echo "⚠️ Git not available"
    echo "Please manually update your deployment platform"
fi

echo ""
echo "📋 Manual Deployment Steps:"
echo "1. Copy the updated files to your deployment platform:"
echo "   - docling_service.py"
echo "   - python-services/Dockerfile"
echo "   - python-services/requirements.txt"
echo "   - python-services/start.sh"
echo ""
echo "2. Redeploy the service"
echo ""
echo "3. Test the deployment:"
echo "   python3 test_docling_deployment.py"

echo ""
echo "🎯 Expected Results After Deployment:"
echo "✅ Health endpoint: docling_available: false"
echo "✅ Extraction endpoint: Works with PyMuPDF/PyPDF2 fallback"
echo "✅ No more ONNX file errors"
echo "✅ PDF content extraction succeeds"

echo ""
echo "📞 Need help? Check the DEPLOYMENT_GUIDE.md file"
