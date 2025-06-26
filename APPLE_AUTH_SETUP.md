# Apple Sign In Setup Guide

## Overview
Your app now has Apple Sign In functionality implemented! Follow these steps to complete the configuration.

## 1. Apple Developer Console Configuration

### Step 1: Enable Apple Sign In for your App ID
1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select **Identifiers** → **App IDs**
4. Find your app's Bundle ID or create a new one
5. Edit the App ID and enable **Sign In with Apple** capability
6. Save the changes

### Step 2: Create a Service ID (for web/other platforms if needed)
1. In **Identifiers**, click **+** to create new
2. Select **Services IDs** and continue
3. Enter:
   - **Description**: Your app name (e.g., "Blii Apple Sign In")
   - **Identifier**: Reverse domain format (e.g., `com.yourcompany.blii.service`)
4. Enable **Sign In with Apple**
5. Configure domains and redirect URLs if using web

## 2. Update app.json Configuration

Add these iOS configurations to your `app.json`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "your.bundle.identifier",
      "usesAppleSignIn": true
    },
    "plugins": [
      [
        "expo-apple-authentication"
      ]
    ]
  }
}
```

## 3. iOS Entitlements (Automatic with Expo)

When you build with EAS Build or run on iOS, Expo automatically adds the required entitlements:
```xml
<key>com.apple.developer.applesignin</key>
<array>
    <string>Default</string>
</array>
```

## 4. Testing

### iOS Simulator
- Apple Sign In works in iOS Simulator (iOS 13.5+)
- Use test Apple ID accounts

### Physical Device
- Requires iOS 13+ 
- Must be signed in to iCloud
- Use real Apple ID or test accounts

### Development vs Production
- **Development**: Uses sandbox Apple Sign In
- **Production**: Uses production Apple Sign In
- User accounts are separate between environments

## 5. Important Notes

### Privacy Requirements
- Apple requires apps using Apple Sign In to also offer it as the primary option if you offer other social logins
- Must respect user privacy choices

### User Data
- Apple Sign In provides minimal user data initially
- Email and name are only provided on first sign-in
- Store this data securely as Apple won't provide it again

### Testing Apple Sign In
```javascript
// Check if available before showing button
const isAvailable = await AuthService.getInstance().isAppleAuthenticationAvailable();
if (isAvailable) {
  // Show Apple Sign In button
}
```

### Error Handling
- `ERR_CANCELED`: User cancelled the sign-in
- `ERR_INVALID_RESPONSE`: Invalid response from Apple
- `ERR_NOT_HANDLED`: Unhandled error
- `ERR_UNKNOWN`: Unknown error

## 6. Production Checklist

- [ ] Apple Developer account with paid membership
- [ ] App ID configured with Apple Sign In capability
- [ ] Bundle identifier matches your Apple Developer configuration
- [ ] iOS deployment target is 13.0 or higher
- [ ] App Store Connect configured (for App Store submission)
- [ ] Privacy policy mentions Apple Sign In usage

## 7. Troubleshooting

### Common Issues
1. **"Apple Sign In not available"**: Check iOS version and device settings
2. **Invalid credentials**: Verify Apple Developer Console configuration
3. **Bundle ID mismatch**: Ensure app.json bundle ID matches Apple Developer Console

### Debug Tips
```javascript
console.log('Apple Auth Available:', await AppleAuthentication.isAvailableAsync());
```

## 8. Next Steps

After configuration:
1. Test on iOS device/simulator
2. Submit for App Store review (Apple Sign In requires review)
3. Monitor authentication analytics
4. Handle user sign-out and re-authentication flows

## Support
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Expo Apple Authentication Docs](https://docs.expo.dev/versions/latest/sdk/apple-authentication/) 