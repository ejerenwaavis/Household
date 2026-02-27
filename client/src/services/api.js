import axios from 'axios';

// Detect whether we're running locally or on production (Namecheap)
// Strategy (inspired by your SERVER detection pattern):
//   - localhost or LAN IP  → local dev, hit backend on VITE_API_PORT (default 4000)
//   - anything else        → production, use VITE_API_URL or relative /api (Apache proxy)
const getAPIURL = () => {
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost'
    || hostname === '127.0.0.1'
    || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);

  if (isLocal) {
    // Always auto-detect on local — ignore any VITE_API_URL override so devs
    // don't need to touch .env files when running locally
    const port = import.meta.env.VITE_API_PORT || 4000;
    return `${window.location.protocol}//${hostname}:${port}/api`;
  }

  // Production: use explicit override if set, otherwise rely on Apache reverse proxy
  return import.meta.env.VITE_API_URL || '/api';
};

const apiURL = getAPIURL();
console.log('[API] Initialized with URL:', apiURL);

const api = axios.create({
  baseURL: apiURL,
});

// Add token to requests and log all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Log all requests for debugging
  console.log('[API REQUEST]', {
    method: config.method.toUpperCase(),
    url: config.baseURL + config.url,
    hasToken: !!token,
    data: config.data ? JSON.parse(JSON.stringify(config.data)) : null,
  });
  
  return config;
});

// Log all responses and errors
api.interceptors.response.use(
  (response) => {
    console.log('[API RESPONSE SUCCESS]', {
      method: response.config.method.toUpperCase(),
      url: response.config.baseURL + response.config.url,
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('[API RESPONSE ERROR]', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.baseURL + error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
    });
    return Promise.reject(error);
  }
);

export default api;
