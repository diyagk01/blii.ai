# Deploy Docling Service to Heroku (Reliable Alternative)

## Why Heroku for Backup:
- ✅ Better subdirectory handling than Render
- ✅ Reliable Docker deployments
- ✅ Simple CLI deployment
- ✅ Good ML dependency support

## Quick Heroku Deployment:

### 1. Install Heroku CLI (if not installed):
```bash
# macOS
brew install heroku/brew/heroku

# Or download from: https://devcenter.heroku.com/articles/heroku-cli
```

### 2. Deploy from python-services directory:
```bash
cd python-services

# Login to Heroku
heroku login

# Create app
heroku create blii-docling-heroku

# Deploy using Docker
heroku container:push web

# Release the container
heroku container:release web

# Open the app
heroku open
```

### 3. Your Heroku URL will be:
```
https://blii-docling-heroku.herokuapp.com
```

### 4. Update your app to use Heroku URL:
Change in `services/content-extractor.ts` and `services/enhanced-content-extractor.ts`:
```typescript
const doclingServiceUrl = 'https://blii-docling-heroku.herokuapp.com';
```

## Test Heroku Deployment:
```bash
# Test health endpoint
curl https://blii-docling-heroku.herokuapp.com/health

# Run full test
python3 ../test_actual_docling_service.py
# (Update service_url in test script first)
```

## Advantages of Heroku:
- ✅ No directory structure issues
- ✅ Reliable Docker support  
- ✅ Good for ML dependencies
- ✅ Easy rollback if issues
- ✅ Established platform

## Commands Summary:
```bash
# Quick deploy (from python-services folder):
heroku create blii-docling-heroku
heroku container:push web
heroku container:release web

# Check status:
heroku logs --tail
heroku ps

# Scale if needed:
heroku ps:scale web=1
```

This should be more reliable than Render for your Docling service!
