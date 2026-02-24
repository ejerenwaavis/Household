import axios from 'axios';

// Dynamically construct API URL using the same host as the frontend
const getAPIURL = () => {
  // If explicitly configured in environment, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Otherwise, use the same host as the frontend but port 5000 (for development)
  const protocol = window.location.protocol; // http: or https:
  const hostname = window.location.hostname; // localhost or IP address
  const apiPort = 5000; // Backend port
  
  return `${protocol}//${hostname}:${apiPort}/api`;
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
