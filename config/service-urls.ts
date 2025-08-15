// Service URL Configuration
// Easy switching between deployment platforms

export const DOCLING_SERVICE_URLS = {
  // Railway (current)
  railway: 'https://blii-pdf-extraction-production.up.railway.app',
  
  // Render (recommended alternative)
  render: 'https://blii-docling-service.onrender.com',
  
  // Heroku
  heroku: 'https://blii-docling-service.herokuapp.com',
  
  // DigitalOcean
  digitalocean: 'https://blii-docling-service-xxx.ondigitalocean.app',
  
  // Fly.io
  fly: 'https://blii-docling-service.fly.dev',
  
  // Google Cloud Run
  cloudrun: 'https://blii-docling-service-xxx.a.run.app',
  
  // Local development
  local: 'http://localhost:8080'
};

// Change this to switch platforms easily
export const ACTIVE_DOCLING_SERVICE = DOCLING_SERVICE_URLS.railway;

// Fallback URLs for redundancy
export const FALLBACK_DOCLING_SERVICES = [
  DOCLING_SERVICE_URLS.render,
  DOCLING_SERVICE_URLS.heroku,
  DOCLING_SERVICE_URLS.railway
];

export default ACTIVE_DOCLING_SERVICE;
