import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { palette } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';

export default function LoginScreen() {
  const signIn = useAuthStore((store) => store.signIn);
  const error = useAuthStore((store) => store.error);
  const clearError = useAuthStore((store) => store.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLocalError(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError('Completá email y contraseña.');
      return;
    }

    setLoading(true);
    await signIn(email, password);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[420px] self-center gap-5">
          <View className="items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <Feather name="shopping-bag" size={26} color={palette.primaryFg} />
            </View>
            <View className="items-center gap-1">
              <Text className="font-heading text-2xl text-fg">Gestor Kioscos</Text>
              <Text className="text-center font-body text-sm text-muted">
                Caja, stock y escáner remoto en un solo lugar.
              </Text>
            </View>
          </View>

          <Card glass className="gap-4 p-5">
            <View className="gap-1">
              <Text className="font-heading text-lg text-fg">Iniciar sesión</Text>
              <Text className="font-body text-xs text-muted">Usá la cuenta del kiosco.</Text>
            </View>

            {localError || error ? (
              <Banner tone="danger" title="No pudimos ingresar">
                {localError ?? error}
              </Banner>
            ) : null}

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="caja@kiosco.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Input
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              right={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onPress={() => setShowPassword((value) => !value)}
                  className="h-9 w-9 items-center justify-center rounded-lg"
                >
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color={palette.muted} />
                </Pressable>
              }
            />

            <Button label="Ingresar" onPress={() => void submit()} loading={loading} fullWidth size="lg" />

            <View className="flex-row items-center justify-center gap-1 border-t border-line pt-3">
              <Text className="font-body text-xs text-muted">¿Primera vez?</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/registro')}
                className="min-h-touch justify-center px-1"
              >
                <Text className="font-body-semibold text-xs text-primary-ink">Crear cuenta</Text>
              </Pressable>
            </View>
          </Card>

          <Text className="text-center font-body text-2xs leading-5 text-muted">
            La PC y el celular funcionan de forma independiente. Si la PC está conectada, el celular puede escanear
            productos a distancia.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
