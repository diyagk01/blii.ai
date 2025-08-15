# 🚨 CRITICAL OOM FIX - Deployment Checklist

## ✅ **Fixes Applied:**

### **1. Single Worker Configuration**
- ✅ Set `WEB_CONCURRENCY=1` in environment variables
- ✅ Removed `--preload` flag that was causing memory doubling
- ✅ Updated Dockerfile to use single worker: `--workers 1`
- ✅ Set proper timeout: `--timeout 120`

### **2. Memory Optimizations**
- ✅ Lazy loading of Docling converter (loads only on first request)
- ✅ Added garbage collection after PDF processing
- ✅ PyTorch optimizations: `torch.set_grad_enabled(False)`
- ✅ Memory monitoring in health checks

### **3. Render Configuration**
- ✅ Added `/healthz` endpoint for Render health checks
- ✅ Proper `$PORT` binding: `--bind 0.0.0.0:${PORT}`
- ✅ Updated `render.yaml` with correct settings
- ✅ Set `plan: starter` for better resources

## 🚀 **Deploy to Render:**

### **Option 1: Use render.yaml (Recommended)**
1. Go to Render Dashboard: https://dashboard.render.com
2. Click "New +" → "Blueprint"
3. Connect your GitHub repo: `diyagk01/blii-pdf-service`
4. Render will automatically use the `render.yaml` configuration

### **Option 2: Manual Setup**
1. Go to Render Dashboard: https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repo: `diyagk01/blii-pdf-service`
4. **Environment Variables:**
   ```
   WEB_CONCURRENCY=1
   PORT=8080
   ```
5. **Build Command:**
   ```bash
   pip install -r requirements.txt
   ```
6. **Start Command:**
   ```bash
   gunicorn docling_service:app --workers 1 --bind 0.0.0.0:$PORT --timeout 120
   ```
7. **Health Check Path:** `/healthz`

## 📊 **Expected Results:**

### **Memory Usage:**
- **Startup**: ~150-200MB (vs ~400-500MB before)
- **During PDF processing**: ~300-400MB
- **After processing**: ~200-250MB

### **Health Check Response:**
```json
{
  "ok": true
}
```

### **Full Health Check:**
```json
{
  "status": "healthy",
  "service": "docling_extraction_service",
  "docling_available": true,
  "memory": {
    "memory_percent": 45.2,
    "memory_used_mb": 230,
    "memory_available_mb": 280
  }
}
```

## 🧪 **Test After Deployment:**

```bash
# Test the simple health check
curl https://your-service-name.onrender.com/healthz

# Test the full health check
curl https://your-service-name.onrender.com/health

# Test PDF extraction
curl -X POST https://your-service-name.onrender.com/extract \
  -H "Content-Type: application/json" \
  -d '{"pdf_url": "https://arxiv.org/pdf/2408.09869", "filename": "test.pdf"}'
```

## 🚨 **If Still Getting OOM:**

1. **Check Render Logs** for memory usage
2. **Upgrade to Pro Plan** (1GB RAM) if needed
3. **Monitor memory usage** in health check response
4. **Consider splitting** heavy processing to background workers

## ✅ **Success Indicators:**

- ✅ **No "Out of memory" errors** in logs
- ✅ **Service starts** within 60 seconds
- ✅ **Health check responds** within 5 seconds
- ✅ **Memory usage** stays under 400MB
- ✅ **PDF extraction** works successfully

The OOM crash loop should now be resolved! 🎉
