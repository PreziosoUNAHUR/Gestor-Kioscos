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

export default function RegistroScreen() {
  const signUp = useAuthStore((store) => store.signUp);
  const error = useAuthStore((store) => store.error);
  const clearError = useAuthStore((store) => store.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLocalError(null);
    clearError();

    if (!email.trim()) {
      setLocalError('Ingresá tu email.');
      return;
    }
    if (password.length < 6) {
      setLocalError('La contraseña necesita al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setLocalError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const result = await signUp(email, password);
    setLoading(false);

    if (result.ok && result.needsConfirmation) {
      setNeedsConfirmation(true);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[420px] self-center gap-5">
          <View className="items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <Feather name="user-plus" size={24} color={palette.primaryFg} />
            </View>
            <View className="items-center gap-1">
              <Text className="font-heading text-2xl text-fg">Crear cuenta</Text>
              <Text className="text-center font-body text-sm text-muted">
                Después vas a poder crear tu kiosco y abrir la caja.
              </Text>
            </View>
          </View>

          {needsConfirmation ? (
            <Card glass className="gap-3 p-5">
              <Banner tone="success" title="Revisá tu email">
                Te enviamos un link de confirmación. Cuando lo abras, volvé acá e iniciá sesión.
              </Banner>
              <Button label="Ir a iniciar sesión" onPress={() => router.replace('/login')} fullWidth size="lg" />
            </Card>
          ) : (
            <Card glass className="gap-4 p-5">
              {localError || error ? (
                <Banner tone="danger" title="No pudimos crear la cuenta">
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
              />

              <Input
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 6 caracteres"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                hint="Mínimo 6 caracteres."
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

              <Input
                label="Repetir contraseña"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
              />

              <Button label="Crear cuenta" onPress={() => void submit()} loading={loading} fullWidth size="lg" />

              <View className="flex-row items-center justify-center gap-1 border-t border-line pt-3">
                <Text className="font-body text-xs text-muted">¿Ya tenés cuenta?</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace('/login')}
                  className="min-h-touch justify-center px-1"
                >
                  <Text className="font-body-semibold text-xs text-primary-ink">Ingresar</Text>
                </Pressable>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
