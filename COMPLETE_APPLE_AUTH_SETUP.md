# Complete Apple Sign In Setup with Supabase

## Current Status ✅
Your Apple Sign In is already implemented! Here's what you have:
- ✅ Apple Authentication Service in `supabase-auth.ts`
- ✅ UI integration in login/signup screens  
- ✅ Required dependencies installed
- ✅ App configuration in `app.json`

## Required Configurations

### 1. Apple Developer Console Setup

1. **Go to Apple Developer Portal**
   - Visit [developer.apple.com](https://developer.apple.com)
   - Sign in with your Apple Developer account

2. **Configure App ID**
   - Go to **Certificates, Identifiers & Profiles**
   - Select **Identifiers** → **App IDs**
   - Find your app ID: `com.diyagirishkumar.blii`
   - Edit and enable **Sign In with Apple** capability
   - Save changes

3. **Create Service ID (Important for Supabase)**
   - In **Identifiers**, click **+** to create new
   - Select **Services IDs**
   - Enter:
     - **Description**: "Blii Apple Sign In Service"
     - **Identifier**: `com.diyagirishkumar.blii.service`
   - Enable **Sign In with Apple**
   - Click **Configure** next to Sign In with Apple
   - Add your domain: `cckclzuomxsxyhmceqal.supabase.co`
   - Add redirect URL: `https://cckclzuomxsxyhmceqal.supabase.co/auth/v1/callback`
   - Save and continue

### 2. Supabase Dashboard Configuration

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard/project/cckclzuomxsxyhmceqal

2. **Configure Apple OAuth Provider**
   - Go to **Authentication** → **Providers**
   - Find **Apple** and click **Configure**
   - Enable Apple provider
   - Enter the following EXACT values:

   **Client IDs:** (comma-separated list)
   ```
   com.diyagirishkumar.blii,com.diyagirishkumar.blii.service
   ```
   
   **Secret Key (for OAuth):** (You'll get this from step 3 below)

3. **Create Apple Key (Required)**
   - In Apple Developer Console, go to **Keys**
   - Click **+** to create new key
   - Name it "Blii Apple Sign In Key"
   - Enable **Sign In with Apple**
   - Configure it:
     - **Primary App ID**: Select `com.diyagirishkumar.blii`
   - Download the `.p8` file (keep it secure!)
   - Note the **Key ID** (10-character string)
   - Note your **Team ID** (found in membership tab)

4. **Generate JWT Secret Key for Supabase (CORRECT METHOD)**
   
   Supabase requires a JWT (JSON Web Token) format for the Apple secret key. Use this Python script to generate it properly:
   
   **Step 1: Install PyJWT**
   ```bash
   pip install pyjwt
   ```
   
   **Step 2: Get Required Values**
   - **Team ID**: Found in Apple Developer Console → Your App → App ID Prefix
   - **Client ID**: Your bundle ID (`com.diyagirishkumar.blii`)
   - **Key ID**: The 10-character Key ID from your .p8 key
   - **Private Key File**: The .p8 file you downloaded
   
   **Step 3: Create Python Script**
   
   Create a file called `generate_apple_jwt.py`:
   
   ```python
   import jwt
   import time
   
   def generate_apple_jwt():
       # Replace these values with your actual Apple Developer information
       team_id = "YOUR_TEAM_ID_HERE"  # Found in Apple Developer Portal
       client_id = "com.diyagirishkumar.blii"  # Your bundle ID
       key_id = "YOUR_KEY_ID_HERE"  # 10-character Key ID from .p8 key
       p8_file_path = "path/to/your/AuthKey_KEYID.p8"  # Path to your .p8 file
       
       # Read the private key
       with open(p8_file_path, "r") as f:
           private_key = f.read()
       
       # Create timestamps
       validity_minutes = 20  # Apple allows max 20 minutes
       timestamp_now = int(time.time())
       timestamp_exp = timestamp_now + (60 * validity_minutes)
       
       # Create payload
       payload = {
           "iss": team_id,
           "iat": timestamp_now,
           "exp": timestamp_exp,
           "aud": "https://appleid.apple.com",
           "sub": client_id
       }
       
       # Generate JWT token
       token = jwt.encode(
           payload=payload, 
           key=private_key, 
           algorithm="ES256", 
           headers={"kid": key_id}
       )
       
       # Handle different PyJWT versions
       if isinstance(token, bytes):
           token = token.decode('utf-8')
       
       print("Generated JWT Token:")
       print(token)
       print(f"\nToken expires at: {time.ctime(timestamp_exp)}")
       
       return token
   
   if __name__ == "__main__":
       generate_apple_jwt()
   ```
   
   **Step 4: Run the Script**
   ```bash
   python generate_apple_jwt.py
   ```
   
   **Step 5: Copy the JWT Token**
   The script will output a JWT token that looks like:
   ```
   eyJhbGciOiJFUzI1NiIsImtpZCI6IjEyMzQ1Njc4OTAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJBQkNEMTIzNDU2IiwiaWF0IjoxNzA2NDAwMDAwLCJleHAiOjE3MDY0MDEyMDAsImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJjb20uZGl5YWdpcmlzaGt1bWFyLmJsaWkifQ.signature_here
   ```

5. **Complete Supabase Configuration**
   - Back in Supabase Apple provider settings
   - **Secret Key (for OAuth)**: Paste the JWT token you generated above
   
   **Additional settings you may see:**
   - **Team ID**: Your Apple Developer Team ID (10-character string)
   - **Key ID**: The Key ID from the `.p8` key you created  
   - **Service ID**: `com.diyagirishkumar.blii.service`
   
   - Save configuration

### 3. Database Setup

Your Supabase database should automatically create user records, but ensure you have the proper RLS policies:

```sql
-- Enable RLS on auth.users (should be enabled by default)
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- If you have custom user tables, ensure they're properly configured
-- Example user profile table policy:
CREATE POLICY "Users can view own profile" ON public.users
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users  
FOR UPDATE USING (auth.uid() = id);
```

## Testing Your Apple Sign In

### Prerequisites for Testing
- iOS device with iOS 13+ OR iOS Simulator 13.5+
- Device signed into iCloud
- Your app built with proper bundle ID

### Test Steps
1. **Build and run your app**
   ```bash
   npx expo run:ios
   ```

2. **Test the flow**
   - Go to signup screen
   - Tap Apple Sign In button
   - Complete Apple authentication
   - Verify user appears in Supabase dashboard under Authentication → Users

3. **Test sign in**
   - Sign out of the app
   - Try signing in again with same Apple ID
   - Should work seamlessly

## Troubleshooting

### Common Issues & Solutions

1. **"Apple Sign In not available"**
   - Ensure device has iOS 13+
   - Check if signed into iCloud
   - Verify app.json configuration

2. **Authentication fails silently**
   - Check Apple Developer Console configuration
   - Verify Service ID and redirect URLs
   - Ensure Supabase Apple provider is properly configured

3. **User not created in Supabase**
   - Check Supabase logs in Dashboard → Logs
   - Verify Apple provider configuration
   - Ensure Service ID matches exactly

4. **"Invalid client_id" error**
   - Service ID must match exactly in Apple Console and Supabase
   - Check bundle identifier configuration

### Debug Commands
```bash
# Check if Apple Sign In is available
console.log('Apple Auth Available:', await AppleAuthentication.isAvailableAsync());

# Check current user session
const session = await supabase.auth.getSession();
console.log('Current session:', session);
```

## Production Checklist

- [ ] Apple Developer Program membership (paid)
- [ ] App ID configured with Apple Sign In
- [ ] Service ID created and configured
- [ ] Apple private key generated and added to Supabase
- [ ] Supabase Apple provider enabled and configured
- [ ] Bundle ID matches Apple Developer Console
- [ ] App tested on physical device
- [ ] Privacy policy updated to mention Apple Sign In

## Expected Flow

1. **New User Sign Up**
   - User taps Apple Sign In
   - Apple authentication popup appears
   - User approves with Face ID/Touch ID/passcode
   - App receives Apple identity token
   - Token sent to Supabase
   - Supabase creates new user record
   - User logged into app

2. **Existing User Sign In**
   - User taps Apple Sign In
   - Apple recognizes existing authorization
   - App receives Apple identity token
   - Token sent to Supabase
   - Supabase finds existing user
   - User logged into app

Your implementation should work perfectly once the Apple Developer Console and Supabase configurations are complete!
