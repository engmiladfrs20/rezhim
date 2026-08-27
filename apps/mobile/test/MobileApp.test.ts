import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';

let currentMockLocale = 'fa';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (_initial: unknown) => [
      currentMockLocale,
      (val: unknown) => {
        currentMockLocale = val as string;
      },
    ],
  };
});

vi.mock('expo', () => ({
  registerRootComponent: vi.fn(),
}));

vi.mock('react-native', () => {
  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    I18nManager: {
      isRTL: false,
      allowRTL: vi.fn(),
      forceRTL: vi.fn(),
    },
    Text: (props: { children?: React.ReactNode }) => props.children,
    View: (props: { children?: React.ReactNode }) => props.children,
    TouchableOpacity: (props: { children?: React.ReactNode; onPress?: () => void }) =>
      props.children,
    SafeAreaView: (props: { children?: React.ReactNode }) => props.children,
  };
});

import App from '../src/App';
import '../src/index';
import { i18n } from '@nutriai/localization';

describe('Mobile App Foundation (apps/mobile)', () => {
  it('loads localization properly for React Native mobile application', () => {
    i18n.setLocale('fa');
    expect(i18n.t('apps.mobile.title')).toBe('اپلیکیشن موبایل NutriAI Persia');
    expect(i18n.getDirection()).toBe('rtl');

    i18n.setLocale('en');
    expect(i18n.t('apps.mobile.title')).toBe('NutriAI Persia Mobile App');
    expect(i18n.getDirection()).toBe('ltr');
  });

  it('renders App component and executes locale switching', () => {
    currentMockLocale = 'fa';
    const treeFa = (App as unknown as React.FC)({}) as unknown as React.ReactElement;
    expect(treeFa).toBeDefined();

    const cardFa = treeFa.props.children;
    const buttonGroupFa = cardFa.props.children[2];
    const [faButtonFa, enButtonFa] = buttonGroupFa.props.children;

    faButtonFa.props.onPress();
    enButtonFa.props.onPress();

    currentMockLocale = 'en';
    const treeEn = (App as unknown as React.FC)({}) as unknown as React.ReactElement;
    expect(treeEn).toBeDefined();

    const cardEn = treeEn.props.children;
    const buttonGroupEn = cardEn.props.children[2];
    const [faButtonEn, enButtonEn] = buttonGroupEn.props.children;

    faButtonEn.props.onPress();
    enButtonEn.props.onPress();
  });
});
