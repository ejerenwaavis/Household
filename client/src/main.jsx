import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeSentry } from './services/sentryService';

// Initialize Sentry error tracking before app renders
try {
  console.log('[App Start] Initializing Sentry...');
  initializeSentry(import.meta.env.MODE);
  console.log('[App Start] Sentry initialized');
} catch (error) {
  console.error('[App Start] Sentry initialization failed:', error);
}

console.log('[App Start] Rendering React app...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[App Start] Root element not found!');
  document.body.innerHTML = '<h1>Error: Root element #root not found</h1>';
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('[App Start] React app rendered successfully');
}
