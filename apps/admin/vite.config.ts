/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@nutriai/localization': path.resolve(__dirname, '../../packages/localization/src'),
      '@nutriai/schemas': path.resolve(__dirname, '../../packages/schemas/src'),
      '@nutriai/types': path.resolve(__dirname, '../../packages/types/src'),
      '@nutriai/storage': path.resolve(__dirname, '../../packages/storage/src'),
      '@nutriai/testing': path.resolve(__dirname, '../../packages/testing/src'),
    },
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  preview: {
    port: 3001,
    host: '0.0.0.0',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        '**/*.d.ts',
        'vite.config.ts',
        'tailwind.config.js',
        'postcss.config.js',
      ],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 60,
        statements: 70,
      },
    },
  },
});
