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
    return '/api';
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
  const storedUser = localStorage.getItem('user');
  let activeHouseholdId = null;

  if (storedUser) {
    try {
      activeHouseholdId = JSON.parse(storedUser)?.householdId || null;
    } catch {
      activeHouseholdId = null;
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (activeHouseholdId) {
    config.headers['X-Household-Id'] = activeHouseholdId;
  }
  
  // Log all requests for debugging
  console.log('[API REQUEST]', {
    method: config.method.toUpperCase(),
    url: config.baseURL + config.url,
    hasToken: !!token,
    activeHouseholdId,
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
    // Notify the app that the session has expired so a modal can be shown.
    // Use a custom event so axios (outside React) doesn't need to import context.
    if (error.response?.status === 401) {
      const code = error.response?.data?.code;
      // Don't treat auth-endpoint 401s as session expiry — those are just wrong credentials.
      const url = error.config?.url || '';
      const isAuthEndpoint = /\/(login|register|passkey\/login)/.test(url);
      if (!isAuthEndpoint) {
        window.dispatchEvent(new CustomEvent('session:expired', { detail: { code } }));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
