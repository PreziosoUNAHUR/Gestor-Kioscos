import Feather from '@expo/vector-icons/Feather';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { isSupabaseConfigured, supabaseHost } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { palette } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';
import { useKioscoStore } from '@/stores/kiosco';
import { usePairingStore } from '@/stores/pairing';

function shortId(value: string | null | undefined): string {
  if (!value) return '—';
  return `${value.slice(0, 8)}…`;
}

export default function AjustesScreen() {
  const email = useAuthStore((store) => store.user?.email ?? '');
  const userId = useAuthStore((store) => store.user?.id ?? null);
  const signOut = useAuthStore((store) => store.signOut);

  const kioscos = useKioscoStore((store) => store.kioscos);
  const activeId = useKioscoStore((store) => store.activeId);
  const loading = useKioscoStore((store) => store.loading);
  const loaded = useKioscoStore((store) => store.loaded);
  const kioscoError = useKioscoStore((store) => store.error);
  const loadKioscos = useKioscoStore((store) => store.load);
  const setActive = useKioscoStore((store) => store.setActive);
  const createKiosco = useKioscoStore((store) => store.create);

  const hostSession = usePairingStore((store) => store.hostSession);
  const hostActive = usePairingStore((store) => store.hostActive);

  const [createOpen, setCreateOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [creating, setCreating] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loaded) void loadKioscos();
  }, [loadKioscos, loaded]);

  // La sesión vencida la cierra el POS al montar; acá alcanza con el flag.
  const scannerActive = Boolean(hostActive && hostSession);

  const submitCreate = async () => {
    if (!nombre.trim()) return;
    setCreating(true);
    const created = await createKiosco(nombre);
    setCreating(false);

    if (created) {
      setCreateOpen(false);
      setNombre('');
    }
  };

  const confirmSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setSignOutOpen(false);
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Configuración"
        title="Ajustes"
        subtitle="Kiosco, cuenta y conexión de este dispositivo."
      />

      <View className="gap-4">
        <Card className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="font-heading text-base text-fg">Tus kioscos</Text>
              <Text className="font-body text-xs text-muted">
                La caja, el stock y los reportes pertenecen al kiosco activo.
              </Text>
            </View>
            <Button
              label="Nuevo"
              size="sm"
              variant="secondary"
              onPress={() => setCreateOpen(true)}
              icon={<Feather name="plus" size={14} color={palette.fg} />}
            />
          </View>

          {kioscoError ? (
            <Banner
              tone="danger"
              title="No pudimos cargar los kioscos"
              action={
                <Button
                  label="Reintentar"
                  size="sm"
                  variant="secondary"
                  onPress={() => void loadKioscos(true)}
                />
              }
            >
              {kioscoError}
            </Banner>
          ) : null}

          {loading && kioscos.length === 0 ? (
            <Spinner compact label="Cargando kioscos…" />
          ) : kioscos.length === 0 ? (
            <EmptyState
              icon={<Feather name="shopping-bag" size={22} color={palette.muted} />}
              title="Todavía no tenés un kiosco"
              description="Creá el primero para empezar a cargar productos y abrir la caja."
              action={<Button label="Crear kiosco" onPress={() => setCreateOpen(true)} />}
            />
          ) : (
            <View className="gap-2">
              {kioscos.map((kiosco) => {
                const active = kiosco.id === activeId;

                return (
                  <Pressable
                    key={kiosco.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Usar ${kiosco.nombre}`}
                    onPress={() => setActive(kiosco.id)}
                    className={cn(
                      'flex-row items-center gap-3 rounded-xl border px-3 py-2.5',
                      active ? 'border-primary/35 bg-primary/10' : 'border-line bg-bg/40',
                    )}
                  >
                    <View
                      className={cn(
                        'h-9 w-9 items-center justify-center rounded-lg',
                        active ? 'bg-primary/15' : 'bg-surface',
                      )}
                    >
                      <Feather
                        name="shopping-bag"
                        size={16}
                        color={active ? palette.primary : palette.muted}
                      />
                    </View>

                    <View className="flex-1 gap-0.5">
                      <Text className="font-body-semibold text-sm text-fg" numberOfLines={1}>
                        {kiosco.nombre}
                      </Text>
                      <Text className="font-body text-2xs text-muted" numberOfLines={1}>
                        {kiosco.moneda} · {kiosco.zona_horaria} · desde {formatDateTime(kiosco.created_at)}
                      </Text>
                    </View>

                    {active ? (
                      <Badge tone="primary">Activo</Badge>
                    ) : (
                      <Feather name="circle" size={16} color={palette.muted} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>

        <Card className="gap-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="font-heading text-base text-fg">Escáner remoto</Text>
            <Badge tone={scannerActive ? 'primary' : 'neutral'}>
              {scannerActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </View>

          {scannerActive && hostSession ? (
            <View className="items-center gap-1 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
              <Text className="font-body-medium text-2xs uppercase tracking-wide text-muted">
                Código de esta PC
              </Text>
              <Text selectable className="font-mono-bold text-3xl tracking-[5px] text-primary-ink">
                {hostSession.codigo.slice(0, 3)} {hostSession.codigo.slice(3)}
              </Text>
              <Text className="font-body text-2xs text-muted">
                Vence el {formatDateTime(hostSession.expiraAt)}
              </Text>
            </View>
          ) : (
            <Text className="font-body text-xs leading-5 text-muted">
              No hay una sesión de escáner activa en este dispositivo. El celular puede vender solo,
              pero para escanear a distancia la PC tiene que estar escuchando.
            </Text>
          )}

          <Text className="font-body text-2xs leading-5 text-muted">
            Esta sección es sólo lectura: la sesión se activa, rota y desactiva desde Caja → Escáner.
          </Text>

          <Button
            label="Gestionar en Caja"
            variant="secondary"
            size="sm"
            onPress={() => router.push('/')}
            icon={<Feather name="shopping-bag" size={14} color={palette.fg} />}
          />
        </Card>

        <Card className="gap-3">
          <Text className="font-heading text-base text-fg">Cuenta</Text>

          <View className="gap-1 rounded-xl border border-line bg-bg/40 px-3 py-2.5">
            <Text className="font-body-medium text-2xs uppercase tracking-wide text-muted">Email</Text>
            <Text className="font-body-semibold text-sm text-fg" numberOfLines={1}>
              {email || 'Sin sesión'}
            </Text>
            <Text className="font-mono text-2xs text-muted">ID {shortId(userId)}</Text>
          </View>

          <Button
            label="Cerrar sesión"
            variant="danger"
            size="sm"
            onPress={() => setSignOutOpen(true)}
            icon={<Feather name="log-out" size={14} color={palette.primaryFg} />}
          />
        </Card>

        <Card className="gap-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="font-heading text-base text-fg">Datos de Supabase</Text>
            <Badge tone={isSupabaseConfigured ? 'primary' : 'danger'}>
              {isSupabaseConfigured ? 'Conectado' : 'Sin configurar'}
            </Badge>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between gap-3 rounded-lg border border-line bg-bg/40 px-3 py-2">
              <Text className="font-body text-xs text-muted">Proyecto</Text>
              <Text className="flex-1 text-right font-mono text-xs text-fg" numberOfLines={1}>
                {supabaseHost ?? '—'}
              </Text>
            </View>

            <View className="flex-row items-center justify-between gap-3 rounded-lg border border-line bg-bg/40 px-3 py-2">
              <Text className="font-body text-xs text-muted">Clave anónima</Text>
              <Text className="font-body-medium text-xs text-fg">
                {isSupabaseConfigured ? 'Configurada' : 'Falta'}
              </Text>
            </View>

            <View className="flex-row items-center justify-between gap-3 rounded-lg border border-line bg-bg/40 px-3 py-2">
              <Text className="font-body text-xs text-muted">Versión de la app</Text>
              <Text className="font-mono text-xs text-fg">
                {Constants.expoConfig?.version ?? '1.0.0'}
              </Text>
            </View>
          </View>

          <View className="gap-1.5 border-t border-line pt-3">
            <Text className="font-body-semibold text-xs text-fg">Migraciones pendientes</Text>
            <Text className="font-body text-2xs leading-5 text-muted">
              Si es un proyecto nuevo, ejecutá en el SQL Editor de Supabase, en orden:
            </Text>
            <View className="gap-1 rounded-lg border border-line bg-bg/60 p-2.5">
              {[
                '20261031000000_schema.sql',
                '20261031000100_realtime_scanner.sql',
                '20261031000200_scanner_sesiones.sql',
                '20261031000300_reportes.sql',
              ].map((file) => (
                <Text key={file} className="font-mono text-2xs text-muted">
                  {file}
                </Text>
              ))}
            </View>
            <Text className="font-body text-2xs leading-5 text-muted">
              Después desactivá “Allow public access” en Realtime → Settings para que los canales
              privados usen RLS.
            </Text>
          </View>
        </Card>
      </View>

      <Modal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo kiosco"
        subtitle="Se crea con moneda ARS y zona horaria de Argentina"
        size="sm"
        footer={
          <View className="flex-row gap-2">
            <Button
              label="Cancelar"
              variant="secondary"
              className="flex-1"
              onPress={() => setCreateOpen(false)}
            />
            <Button
              label="Crear"
              className="flex-1"
              loading={creating}
              disabled={!nombre.trim()}
              onPress={() => void submitCreate()}
            />
          </View>
        }
      >
        {kioscoError ? <Banner tone="danger">{kioscoError}</Banner> : null}

        <Input
          label="Nombre del kiosco"
          value={nombre}
          onChangeText={setNombre}
          placeholder="Kiosco El Sol"
          returnKeyType="done"
          onSubmitEditing={() => void submitCreate()}
          autoFocus
        />

        <Text className="font-body text-2xs leading-5 text-muted">
          Podés crear más de un kiosco con la misma cuenta y cambiar entre ellos cuando quieras. El
          carrito de la caja no se mezcla entre kioscos.
        </Text>
      </Modal>

      <Modal
        visible={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Cerrar sesión"
        size="sm"
        footer={
          <View className="flex-row gap-2">
            <Button
              label="Cancelar"
              variant="secondary"
              className="flex-1"
              onPress={() => setSignOutOpen(false)}
            />
            <Button
              label="Cerrar sesión"
              variant="danger"
              className="flex-1"
              loading={signingOut}
              onPress={() => void confirmSignOut()}
            />
          </View>
        }
      >
        <Text className="font-body text-sm leading-6 text-muted">
          Se borran los datos locales de la sesión (carrito, catálogo y caja). Las ventas ya
          registradas quedan guardadas en Supabase.
        </Text>
      </Modal>
    </Screen>
  );
}
