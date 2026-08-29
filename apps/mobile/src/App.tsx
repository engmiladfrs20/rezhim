import React, { useState, useEffect } from 'react';
import type { FC } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  I18nManager,
  ActivityIndicator,
} from 'react-native';
import { i18n, type SupportedLocale } from '@nutriai/localization';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MobileAuthProvider, useMobileAuth } from './auth/MobileAuthProvider';
import { MobileLoginScreen } from './auth/MobileLoginScreen';
import { MobileRegisterScreen } from './auth/MobileRegisterScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

export const MainApp: FC = () => {
  const { user, logout, isLoading, updateProfile, changePassword } = useMobileAuth();
  const [locale, setLocale] = useState<SupportedLocale>(i18n.getLocale());
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Profile Edit State
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [userLocale, setUserLocale] = useState<'fa' | 'en'>(user?.locale || 'fa');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setUserLocale(user.locale);
    }
  }, [user]);

  const switchLocale = (target: SupportedLocale) => {
    i18n.setLocale(target);
    setLocale(target);
    const isRTL = target === 'fa';
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
  };

  const handleUpdateProfile = async () => {
    try {
      setProfileErr('');
      setProfileMsg('');
      setProfileSaving(true);
      await updateProfile({ display_name: displayName, locale: userLocale });
      setProfileMsg('Profile updated successfully');
    } catch (err: unknown) {
      setProfileErr(err instanceof Error ? err.message : 'Profile update failed');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setPwErr('');
      setPwMsg('');
      setPwSaving(true);
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setPwMsg('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      setPwErr(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setPwSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!user) {
    if (authView === 'login') {
      return <MobileLoginScreen onSwap={() => setAuthView('register')} />;
    } else {
      return <MobileRegisterScreen onSwap={() => setAuthView('login')} />;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{i18n.t('common.appName')}</Text>
          <Text style={styles.subtitle}>{i18n.t('apps.mobile.description')}</Text>

          {/* Locale Switcher */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.localeBtn, locale === 'fa' && styles.activeLocaleBtn]}
              onPress={() => switchLocale('fa')}
            >
              <Text style={[styles.localeBtnText, locale === 'fa' && styles.activeLocaleBtnText]}>
                فارسی
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.localeBtn, locale === 'en' && styles.activeLocaleBtn]}
              onPress={() => switchLocale('en')}
            >
              <Text style={[styles.localeBtnText, locale === 'en' && styles.activeLocaleBtnText]}>
                English
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>User Profile</Text>

          {profileMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{profileMsg}</Text>
            </View>
          ) : null}

          {profileErr ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{profileErr}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.readonlyValue}>{user.email}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display Name"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Preferred Locale</Text>
            <View style={styles.localeRow}>
              <TouchableOpacity
                style={[styles.choiceBtn, userLocale === 'fa' && styles.choiceBtnActive]}
                onPress={() => setUserLocale('fa')}
              >
                <Text
                  style={[styles.choiceBtnText, userLocale === 'fa' && styles.choiceBtnTextActive]}
                >
                  فارسی (fa)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choiceBtn, userLocale === 'en' && styles.choiceBtnActive]}
                onPress={() => setUserLocale('en')}
              >
                <Text
                  style={[styles.choiceBtnText, userLocale === 'en' && styles.choiceBtnTextActive]}
                >
                  English (en)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.actionBtn}
            disabled={profileSaving}
            onPress={handleUpdateProfile}
          >
            {profileSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.actionBtnText}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Password Change Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Change Password</Text>

          {pwMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{pwMsg}</Text>
            </View>
          ) : null}

          {pwErr ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{pwErr}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholder="Current Password"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="New Password (12+ chars)"
            />
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#4f46e5' }]}
            disabled={pwSaving}
            onPress={handleChangePassword}
          >
            {pwSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.actionBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => logout()}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
    gap: 16,
  },
  header: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  localeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  activeLocaleBtn: {
    backgroundColor: '#059669',
  },
  localeBtnText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  activeLocaleBtnText: {
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  readonlyValue: {
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  localeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceBtn: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  choiceBtnActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  choiceBtnText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  choiceBtnTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  actionBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  successBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  successText: {
    color: '#047857',
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
  },
  logoutBtn: {
    padding: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MobileAuthProvider>
        <MainApp />
      </MobileAuthProvider>
    </QueryClientProvider>
  );
}
