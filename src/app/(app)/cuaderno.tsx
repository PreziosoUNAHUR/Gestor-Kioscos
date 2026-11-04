import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { Stat } from '@/components/ui/Stat';
import { useActiveKiosco, useEnsureCatalog, useEnsureCuaderno } from '@/hooks/useKioscoData';
import type { CuadernoContactoRow, TipoCuaderno, TipoMovCuaderno } from '@/lib/database.types';
import { cn } from '@/lib/cn';
import { formatMoney, normalizeText, parseMoneyInput } from '@/lib/format';
import { pixelPressed, pixelShadow } from '@/lib/retro';
import { palette } from '@/lib/theme';
import { useCatalogStore } from '@/stores/catalog';
import { useCuadernoStore } from '@/stores/cuaderno';

type Tab = TipoCuaderno;

function saldoLabel(saldo: number, currency: string): { tone: 'danger' | 'primary' | 'muted'; text: string } {
  if (saldo > 0.009) return { tone: 'danger', text: `Debe ${formatMoney(saldo, currency)}` };
  if (saldo < -0.009) return { tone: 'primary', text: `A favor ${formatMoney(Math.abs(saldo), currency)}` };
  return { tone: 'muted', text: 'Sin deuda' };
}

/**
 * Números argentinos: si falta el código de país lo agregamos. No inventamos
 * áreas: el usuario debe cargar el teléfono con código de área.
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('54')) return digits;
  if (digits.startsWith('0')) return `54${digits.slice(1)}`;
  if (digits.length === 10) return `54${digits}`;
  return digits;
}

function buildOrderMessage(provider: string, products: { nombre: string; cantidad: number }[], note: string): string {
  const lines = products.map((product) => `• ${product.cantidad}x ${product.nombre}`);
  const extra = note.trim() ? `\n\n${note.trim()}` : '';
  return `Buenas tardes quiero pedirle:\n${lines.join('\n')}${extra}\n\n— ${provider}`;
}

export default function CuadernoScreen() {
  const kiosco = useActiveKiosco();
  const kioscoId = kiosco?.id ?? null;
  const currency = kiosco?.moneda ?? 'ARS';

  useEnsureCuaderno(kioscoId);
  useEnsureCatalog(kioscoId);

  const items = useCuadernoStore((store) => store.items);
  const loading = useCuadernoStore((store) => store.loading);
  const loaded = useCuadernoStore((store) => store.loaded);
  const storeError = useCuadernoStore((store) => store.error);
  const createContacto = useCuadernoStore((store) => store.create);
  const updateContacto = useCuadernoStore((store) => store.update);
  const removeContacto = useCuadernoStore((store) => store.remove);
  const registrarMovimiento = useCuadernoStore((store) => store.registrarMovimiento);

  const catalog = useCatalogStore((store) => store.items);

  const [tab, setTab] = useState<Tab>('cliente');
  const [query, setQuery] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CuadernoContactoRow | null>(null);
  const [formTipo, setFormTipo] = useState<Tab>('cliente');
  const [formNombre, setFormNombre] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formNotas, setFormNotas] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [movOpen, setMovOpen] = useState(false);
  const [movCliente, setMovCliente] = useState<CuadernoContactoRow | null>(null);
  const [movTipo, setMovTipo] = useState<'cargo' | 'pago'>('cargo');
  const [movMonto, setMovMonto] = useState('');
  const [movDesc, setMovDesc] = useState('');
  const [movSaving, setMovSaving] = useState(false);
  const [movError, setMovError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<CuadernoContactoRow | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const [orderOpen, setOrderOpen] = useState(false);
  const [orderProvider, setOrderProvider] = useState<CuadernoContactoRow | null>(null);
  const [orderSelected, setOrderSelected] = useState<string[]>([]);
  const [orderQuery, setOrderQuery] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [orderError, setOrderError] = useState<string | null>(null);

  const clientes = items.filter((item) => item.tipo === 'cliente');
  const proveedores = items.filter((item) => item.tipo === 'proveedor');
  const totalFiado = clientes.reduce((sum, cliente) => sum + Math.max(0, Number(cliente.saldo_fiado)), 0);
  const conDeuda = clientes.filter((cliente) => Number(cliente.saldo_fiado) > 0.009).length;

  const search = normalizeText(query);
  const visibles = useMemo(() => {
    const base = items.filter((item) => item.tipo === tab);
    if (!search) return base;
    return base.filter((contacto) =>
      normalizeText(
        `${contacto.nombre} ${contacto.telefono ?? ''} ${contacto.notas ?? ''}`,
      ).includes(search),
    );
  }, [items, search, tab]);

  const productosStock = useMemo(
    () =>
      catalog
        .filter((producto) => producto.activo && Number(producto.stock) > 0)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [catalog],
  );

  const orderSearch = normalizeText(orderQuery);
  const orderProducts = useMemo(
    () =>
      orderSearch
        ? productosStock.filter((producto) =>
            normalizeText(`${producto.nombre} ${producto.categoria ?? ''}`).includes(orderSearch),
          )
        : productosStock,
    [orderSearch, productosStock],
  );

  const selectedProducts = orderSelected
    .map((id) => productosStock.find((producto) => producto.id === id))
    .filter((producto): producto is NonNullable<typeof producto> => Boolean(producto));

  const openForm = (tipo: Tab, contacto?: CuadernoContactoRow) => {
    setEditing(contacto ?? null);
    setFormTipo(contacto?.tipo ?? tipo);
    setFormNombre(contacto?.nombre ?? '');
    setFormTelefono(contacto?.telefono ?? '');
    setFormNotas(contacto?.notas ?? '');
    setFormError(null);
    setFormSaving(false);
    setFormOpen(true);
  };

  const saveContacto = async () => {
    if (!kioscoId) return;
    if (!formNombre.trim()) {
      setFormError('El nombre es obligatorio.');
      return;
    }

    setFormSaving(true);
    setFormError(null);

    const data = {
      tipo: formTipo,
      nombre: formNombre,
      telefono: formTelefono,
      notas: formNotas,
    };

    const saved = editing
      ? await updateContacto(editing.id, data)
      : await createContacto(kioscoId, data);

    setFormSaving(false);

    if (!saved) {
      setFormError(useCuadernoStore.getState().error ?? 'No se pudo guardar el contacto.');
      return;
    }

    setFormOpen(false);
  };

  const openMovimiento = (cliente: CuadernoContactoRow, tipo: 'cargo' | 'pago') => {
    setMovCliente(cliente);
    setMovTipo(tipo);
    setMovMonto('');
    setMovDesc(tipo === 'cargo' ? 'Fiado manual' : 'Pago de fiado');
    setMovError(null);
    setMovSaving(false);
    setMovOpen(true);
  };

  const saveMovimiento = async () => {
    if (!movCliente) return;
    const monto = Math.abs(parseMoneyInput(movMonto));
    if (monto <= 0) {
      setMovError('Ingresá un monto mayor a cero.');
      return;
    }

    setMovSaving(true);
    setMovError(null);
    const ok = await registrarMovimiento(movCliente.id, movTipo as TipoMovCuaderno, monto, movDesc);
    setMovSaving(false);

    if (!ok) {
      setMovError(useCuadernoStore.getState().error ?? 'No se pudo registrar el movimiento.');
      return;
    }

    setMovOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingLoading(true);
    const ok = await removeContacto(deleting.id);
    setDeletingLoading(false);
    if (ok) {
      setDeleteOpen(false);
      setDeleting(null);
    }
  };

  const openOrder = (provider: CuadernoContactoRow) => {
    setOrderProvider(provider);
    setOrderSelected([]);
    setOrderQuery('');
    setOrderNote('');
    setOrderError(null);
    setOrderOpen(true);
  };

  const toggleOrderProduct = (id: string) => {
    setOrderSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const sendOrder = async () => {
    if (!orderProvider) return;
    const phone = normalizePhone(orderProvider.telefono ?? '');
    if (!phone) {
      setOrderError('El proveedor no tiene teléfono cargado.');
      return;
    }
    if (selectedProducts.length === 0) {
      setOrderError('Elegí al menos un producto para pedir.');
      return;
    }

    const message = buildOrderMessage(
      orderProvider.nombre,
      selectedProducts.map((producto) => ({ nombre: producto.nombre, cantidad: 1 })),
      orderNote,
    );
    const text = encodeURIComponent(message);
    const appUrl = `whatsapp://send?phone=${phone}&text=${text}`;
    const webUrl = `https://wa.me/${phone}?text=${text}`;

    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpen ? appUrl : webUrl);
      setOrderOpen(false);
    } catch {
      try {
        await Linking.openURL(webUrl);
        setOrderOpen(false);
      } catch {
        setOrderError('No pudimos abrir WhatsApp. Revisá que esté instalado.');
      }
    }
  };

  const movSaldo = Number(movCliente?.saldo_fiado ?? 0);
  const orderPhone = orderProvider ? normalizePhone(orderProvider.telefono ?? '') : '';

  return (
    <Screen>
      <PageHeader
        eyebrow="Cuaderno"
        title="Cuaderno"
        subtitle="Clientes, fiados y proveedores del kiosco."
        actions={
          <Button
            label={tab === 'cliente' ? 'Nuevo cliente' : 'Nuevo proveedor'}
            size="sm"
            variant="primary"
            onPress={() => openForm(tab)}
            icon={<Feather name="plus" size={14} color={palette.ink} />}
          />
        }
      />

      <View className="mb-4 flex-row flex-wrap gap-2">
        <Stat
          label="Fiado pendiente"
          value={formatMoney(totalFiado, currency)}
          hint={`${conDeuda} cliente${conDeuda === 1 ? '' : 's'} con deuda`}
          tone={totalFiado > 0 ? 'danger' : 'default'}
        />
        <Stat label="Clientes" value={String(clientes.length)} hint="Activos en el cuaderno" />
        <Stat label="Proveedores" value={String(proveedores.length)} hint="Para pedidos por WhatsApp" />
      </View>

      <View className="mb-3 flex-row flex-wrap items-center gap-2">
        <Segmented
          options={[
            { value: 'cliente', label: 'Clientes', count: clientes.length },
            { value: 'proveedor', label: 'Proveedores', count: proveedores.length },
          ]}
          value={tab}
          onChange={(value) => {
            setTab(value as Tab);
            setQuery('');
          }}
        />
      </View>

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={tab === 'cliente' ? 'Buscar cliente…' : 'Buscar proveedor…'}
        autoCorrect={false}
        returnKeyType="search"
        right={<Feather name="search" size={16} color={palette.muted} />}
        containerClassName="mb-4"
      />

      {storeError ? <Banner tone="danger" className="mb-3">{storeError}</Banner> : null}

      {loading && !loaded ? (
        <Spinner label="Cargando cuaderno…" />
      ) : visibles.length === 0 ? (
        <EmptyState
          icon={
            <Feather
              name={tab === 'cliente' ? 'users' : 'truck'}
              size={24}
              color={palette.muted}
            />
          }
          title={
            items.length === 0
              ? tab === 'cliente'
                ? 'Todavía no hay clientes'
                : 'Todavía no hay proveedores'
              : 'No encontramos resultados'
          }
          description={
            items.length === 0
              ? tab === 'cliente'
                ? 'Cargá tus clientes para anotar fiados y cobrar después.'
                : 'Cargá proveedores para armar pedidos por WhatsApp.'
              : 'Probá con otro nombre o teléfono.'
          }
          action={
            items.length === 0 ? (
              <Button
                label={tab === 'cliente' ? 'Crear cliente' : 'Crear proveedor'}
                onPress={() => openForm(tab)}
                icon={<Feather name="plus" size={14} color={palette.ink} />}
              />
            ) : undefined
          }
        />
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {visibles.map((contacto) => {
            const saldo = Number(contacto.saldo_fiado);
            const saldoInfo = saldoLabel(saldo, currency);

            return (
              <View
                key={contacto.id}
                style={pixelShadow(4)}
                className="min-w-[280px] flex-1 basis-[320px] gap-2.5 rounded-none border-[3px] border-black bg-surface p-3"
              >
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 gap-0.5">
                    <Text className="font-pixel text-pixel-xs uppercase leading-5 text-fg" numberOfLines={2}>
                      {contacto.nombre}
                    </Text>
                    {contacto.telefono ? (
                      <View className="flex-row items-center gap-1">
                        <Feather name="phone" size={11} color={palette.muted} />
                        <Text className="font-mono text-2xs text-muted">{contacto.telefono}</Text>
                      </View>
                    ) : (
                      <Text className="font-body text-2xs text-muted">Sin teléfono</Text>
                    )}
                  </View>

                  {contacto.tipo === 'cliente' ? (
                    <Badge tone={saldoInfo.tone}>{saldoInfo.text}</Badge>
                  ) : (
                    <Badge tone="orange">Proveedor</Badge>
                  )}
                </View>

                {contacto.notas ? (
                  <Text className="font-body text-2xs leading-4 text-muted" numberOfLines={2}>
                    {contacto.notas}
                  </Text>
                ) : null}

                {contacto.tipo === 'cliente' ? (
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between gap-2 border-t-2 border-black/20 pt-2">
                      <Text className="font-pixel text-pixel-2xs uppercase text-muted">Saldo</Text>
                      <Text
                        className={cn(
                          'font-pixel text-pixel-xs',
                          saldo > 0.009
                            ? 'text-danger-ink'
                            : saldo < -0.009
                              ? 'text-success-ink'
                              : 'text-muted',
                        )}
                      >
                        {formatMoney(Math.abs(saldo), currency)}
                      </Text>
                    </View>

                    <View className="flex-row flex-wrap gap-1.5">
                      <Button
                        label="Fiar"
                        size="sm"
                        variant="pink"
                        onPress={() => openMovimiento(contacto, 'cargo')}
                        icon={<Feather name="plus" size={12} color={palette.ink} />}
                      />
                      <Button
                        label="Cobrar"
                        size="sm"
                        variant="primary"
                        onPress={() => openMovimiento(contacto, 'pago')}
                        icon={<Feather name="check" size={12} color={palette.ink} />}
                      />
                      <Button
                        label="Editar"
                        size="sm"
                        variant="secondary"
                        onPress={() => openForm(contacto.tipo, contacto)}
                        icon={<Feather name="edit-2" size={12} color={palette.fg} />}
                      />
                      <Button
                        label="Borrar"
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          setDeleting(contacto);
                          setDeleteOpen(true);
                        }}
                        icon={<Feather name="trash-2" size={12} color={palette.dangerInk} />}
                      />
                    </View>
                  </View>
                ) : (
                  <View className="gap-2">
                    <View className="flex-row flex-wrap gap-1.5 border-t-2 border-black/20 pt-2">
                      <Button
                        label="Pedir por WhatsApp"
                        size="sm"
                        variant="primary"
                        disabled={!contacto.telefono}
                        onPress={() => openOrder(contacto)}
                        icon={<Feather name="message-circle" size={12} color={palette.ink} />}
                      />
                      <Button
                        label="Editar"
                        size="sm"
                        variant="secondary"
                        onPress={() => openForm(contacto.tipo, contacto)}
                        icon={<Feather name="edit-2" size={12} color={palette.fg} />}
                      />
                      <Button
                        label="Borrar"
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          setDeleting(contacto);
                          setDeleteOpen(true);
                        }}
                        icon={<Feather name="trash-2" size={12} color={palette.dangerInk} />}
                      />
                    </View>
                    {!contacto.telefono ? (
                      <Text className="font-body text-2xs text-muted">
                        Agregá un teléfono para poder enviar el pedido.
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Modal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editing
            ? `Editar ${formTipo === 'cliente' ? 'cliente' : 'proveedor'}`
            : `Nuevo ${formTipo === 'cliente' ? 'cliente' : 'proveedor'}`
        }
        subtitle="El nombre es obligatorio; el teléfono se usa para WhatsApp."
        size="sm"
        footer={
          <View className="flex-row gap-2">
            <Button
              label="Cancelar"
              variant="secondary"
              className="flex-1"
              onPress={() => setFormOpen(false)}
            />
            <Button
              label="Guardar"
              className="flex-1"
              loading={formSaving}
              disabled={!formNombre.trim()}
              onPress={() => void saveContacto()}
            />
          </View>
        }
      >
        {formError ? <Banner tone="danger">{formError}</Banner> : null}

        <Input
          label="Nombre"
          value={formNombre}
          onChangeText={setFormNombre}
          placeholder={formTipo === 'cliente' ? 'Juan Pérez' : 'Distribuidora del Sur'}
          maxLength={120}
          autoFocus
        />

        <Input
          label="Teléfono"
          value={formTelefono}
          onChangeText={setFormTelefono}
          placeholder="11 5555 5555"
          keyboardType="phone-pad"
          hint="Con código de área. Si falta el 54, lo agregamos al abrir WhatsApp."
        />

        <Input
          label="Notas"
          value={formNotas}
          onChangeText={setFormNotas}
          placeholder="Opcional (dirección, horarios, referencias)"
          multiline
          maxLength={280}
          inputClassName="min-h-[70px]"
        />

        {editing && formTipo === 'cliente' ? (
          <Text className="font-body text-2xs leading-4 text-muted">
            El saldo se modifica sólo con movimientos de fiado o pagos, no desde este formulario.
          </Text>
        ) : null}
      </Modal>

      <Modal
        visible={movOpen}
        onClose={() => setMovOpen(false)}
        title={movTipo === 'cargo' ? 'Anotar fiado' : 'Registrar pago'}
        subtitle={movCliente?.nombre}
        size="sm"
        footer={
          <View className="flex-row gap-2">
            <Button
              label="Cancelar"
              variant="secondary"
              className="flex-1"
              onPress={() => setMovOpen(false)}
            />
            <Button
              label={movTipo === 'cargo' ? 'Anotar' : 'Cobrar'}
              className="flex-1"
              loading={movSaving}
              onPress={() => void saveMovimiento()}
            />
          </View>
        }
      >
        {movError ? <Banner tone="danger">{movError}</Banner> : null}

        <View className="flex-row gap-2">
          <Button
            label="Fiado"
            variant={movTipo === 'cargo' ? 'pink' : 'secondary'}
            className="flex-1"
            onPress={() => {
              setMovTipo('cargo');
              setMovDesc('Fiado manual');
            }}
          />
          <Button
            label="Pago"
            variant={movTipo === 'pago' ? 'primary' : 'secondary'}
            className="flex-1"
            onPress={() => {
              setMovTipo('pago');
              setMovDesc('Pago de fiado');
            }}
          />
        </View>

        <View className="flex-row items-center justify-between border-[3px] border-black bg-elevated px-3 py-2">
          <Text className="font-pixel text-pixel-2xs uppercase text-muted">Saldo actual</Text>
          <Text
            className={cn(
              'font-pixel text-pixel-xs',
              movSaldo > 0 ? 'text-danger-ink' : movSaldo < 0 ? 'text-success-ink' : 'text-fg',
            )}
          >
            {formatMoney(movSaldo, currency)}
          </Text>
        </View>

        <Input
          label="Monto"
          value={movMonto}
          onChangeText={setMovMonto}
          placeholder="0,00"
          keyboardType="decimal-pad"
          autoFocus
          hint={
            movTipo === 'pago' && movSaldo > 0
              ? `Deuda actual: ${formatMoney(movSaldo, currency)}`
              : undefined
          }
        />

        {movTipo === 'pago' && movSaldo > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            <Button
              label="Deuda completa"
              size="sm"
              variant="secondary"
              onPress={() => setMovMonto(String(movSaldo))}
            />
            <Button
              label="Mitad"
              size="sm"
              variant="secondary"
              onPress={() => setMovMonto(String(Math.round((movSaldo / 2) * 100) / 100))}
            />
          </View>
        ) : null}

        <Input
          label="Descripción"
          value={movDesc}
          onChangeText={setMovDesc}
          placeholder="Ej. mercadería, pago parcial"
          maxLength={120}
        />

        <Text className="font-body text-2xs leading-4 text-muted">
          {movTipo === 'cargo'
            ? 'El monto se suma a la deuda del cliente y queda registrado en el cuaderno.'
            : 'El monto se resta de la deuda. Si pagás de más, queda saldo a favor.'}
        </Text>
      </Modal>

      <Modal
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Borrar ${deleting?.tipo === 'proveedor' ? 'proveedor' : 'cliente'}`}
        size="sm"
        footer={
          <View className="flex-row gap-2">
            <Button
              label="Cancelar"
              variant="secondary"
              className="flex-1"
              onPress={() => setDeleteOpen(false)}
            />
            <Button
              label="Borrar"
              variant="danger"
              className="flex-1"
              loading={deletingLoading}
              onPress={() => void confirmDelete()}
            />
          </View>
        }
      >
        <Text className="font-body text-sm leading-6 text-muted">
          {deleting?.nombre} deja de aparecer en el cuaderno. Las ventas y los movimientos de fiado
          ya registrados se conservan en el historial.
        </Text>
        {deleting && Number(deleting.saldo_fiado) > 0.009 ? (
          <Banner tone="warning" title="Tiene deuda pendiente">
            {formatMoney(deleting.saldo_fiado, currency)}. Si borrás el contacto, no vas a poder
            cobrarla desde acá.
          </Banner>
        ) : null}
      </Modal>

      <Modal
        visible={orderOpen}
        onClose={() => setOrderOpen(false)}
        title="Pedido por WhatsApp"
        subtitle={orderProvider?.nombre}
        size="lg"
        footer={
          <View className="flex-row gap-2">
            <Button
              label="Cancelar"
              variant="secondary"
              className="flex-1"
              onPress={() => setOrderOpen(false)}
            />
            <Button
              label={`Abrir WhatsApp${selectedProducts.length ? ` (${selectedProducts.length})` : ''}`}
              className="flex-1"
              disabled={!orderPhone || selectedProducts.length === 0}
              onPress={() => void sendOrder()}
              icon={<Feather name="message-circle" size={14} color={palette.ink} />}
            />
          </View>
        }
      >
        {orderError ? <Banner tone="danger">{orderError}</Banner> : null}

        {!orderPhone ? (
          <Banner tone="warning" title="Falta el teléfono">
            Cargá el teléfono del proveedor desde Editar para armar el pedido.
          </Banner>
        ) : (
          <Text className="font-body text-2xs text-muted">
            Se va a abrir WhatsApp al {orderPhone}. El mensaje incluye los productos elegidos.
          </Text>
        )}

        <Input
          value={orderQuery}
          onChangeText={setOrderQuery}
          placeholder="Buscar producto en stock…"
          autoCorrect={false}
          returnKeyType="search"
          right={<Feather name="search" size={16} color={palette.muted} />}
        />

        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-pixel text-pixel-2xs uppercase text-fg">
            Productos con stock ({orderProducts.length})
          </Text>
          {orderSelected.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpiar selección"
              onPress={() => setOrderSelected([])}
            >
              <Text className="font-body-medium text-2xs text-danger-ink">Limpiar</Text>
            </Pressable>
          ) : null}
        </View>

        {orderProducts.length === 0 ? (
          <EmptyState
            icon={<Feather name="package" size={22} color={palette.muted} />}
            title="Sin productos en stock"
            description="Cargá stock desde Productos para poder armar un pedido."
          />
        ) : (
          <View className="gap-1.5">
            {orderProducts.slice(0, 200).map((producto) => {
              const active = orderSelected.includes(producto.id);
              return (
                <Pressable
                  key={producto.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => toggleOrderProduct(producto.id)}
                  style={({ pressed }) => [
                    pixelShadow(2),
                    pressed ? pixelPressed(2) : undefined,
                  ]}
                  className={cn(
                    'flex-row items-center gap-2 border-[3px] border-black px-2.5 py-2',
                    active ? 'bg-accent' : 'bg-elevated',
                  )}
                >
                  <View
                    className={cn(
                      'h-5 w-5 items-center justify-center border-2 border-black',
                      active ? 'bg-white' : 'bg-surface',
                    )}
                  >
                    {active ? <Feather name="check" size={13} color={palette.ink} /> : null}
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="font-body-semibold text-xs text-fg" numberOfLines={1}>
                      {producto.nombre}
                    </Text>
                    <Text className="font-body text-2xs text-muted" numberOfLines={1}>
                      {producto.categoria ?? 'Sin categoría'} · {formatMoney(producto.precio_costo, currency)} costo
                    </Text>
                  </View>
                  <Badge tone="primary">{`${producto.stock} u.`}</Badge>
                </Pressable>
              );
            })}
            {orderProducts.length > 200 ? (
              <Text className="font-body text-2xs text-muted">
                Mostrando 200 de {orderProducts.length}. Usá el buscador para encontrar otro.
              </Text>
            ) : null}
          </View>
        )}

        <Input
          label="Nota para el proveedor"
          value={orderNote}
          onChangeText={setOrderNote}
          placeholder="Opcional (ej. entregar el viernes)"
          multiline
          maxLength={200}
          inputClassName="min-h-[60px]"
        />

        {selectedProducts.length > 0 ? (
          <View className="gap-1 border-[3px] border-black bg-elevated p-2.5">
            <Text className="font-pixel text-pixel-2xs uppercase text-fg">Vista previa</Text>
            <Text className="font-body text-2xs leading-4 text-muted">
              Buenas tardes quiero pedirle:
            </Text>
            {selectedProducts.map((producto) => (
              <Text key={producto.id} className="font-body text-2xs text-fg">
                • 1x {producto.nombre}
              </Text>
            ))}
            {orderNote.trim() ? (
              <Text className="font-body text-2xs text-muted">{orderNote.trim()}</Text>
            ) : null}
          </View>
        ) : null}
      </Modal>
    </Screen>
  );
}
