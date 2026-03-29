import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function readServerPort() {
  const envPath = path.resolve(__dirname, '../server/.env');

  try {
    const envText = fs.readFileSync(envPath, 'utf8');
    const portLine = envText
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith('PORT='));

    if (!portLine) return '4000';

    const portValue = portLine.split('=')[1]?.trim();
    return portValue || '4000';
  } catch {
    return '4000';
  }
}

const backendPort = readServerPort();

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
