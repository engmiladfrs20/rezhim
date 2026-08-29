import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: [
      {
        find: /^react-native$/,
        replacement: path.resolve(__dirname, './test/react-native-mock.ts'),
      },
      {
        find: /^react-native\/.*/,
        replacement: path.resolve(__dirname, './test/react-native-mock.ts'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        'src/index.ts',
        'vitest.config.ts',
        'vitest.setup.ts',
        'test/react-native-mock.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 50,
        statements: 70,
      },
    },
  },
});
