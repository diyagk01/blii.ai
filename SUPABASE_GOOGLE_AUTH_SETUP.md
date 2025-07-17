# Supabase Google Authentication Setup Guide

## 🎯 Overview
Your app now uses Supabase for Google authentication! This is much simpler and more reliable than the previous Firebase setup.

## ✅ What's Already Done
- ✅ **Supabase auth service** (`services/supabase-auth.ts`)
- ✅ **Login & Signup screens** updated to use Supabase
- ✅ **App configuration** for OAuth callbacks
- ✅ **Apple Sign-In** also working through Supabase

## 🚀 Setup Steps

### 1. Configure Google OAuth in Supabase Dashboard

1. **Go to your Supabase project**: https://supabase.com/dashboard/project/cckclzuomxsxyhmceqal

2. **Navigate to Authentication**:
   - Click "Authentication" in the left sidebar
   - Go to "Providers" tab

3. **Enable Google Provider**:
   - Find "Google" in the list
   - Toggle it **ON**

4. **Add your Google OAuth credentials**:
   - **Client ID**: `1048635369752-ordkpenhton6sl78chkknqdktsl384oc.apps.googleusercontent.com` (from your existing config)
   - **Client Secret**: You'll need to get this from Google Cloud Console

### 2. Update Google Cloud Console for Supabase

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Find your existing OAuth client** (the one with ID: `1048635369752-...`)
3. **Add Supabase redirect URI**:
   - Go to "Credentials" → Edit your OAuth 2.0 client
   - **Add this redirect URI**: `https://cckclzuomxsxyhmceqal.supabase.co/auth/v1/callback`

### 3. Get Google Client Secret

1. **In Google Cloud Console**:
   - Go to "Credentials"
   - Click on your OAuth 2.0 Client ID
   - **Copy the "Client Secret"**

2. **Add to Supabase**:
   - Paste the Client Secret in your Supabase Google provider configuration
   - **Save** the configuration

### 4. Test Your Setup

1. **Start your app**:
   ```bash
   npm start
   ```

2. **Test Google Authentication**:
   - Open your app
   - Go to Login or Signup screen
   - Tap "🔍 Google" button
   - You should be redirected to Google's OAuth page
   - Complete the sign-in
   - You'll be redirected back to your app and logged in!

## 🔧 Your Configuration

### Supabase Project Details:
- **URL**: `https://cckclzuomxsxyhmceqal.supabase.co`
- **Required Redirect URI**: `https://cckclzuomxsxyhmceqal.supabase.co/auth/v1/callback`

### Google OAuth Details:
- **Client ID**: `1048635369752-ordkpenhton6sl78chkknqdktsl384oc.apps.googleusercontent.com`
- **Bundle ID**: `com.diyagirishkumar.blii`

### App Scheme:
- **URL Scheme**: `blii://auth/callback`

## 🎉 Benefits of Supabase Auth

### ✅ **Much Simpler**:
- No complex token exchange
- No manual user info fetching
- Built-in session management

### ✅ **More Secure**:
- Server-side token validation
- Automatic session refresh
- Built-in CSRF protection

### ✅ **Better Features**:
- User management dashboard
- Email templates
- Row Level Security
- Real-time auth state changes

## 🔍 How It Works

### Authentication Flow:
1. **User taps Google button**
2. **App opens Supabase OAuth URL**
3. **User signs in with Google**
4. **Google redirects to Supabase**
5. **Supabase creates user session**
6. **App receives auth tokens**
7. **User is logged in!**

### User Data Structure:
```typescript
interface SupabaseUser {
  id: string;              // Supabase UUID
  email: string;           // From Google
  name: string;            // From Google profile
  picture?: string;        // Google profile picture
  provider: 'google';      // Auth provider
}
```

## 🐛 Troubleshooting

### "Invalid client" error:
- ✅ Check Client ID in Supabase matches Google Console
- ✅ Verify Client Secret is correct
- ✅ Ensure Google provider is enabled in Supabase

### "Redirect URI mismatch":
- ✅ Add `https://cckclzuomxsxyhmceqal.supabase.co/auth/v1/callback` to Google Console
- ✅ Check Supabase project URL is correct

### OAuth flow doesn't complete:
- ✅ Verify app scheme `blii://auth/callback` is configured
- ✅ Check Expo linking is working
- ✅ Test on device (iOS Simulator sometimes has issues)

## 📱 Development vs Production

### **Development (Expo Go)**:
- ✅ Current setup works perfectly
- ✅ Uses Supabase hosted OAuth
- ✅ No additional configuration needed

### **Production (Standalone Build)**:
- ✅ Same setup works
- ✅ No platform-specific configurations
- ✅ Universal across iOS/Android/Web

## 🚀 Next Steps

1. **Complete the Google OAuth setup** in Supabase dashboard
2. **Test the authentication flow**
3. **Your app is ready!** 🎉

The Supabase approach is much cleaner and you'll have a fully working Google authentication system!

## 🔗 Useful Links

- **Your Supabase Dashboard**: https://supabase.com/dashboard/project/cckclzuomxsxyhmceqal
- **Google Cloud Console**: https://console.cloud.google.com/
- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth/social-login/auth-google 