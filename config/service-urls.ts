// Service URLs configuration
export const SERVICE_URLS = {
  // Development (local)
  development: {
    docling: 'http://localhost:8080',
    enhanced: 'https://blii-pdf-extraction-production.up.railway.app'
  },
  
  // Production (Render)
  production: {
    docling: 'https://blii-ai.onrender.com',
    enhanced: 'https://blii-pdf-extraction-production.up.railway.app'
  }
};

// Get the current environment
const getEnvironment = (): 'development' | 'production' => {
  // In React Native, we can detect if we're in development or production
  if (__DEV__) {
    return 'development';
  }
  return 'production';
};

// Export the current service URLs
export const getServiceUrls = () => {
  return SERVICE_URLS[getEnvironment()];
};

// Export individual service URLs for convenience
export const getDoclingUrl = () => getServiceUrls().docling;
export const getEnhancedUrl = () => getServiceUrls().enhanced;
