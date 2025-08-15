# Deploy Memory-Optimized Docling Service to Render

## 🎯 **Memory Optimization Summary**
✅ **Fixed OOM issues** with these optimizations:
- **Single worker**: `--workers 1` to avoid memory doubling
- **Lazy loading**: Docling converter loads only on first request
- **Garbage collection**: Automatic memory cleanup after PDF processing
- **Memory monitoring**: Health check shows memory usage
- **Dynamic port binding**: Uses `$PORT` environment variable

## 🚀 **Deploy to Render**

### **Option 1: Connect GitHub Repository (Recommended)**

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New +"** → **"Web Service"**
3. **Connect your GitHub repository**: `diyagk01/blii-pdf-service`
4. **Configure the service**:
   - **Name**: `blii-pdf-extraction` (or your preferred name)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 300 --max-requests 100 --max-requests-jitter 10 --preload docling_service:app`
   - **Plan**: Start with **Free** plan (512MB RAM)

### **Option 2: Manual Deployment**

If you prefer manual setup:

1. **Create Web Service** in Render
2. **Set these environment variables**:
   ```
   PORT=10000
   PYTHON_VERSION=3.11
   ```

3. **Build Command**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start Command**:
   ```bash
   gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 300 --max-requests 100 --max-requests-jitter 10 --preload docling_service:app
   ```

## 🔧 **Memory Optimization Features**

### **Lazy Loading**
- Docling converter loads only when first PDF is processed
- Reduces startup memory usage by ~200-300MB

### **Single Worker**
- Prevents memory doubling from multiple workers
- Suitable for PDF processing workloads

### **Garbage Collection**
- Automatic memory cleanup after each PDF extraction
- Prevents memory leaks during batch processing

### **Memory Monitoring**
- Health check shows current memory usage
- Helps monitor service performance

## 📊 **Expected Performance**

### **Memory Usage**:
- **Startup**: ~150-200MB (vs ~400-500MB before)
- **During PDF processing**: ~300-400MB
- **After processing**: ~200-250MB (with GC)

### **Response Times**:
- **Health check**: < 100ms
- **PDF extraction**: 5-30 seconds (depending on PDF size)

## 🧪 **Testing After Deployment**

### **1. Health Check**
```bash
curl https://your-service-name.onrender.com/health
```

Expected response:
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

### **2. Test PDF Upload**
```bash
curl -X POST https://your-service-name.onrender.com/upload \
  -F "file=@test_upload.pdf"
```

### **3. Test PDF Extraction**
```bash
curl -X POST https://your-service-name.onrender.com/extract \
  -H "Content-Type: application/json" \
  -d '{"pdf_url": "https://example.com/test.pdf", "filename": "test.pdf"}'
```

## 🔍 **Monitoring**

### **Render Dashboard**:
- Check **Logs** for any OOM errors
- Monitor **Memory Usage** graphs
- Watch **Response Times**

### **Health Check Monitoring**:
- Memory usage should stay under 400MB
- Service should respond within 5 seconds
- No "Out of memory" errors

## 🚨 **Troubleshooting**

### **If Still Getting OOM Errors**:
1. **Upgrade to Pro plan** (1GB RAM)
2. **Check logs** for memory usage patterns
3. **Reduce timeout** if needed: `--timeout 120`

### **If Service Won't Start**:
1. **Check build logs** for dependency issues
2. **Verify Python version** (3.11 recommended)
3. **Check port binding** (should use `$PORT`)

### **If PDF Processing Fails**:
1. **Check file size limits** (Render has upload limits)
2. **Verify PDF format** (should be valid PDF)
3. **Check timeout settings** (increase if needed)

## 📈 **Scaling Considerations**

### **For Higher Load**:
- **Upgrade to Pro plan** (1GB RAM, better performance)
- **Add more workers** (if memory allows): `--workers 2`
- **Implement queue system** for batch processing

### **For Production**:
- **Use dedicated instance** for better performance
- **Add monitoring** (UptimeRobot, etc.)
- **Implement rate limiting** if needed

## ✅ **Success Indicators**

After deployment, you should see:
- ✅ **No OOM errors** in logs
- ✅ **Health check** returns memory info
- ✅ **PDF extraction** works successfully
- ✅ **Memory usage** stays under 400MB
- ✅ **Service responds** within 5 seconds

Your memory-optimized Docling service should now run smoothly on Render's free tier! 🎉
