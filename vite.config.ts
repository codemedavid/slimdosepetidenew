import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  esbuild: {
    // Strip debug logging from production builds (less noise captured by
    // PostHog/session replay); console.warn and console.error are kept.
    pure: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : [],
  },
}));
