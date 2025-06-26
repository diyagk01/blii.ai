# Google Authentication Setup Guide

## Overview
Your Blii app now has Google Authentication integrated! However, you need to configure it with your actual Google OAuth credentials.

## Current Status
✅ **Completed:**
- Google Auth service (`services/auth.ts`)
- Login screen with Google sign-in
- Signup screen with Google sign-up
- Loading states and error handling
- Secure token storage with AsyncStorage

❌ **Needs Configuration:**
- Google OAuth client IDs (currently using placeholders)

## Setup Steps

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API** (or **Google Sign-In API**)

### 2. Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client IDs**
3. Create **3 separate** client IDs:

#### Web Application (for Expo web/development)
- **Application type**: Web application
- **Authorized redirect URIs**: Add these:
  - `http://localhost:8081`
  - `http://localhost:19006`
  - `https://auth.expo.io/@your-expo-username/blii`

#### iOS Application (for iOS builds)
- **Application type**: iOS
- **Bundle ID**: `com.diyagirishkumar.blii` (from your app.json)

#### Android Application (for Android builds)
- **Application type**: Android
- **Package name**: Your Android package name
- **SHA-1 certificate fingerprint**: Get this from your keystore

### 3. Configure Your App
1. Open `config/google-auth.ts`
2. Replace the placeholder client IDs with your actual ones:

```typescript
export const GOOGLE_OAUTH_CONFIG = {
  clientId: Platform.select({
    ios: 'YOUR_ACTUAL_IOS_CLIENT_ID.apps.googleusercontent.com',
    android: 'YOUR_ACTUAL_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    default: 'YOUR_ACTUAL_WEB_CLIENT_ID.apps.googleusercontent.com',
  }),
  // ... rest stays the same
};
```

### 4. Test Authentication
1. Start your Expo development server: `npm start`
2. Open the app in Expo Go
3. Navigate to Login or Signup screen
4. Tap the Google button
5. Complete the OAuth flow

## How It Works

### Authentication Flow
1. User taps "Sign in with Google"
2. App opens Google OAuth in browser
3. User grants permissions
4. Google redirects back to app with authorization code
5. App exchanges code for access token
6. App fetches user profile information
7. User data stored securely in AsyncStorage
8. User navigated to chat screen

### User Data Stored
```typescript
interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}
```

### Security Features
- ✅ State parameter validation (CSRF protection)
- ✅ Secure token storage with AsyncStorage
- ✅ Error handling for failed authentication
- ✅ Token refresh capability (when needed)

## Troubleshooting

### "Invalid client" error
- Make sure your client IDs are correctly configured
- Verify the bundle ID matches your app.json

### OAuth flow doesn't complete
- Check that your redirect URI scheme matches (`blii://auth`)
- Ensure the OAuth client is properly configured

### "Access denied" error
- Make sure the Google+ API is enabled
- Check that OAuth consent screen is configured

## Development vs Production

### For Development (Expo Go)
- Use the **Web client ID** for all platforms
- Test in Expo Go app

### For Production (Standalone Builds)
- Use platform-specific client IDs
- iOS: Use iOS client ID
- Android: Use Android client ID
- Web: Use Web client ID

## Next Steps
1. Configure your actual client IDs
2. Test the authentication flow
3. Customize the user experience
4. Add user profile management
5. Integrate with your backend API (if needed)

## Support
If you encounter issues, check:
- Google Cloud Console for API quotas/limits
- Expo documentation for AuthSession
- React Navigation for deep linking setup

Happy coding! 🚀 