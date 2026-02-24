import os from 'os';

/**
 * Get local IP address (IPv4)
 * Useful for development to make apps accessible from other devices
 */
export const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return 'localhost';
};

/**
 * Get the frontend URL - uses local IP in development for cross-device access
 */
export const getFrontendURL = () => {
  // If explicitly set in .env, use that
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== 'http://localhost:5173') {
    return process.env.FRONTEND_URL;
  }
  
  // In development, use local IP for cross-device access
  if (process.env.NODE_ENV === 'development') {
    const localIP = getLocalIP();
    // Use the frontend/Vite port (default 5173), not the backend port
    const port = 5173;
    
    if (localIP !== 'localhost') {
      return `http://${localIP}:${port}`;
    }
  }
  
  // Fallback to environment variable or localhost
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};

/**
 * Get display URL for logs (shows both localhost and IP)
 */
export const getDisplayURL = () => {
  const localIP = getLocalIP();
  const port = 5173; // Frontend port
  
  if (localIP === 'localhost') {
    return `http://localhost:${port}`;
  }
  
  return `http://${localIP}:${port} (or http://localhost:${port})`;
};
