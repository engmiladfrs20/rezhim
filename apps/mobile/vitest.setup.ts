import React from 'react';
import { vi } from 'vitest';

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

export const mockI18nManager = {
  isRTL: false,
  allowRTL: vi.fn((val: boolean) => {
    mockI18nManager.isRTL = val;
  }),
  forceRTL: vi.fn((val: boolean) => {
    mockI18nManager.isRTL = val;
  }),
};

vi.mock('react-native', () => ({
  StyleSheet: { create: (obj: unknown) => obj },
  View: ({ children, style, ...rest }: { children?: React.ReactNode; style?: unknown }) =>
    React.createElement('div', { ...rest, style: style as React.CSSProperties }, children),
  Text: ({ children, style, ...rest }: { children?: React.ReactNode; style?: unknown }) =>
    React.createElement('span', { ...rest, style: style as React.CSSProperties }, children),
  TouchableOpacity: ({
    disabled,
    onPress,
    children,
    style,
    testID,
  }: {
    disabled?: boolean;
    onPress?: () => void;
    children?: React.ReactNode;
    style?: unknown;
    testID?: string;
  }) =>
    React.createElement(
      'button',
      {
        onClick: disabled ? undefined : onPress,
        type: 'button',
        disabled,
        'data-testid': testID,
        style: style as React.CSSProperties,
      },
      children,
    ),
  SafeAreaView: ({ children, style, ...rest }: { children?: React.ReactNode; style?: unknown }) =>
    React.createElement('div', { ...rest, style: style as React.CSSProperties }, children),
  ScrollView: ({
    children,
    style,
  }: {
    children?: React.ReactNode;
    style?: unknown;
    contentContainerStyle?: unknown;
  }) => React.createElement('div', { style: style as React.CSSProperties }, children),
  TextInput: ({
    value,
    onChangeText,
    secureTextEntry,
    placeholder,
    style,
    testID,
  }: {
    value?: string;
    onChangeText?: (text: string) => void;
    secureTextEntry?: boolean;
    placeholder?: string;
    style?: unknown;
    testID?: string;
    keyboardType?: string;
    autoCapitalize?: string;
  }) =>
    React.createElement('input', {
      placeholder,
      value: value ?? '',
      onChange: (e: { target: { value: string } }) => onChangeText && onChangeText(e.target.value),
      type: secureTextEntry ? 'password' : 'text',
      'data-testid': testID,
      style: style as React.CSSProperties,
    }),
  ActivityIndicator: ({ style }: { size?: string; color?: string; style?: unknown }) =>
    React.createElement(
      'div',
      { style: style as React.CSSProperties, 'data-testid': 'activity-indicator' },
      'Loading...',
    ),
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios || obj.default },
  I18nManager: mockI18nManager,
}));
