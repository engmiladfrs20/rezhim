import React from 'react';
import { vi } from 'vitest';

export const mockI18nManager = {
  isRTL: false,
  allowRTL: vi.fn((val: boolean) => {
    mockI18nManager.isRTL = val;
  }),
  forceRTL: vi.fn((val: boolean) => {
    mockI18nManager.isRTL = val;
  }),
};

export const View = React.forwardRef<
  unknown,
  React.PropsWithChildren<{ testID?: string; style?: unknown; children?: React.ReactNode }>
>(({ children, testID, style, ...props }, ref) =>
  React.createElement('View', { ...props, testID, style, ref }, children),
);
View.displayName = 'View';

export const Text = React.forwardRef<
  unknown,
  React.PropsWithChildren<{ testID?: string; style?: unknown; children?: React.ReactNode }>
>(({ children, testID, style, ...props }, ref) =>
  React.createElement('Text', { ...props, testID, style, ref }, children),
);
Text.displayName = 'Text';

export const TextInput = React.forwardRef<
  unknown,
  {
    placeholder?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    secureTextEntry?: boolean;
    testID?: string;
    style?: unknown;
  }
>(({ placeholder, value, onChangeText, secureTextEntry, testID, style, ...props }, ref) =>
  React.createElement('TextInput', {
    ...props,
    placeholder,
    value: value ?? '',
    onChangeText,
    secureTextEntry,
    testID,
    style,
    ref,
  }),
);
TextInput.displayName = 'TextInput';

export const TouchableOpacity = React.forwardRef<
  unknown,
  React.PropsWithChildren<{
    onPress?: () => void;
    disabled?: boolean;
    testID?: string;
    style?: unknown;
    children?: React.ReactNode;
  }>
>(({ children, onPress, disabled, testID, style, ...props }, ref) =>
  React.createElement(
    'TouchableOpacity',
    {
      ...props,
      onPress: disabled ? undefined : onPress,
      disabled,
      testID,
      style,
      ref,
    },
    children,
  ),
);
TouchableOpacity.displayName = 'TouchableOpacity';

export const SafeAreaView = React.forwardRef<
  unknown,
  React.PropsWithChildren<{ testID?: string; style?: unknown; children?: React.ReactNode }>
>(({ children, testID, style, ...props }, ref) =>
  React.createElement('SafeAreaView', { ...props, testID, style, ref }, children),
);
SafeAreaView.displayName = 'SafeAreaView';

export const ScrollView = React.forwardRef<
  unknown,
  React.PropsWithChildren<{ testID?: string; style?: unknown; children?: React.ReactNode }>
>(({ children, testID, style, ...props }, ref) =>
  React.createElement('ScrollView', { ...props, testID, style, ref }, children),
);
ScrollView.displayName = 'ScrollView';

export const ActivityIndicator = React.forwardRef<unknown, { testID?: string; style?: unknown }>(
  ({ testID, style, ...props }, ref) =>
    React.createElement('ActivityIndicator', {
      ...props,
      testID: testID || 'activity-indicator',
      style,
      ref,
    }),
);
ActivityIndicator.displayName = 'ActivityIndicator';

export const Image = React.forwardRef<
  unknown,
  React.PropsWithChildren<{ testID?: string; source?: unknown; style?: unknown }>
>(({ testID, source, style, ...props }, ref) =>
  React.createElement('Image', { ...props, testID, source, style, ref }),
);
Image.displayName = 'Image';

export const Switch = React.forwardRef<
  unknown,
  { testID?: string; value?: boolean; onValueChange?: (val: boolean) => void; style?: unknown }
>(({ testID, value, onValueChange, style, ...props }, ref) =>
  React.createElement('Switch', { ...props, testID, value, onValueChange, style, ref }),
);
Switch.displayName = 'Switch';

export const Modal = React.forwardRef<
  unknown,
  React.PropsWithChildren<{ testID?: string; visible?: boolean; style?: unknown }>
>(({ children, testID, visible, style, ...props }, ref) =>
  visible !== false
    ? React.createElement('Modal', { ...props, testID, visible, style, ref }, children)
    : null,
);
Modal.displayName = 'Modal';

export const Pressable = React.forwardRef<
  unknown,
  React.PropsWithChildren<{
    onPress?: () => void;
    disabled?: boolean;
    testID?: string;
    style?: unknown;
    children?: React.ReactNode;
  }>
>(({ children, onPress, disabled, testID, style, ...props }, ref) =>
  React.createElement(
    'Pressable',
    {
      ...props,
      onPress: disabled ? undefined : onPress,
      disabled,
      testID,
      style,
      ref,
    },
    children,
  ),
);
Pressable.displayName = 'Pressable';

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(obj: T): T => obj,
  flatten: (style: unknown) => style,
};

export const Platform = {
  OS: 'ios',
  select: (obj: Record<string, unknown>) => obj.ios || obj.default,
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
};

export const Alert = {
  alert: vi.fn(),
};

export const I18nManager = mockI18nManager;

export default {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Switch,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
  I18nManager: mockI18nManager,
};
