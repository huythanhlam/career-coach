import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'supabase/functions/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    // Dummy Supabase env so modules that construct the client at import time
    // (via @/lib/supabaseClient) don't throw during unit tests. No network is
    // made at construction.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_API_URL: 'http://localhost:4000/api/ai/generate',
    },
  },
});
