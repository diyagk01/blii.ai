# Fix Render Deployment Issue

## Problem
Render deployment failed with: "Root directory 'python-services' does not exist"

## Root Cause
Render was configured to look for `python-services` as the root directory, but it needs to be in the repository root.

## Solutions (Choose ONE)

### ✅ Solution 1: Update Render Settings (QUICKEST)
In your Render dashboard:
1. Go to **Settings** for your `blii-docling-service`
2. Under **Build & Deploy**:
   - **Root Directory**: Leave BLANK (empty)
   - **Build Command**: `echo "Using Docker build"`
   - **Dockerfile Path**: `python-services/Dockerfile`
3. Click **Save Changes**
4. Click **Manual Deploy** to redeploy

### ✅ Solution 2: Use Root-Level Files (RECOMMENDED)
I've created:
- `Dockerfile` (in root) - Points to python-services files
- `render.yaml` (in root) - Updated configuration

**Steps:**
1. Commit these new files:
   ```bash
   git add Dockerfile render.yaml
   git commit -m "Add root-level Dockerfile for Render deployment"
   git push
   ```

2. In Render dashboard:
   - **Root Directory**: Leave BLANK
   - **Dockerfile Path**: `./Dockerfile`
   - Redeploy

### ✅ Solution 3: Alternative Service URLs
If Render continues to have issues, use these alternatives:

**Heroku (Reliable):**
```bash
cd python-services
heroku create blii-docling-heroku
heroku container:push web
heroku container:release web
```

**Fly.io (Fast):**
```bash
cd python-services  
fly launch --dockerfile
fly deploy
```

## Quick Test After Fix
```bash
# Test once deployed
curl https://blii-docling-service.onrender.com/health

# Should return:
{
  "status": "healthy",
  "service": "docling_extraction_service",
  "docling_available": true
}
```

## Backup Plan
If Render keeps failing, I've prepared configs for:
- ✅ Heroku (`heroku.yml`)
- ✅ Fly.io (`fly.toml`)  
- ✅ DigitalOcean (dashboard deploy)
- ✅ Google Cloud (`app.yaml`)

All are ready to deploy with the same Docling service!
