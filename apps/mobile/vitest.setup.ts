import path from 'path';
import Module from 'module';
import { vi } from 'vitest';

const mockPath = path.resolve(__dirname, './test/react-native-mock.ts');

// Intercept CJS require for 'react-native' to route directly to our native component mock
// @ts-expect-error - Module._resolveFilename is internal Node API
const origResolve = Module._resolveFilename;
// @ts-expect-error - Module._resolveFilename is internal Node API
Module._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown,
) {
  if (request === 'react-native' || request.startsWith('react-native/')) {
    return mockPath;
  }
  return origResolve.call(this, request, parent, isMain, options);
};

import { mockI18nManager } from './test/react-native-mock';

(globalThis as Record<string, unknown>).expo = { EventEmitter: class {} };

const secureStoreMap = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => secureStoreMap.get(key) || null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreMap.set(key, String(value));
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStoreMap.delete(key);
  }),
  _store: secureStoreMap,
}));

export { mockI18nManager };
