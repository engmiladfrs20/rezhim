import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useMobileAuth } from './MobileAuthProvider';
import { loginSchema } from '@nutriai/schemas';

export const MobileLoginScreen = ({ onSwap }: { onSwap?: () => void }) => {
  const { login } = useMobileAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    try {
      setErrorMsg('');
      setLoading(true);

      const res = loginSchema.safeParse({ email, password });
      if (!res.success) {
        setErrorMsg(res.error.errors[0]?.message || 'Invalid format');
        setLoading(false);
        return;
      }

      await login({ email, password });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24 }}>
      <View
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 16,
          padding: 24,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 2,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#0f172a' }}>NutriAI Persia</Text>
          <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
            Sign in to access your nutrition dashboard.
          </Text>
        </View>

        {errorMsg ? (
          <View
            style={{ backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 16 }}
          >
            <Text style={{ color: '#b91c1c', fontSize: 13, textAlign: 'center' }}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: '#334155', marginBottom: 6 }}>
            Email
          </Text>
          <TextInput
            placeholder="Enter your email"
            testID="login-email-input"
            style={{
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 8,
              padding: 12,
              fontSize: 15,
              color: '#0f172a',
            }}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: '#334155', marginBottom: 6 }}>
            Password
          </Text>
          <TextInput
            placeholder="Enter your password"
            testID="login-password-input"
            style={{
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 8,
              padding: 12,
              fontSize: 15,
              color: '#0f172a',
            }}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          disabled={loading}
          onPress={onSubmit}
          style={{
            backgroundColor: '#059669',
            borderRadius: 8,
            padding: 14,
            alignItems: 'center',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15 }}>Sign In</Text>
          )}
        </TouchableOpacity>

        {onSwap && (
          <TouchableOpacity onPress={onSwap} style={{ alignItems: 'center', marginTop: 16 }}>
            <Text style={{ color: '#059669', fontWeight: '500' }}>
              Don't have an account? Sign Up
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
