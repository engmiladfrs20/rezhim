import { vi } from 'vitest';

(globalThis as Record<string, unknown>).expo = { EventEmitter: class {} };

const secureStoreMap = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => secureStoreMap.get(key) || null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreMap.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStoreMap.delete(key);
  }),
  _store: secureStoreMap,
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: vi.fn((obj) => obj) },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  SafeAreaView: 'SafeAreaView',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  Platform: { OS: 'ios', select: vi.fn() },
  I18nManager: { isRTL: false, allowRTL: vi.fn(), forceRTL: vi.fn() },
}));
