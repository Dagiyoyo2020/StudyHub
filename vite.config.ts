import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        allowedHosts: true,
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // VITE_ prefixed variables are automatically exposed via import.meta.env
      // No need to define them manually
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
