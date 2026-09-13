import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import express from 'express';
import { createBmlApiRouter } from './src/server/bmlApiRouter';
import { bmlConnector } from './src/server/serverInstance';

export default defineConfig(() => {
  const apiApp = express();
  apiApp.use(express.json());
  apiApp.use(createBmlApiRouter(bmlConnector));

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'bml-api-middleware',
        configureServer(server) {
          server.middlewares.use('/api/bml', apiApp);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
