import React, { useState } from 'react';
import type { FC } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, I18nManager } from 'react-native';
import { i18n, type SupportedLocale } from '@nutriai/localization';

export const App: FC = () => {
  const [locale, setLocale] = useState<SupportedLocale>(i18n.getLocale());

  const switchLocale = (target: SupportedLocale) => {
    i18n.setLocale(target);
    setLocale(target);
    const isRTL = target === 'fa';
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{i18n.t('common.appName')}</Text>
        <Text style={styles.subtitle}>{i18n.t('apps.mobile.description')}</Text>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.button, locale === 'fa' && styles.activeButton]}
            onPress={() => switchLocale('fa')}
          >
            <Text style={[styles.buttonText, locale === 'fa' && styles.activeButtonText]}>
              فارسی
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, locale === 'en' && styles.activeButton]}
            onPress={() => switchLocale('en')}
          >
            <Text style={[styles.buttonText, locale === 'en' && styles.activeButtonText]}>
              English
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  activeButton: {
    backgroundColor: '#059669',
  },
  buttonText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  activeButtonText: {
    color: '#ffffff',
  },
});

export default App;
