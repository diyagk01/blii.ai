// Google OAuth Configuration
// 
// TO SET UP GOOGLE AUTHENTICATION:
// 1. Go to https://console.cloud.google.com/
// 2. Create a new project or select existing one
// 3. Enable Google+ API (or Google Identity API)
// 4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
// 5. For mobile apps, you need both:
//    - Web application client (for development)
//    - Android/iOS clients (for production)
// 
// For Expo development, create a Web application client with:
//    - Authorized redirect URIs: 
//      * https://auth.expo.io/@your-expo-username/your-project-slug
//      * exp://localhost:8081/--/
//      * exp://your-ip:8081/--/
// 
// Replace the web client ID below with your actual client ID


// IMPORTANT: For Expo development, use the web client ID for all platforms
// This is the recommended approach for Expo managed workflow
export const GOOGLE_OAUTH_CONFIG = {
  // Use your web client ID for all platforms during Expo development
  clientId: '1048635369752-ordkpenhton6sl78chkknqdktsl384oc.apps.googleusercontent.com',
  
  // OAuth scopes - what permissions to request
  scopes: ['openid', 'profile', 'email'],
  
  // Additional configuration
  additionalParameters: {
    access_type: 'offline',
    prompt: 'consent',
  },
  
  // Redirect URI will be handled automatically by Expo
  redirectUri: undefined, // Let Expo handle this
};

// Set this to false once you've updated the redirect URIs in Google Console
export const DISABLE_GOOGLE_AUTH = false;

// Validation function to check if config is properly set up
export const isGoogleAuthConfigured = (): boolean => {
  const clientId = GOOGLE_OAUTH_CONFIG.clientId;
  return typeof clientId === 'string' && 
         !clientId.includes('YOUR_') && 
         clientId.includes('.apps.googleusercontent.com');
};

// Export the configuration to use
export default GOOGLE_OAUTH_CONFIG; 