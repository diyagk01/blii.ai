# How to Force Restart Railway Service

## Step-by-Step Guide to Activate Docling Deployment

### 1. Access Railway Dashboard
1. Go to **https://railway.app**
2. Log in with your account
3. Navigate to your **blii-pdf-extraction** project

### 2. Locate Your Service
1. Click on your **blii-pdf-extraction** project
2. You should see your service (likely named **blii-pdf-extraction**)
3. Click on the service to open it

### 3. Check Current Deployment
1. Look at the **Deployments** tab
2. You should see recent deployments including our latest one with Docling
3. Note which deployment is marked as "Active" or "Live"

### 4. Force Restart the Service

#### Option A: Restart Current Deployment
1. In the service dashboard, look for a **"Restart"** button (usually in the top right)
2. Click **"Restart"** to restart the current active deployment
3. Wait for the restart to complete (usually 1-2 minutes)

#### Option B: Promote New Deployment (Preferred)
1. Go to the **Deployments** tab
2. Find the most recent deployment (should show Docling installation in logs)
3. Look for a **"Promote"** or **"Deploy"** button next to it
4. Click to make this deployment active

#### Option C: Force New Deployment
1. Go to the **Settings** tab of your service
2. Look for **"Redeploy"** or **"Trigger Deploy"** option
3. Click to force a complete new deployment

### 5. Monitor the Restart/Deployment
1. Watch the **Logs** section for the restart/deployment process
2. Look for messages like:
   - "✅ Docling successfully imported"
   - Service starting on port 8080
   - Health check responses

### 6. Verify the New Service
After restart/deployment completes:
1. Wait 2-3 minutes for full propagation
2. Test the service endpoint: `https://blii-pdf-extraction-production.up.railway.app/health`
3. You should now see:
   ```json
   {
     "status": "healthy",
     "service": "docling_extraction_service",
     "docling_available": true
   }
   ```

### 7. Troubleshooting

#### If still showing old service:
1. Check if there are **multiple services** in the project
2. Ensure you're restarting the correct service
3. Look for any **build errors** in the deployment logs
4. Verify the **Dockerfile** is using `docling_service.py`

#### If deployment fails:
1. Check the **Build Logs** for errors
2. Look for memory/timeout issues with Docling installation
3. May need to upgrade Railway plan temporarily for more resources

### 8. Alternative: Environment Variables
If restart doesn't work, you can also:
1. Go to **Variables** tab
2. Add a dummy environment variable (like `RESTART=1`)
3. This will trigger a new deployment automatically

## Expected Result
After successful restart, your public Docling service should be active and you can test it with local files using the test scripts we created.

## Quick Verification Command
Run this after restart to verify:
```bash
curl -s https://blii-pdf-extraction-production.up.railway.app/health | python3 -m json.tool
```

Expected output:
```json
{
    "status": "healthy",
    "service": "docling_extraction_service", 
    "docling_available": true
}
```


