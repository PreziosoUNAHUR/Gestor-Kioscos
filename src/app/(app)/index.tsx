import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CajaBanner } from '@/components/pos/CajaBanner';
import { CartPanel } from '@/components/pos/CartPanel';
import { CheckoutSuccessModal } from '@/components/pos/CheckoutSuccessModal';
import { KioscoOnboarding } from '@/components/pos/KioscoOnboarding';
import { OpenCajaModal } from '@/components/pos/OpenCajaModal';
import { PairingModal } from '@/components/pos/PairingModal';
import { ProductPicker } from '@/components/pos/ProductPicker';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
import { Spinner } from '@/components/ui/Spinner';
import { useIsDesktop } from '@/hooks/useAdaptive';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import {
  useActiveKiosco,
  useEnsureCaja,
  useEnsureCatalog,
  useEnsureCuaderno,
  useRealtimeKiosco,
} from '@/hooks/useKioscoData';
import { useScannerSync } from '@/hooks/useScannerSync';
import type { ProductoRow, VentaRow } from '@/lib/database.types';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, normalizeText, parseMoneyInput } from '@/lib/format';
import { pixelShadow } from '@/lib/retro';
import type { ScanOutcome } from '@/lib/scanner';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import { useCajaStore } from '@/stores/caja';
import { cartCount, cartTotal, useCartStore, type MetodoPagoUI } from '@/stores/cart';
import { useCatalogStore } from '@/stores/catalog';
import { useCuadernoStore } from '@/stores/cuaderno';
import { useKioscoStore } from '@/stores/kiosco';
import { usePairingStore } from '@/stores/pairing';

function productCategory(producto: ProductoRow): string {
  return producto.categoria?.trim() || 'Sin categoría';
}

export default function CajaScreen() {
  const desktop = useIsDesktop();
  const kiosco = useActiveKiosco();
  const kioscoId = kiosco?.id ?? null;
  const currency = kiosco?.moneda ?? 'ARS';

  const kioscosLoaded = useKioscoStore((store) => store.loaded);
  const kioscoError = useKioscoStore((store) => store.error);
  const loadKioscos = useKioscoStore((store) => store.load);

  useEnsureCatalog(kioscoId);
  useEnsureCuaderno(kioscoId);
  useEnsureCaja(kioscoId);
  useRealtimeKiosco(kioscoId);

  const catalogItems = useCatalogStore((store) => store.items);
  const catalogLoading = useCatalogStore((store) => store.loading);
  const catalogError = useCatalogStore((store) => store.error);
  const findByBarcode = useCatalogStore((store) => store.findByBarcode);
  const findById = useCatalogStore((store) => store.findById);
  const applyStock = useCatalogStore((store) => store.applyStock);

  const cartItems = useCartStore((store) => store.items);
  const cartKioscoId = useCartStore((store) => store.kioscoId);
  const descuento = useCartStore((store) => store.descuento);
  const metodoPago = useCartStore((store) => store.metodoPago);
  const clienteId = useCartStore((store) => store.clienteId);
  const notas = useCartStore((store) => store.notas);
  const addProducto = useCartStore((store) => store.addProducto);
  const incrementar = useCartStore((store) => store.incrementar);
  const decrementar = useCartStore((store) => store.decrementar);
  const removeItem = useCartStore((store) => store.removeItem);
  const setDescuento = useCartStore((store) => store.setDescuento);
  const setMetodoPago = useCartStore((store) => store.setMetodoPago);
  const setClienteId = useCartStore((store) => store.setClienteId);
  const setNotas = useCartStore((store) => store.setNotas);
  const clearCart = useCartStore((store) => store.clear);
  const hydrated = useCartHydrated();

  const clientes = useCuadernoStore((store) => store.items);

  const caja = useCajaStore((store) => store.caja);
  const cajaLoading = useCajaStore((store) => store.loading);
  const cajaError = useCajaStore((store) => store.error);
  const abrirCaja = useCajaStore((store) => store.abrir);
  const cargarResumen = useCajaStore((store) => store.cargarResumen);

  const hostSession = usePairingStore((store) => store.hostSession);
  const hostActive = usePairingStore((store) => store.hostActive);
  const pairingLoading = usePairingStore((store) => store.loading);
  const pairingError = usePairingStore((store) => store.error);
  const abrirSesion = usePairingStore((store) => store.abrirSesion);
  const cerrarSesion = usePairingStore((store) => store.cerrarSesion);

  const sessionForKiosco = hostSession && hostSession.kioscoId === kioscoId ? hostSession : null;
  const pairingEnabled = Boolean(hostActive && sessionForKiosco);

  const handleScan = useCallback(
    async (code: string): Promise<ScanOutcome> => {
      const producto = findByBarcode(code);
      if (!producto) {
        return { ok: false, code, reason: 'not_found', message: 'Producto no encontrado.' };
      }

      const result = addProducto(producto);
      return {
        ok: true,
        code,
        nombre: producto.nombre,
        precio: Number(producto.precio_venta),
        cantidad: result.cantidad,
      };
    },
    [addProducto, findByBarcode],
  );

  const scanner = useScannerSync({
    role: 'host',
    kioscoId,
    pairingCode: sessionForKiosco?.codigo ?? null,
    enabled: pairingEnabled,
    onScan: handleScan,
  });

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [openCajaOpen, setOpenCajaOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<VentaRow | null>(null);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [dismissedScanAt, setDismissedScanAt] = useState(0);

  // Una sesión vencida no puede suscribirse a Realtime: la cerramos para que el
  // usuario vea "inactivo" en lugar de un error de conexión permanente.
  useEffect(() => {
    if (!hostActive || !hostSession) return;
    if (new Date(hostSession.expiraAt).getTime() <= Date.now()) {
      void cerrarSesion(hostSession.kioscoId);
    }
  }, [cerrarSesion, hostActive, hostSession]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const producto of catalogItems) {
      const key = productCategory(producto);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const options = Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([value, count]) => ({ value, label: value, count }));

    return [{ value: 'all', label: 'Todos', count: catalogItems.length }, ...options];
  }, [catalogItems]);

  const filtered = useMemo(() => {
    const search = normalizeText(query);
    const byCategory =
      category === 'all' ? catalogItems : catalogItems.filter((producto) => productCategory(producto) === category);

    const result = search
      ? byCategory.filter((producto) =>
          normalizeText(
            `${producto.nombre} ${producto.codigo_barras ?? ''} ${producto.sku ?? ''} ${producto.categoria ?? ''}`,
          ).includes(search),
        )
      : byCategory;

    // La grilla no necesita pintar miles de tarjetas: el buscador filtra el resto.
    return result.slice(0, 150);
  }, [catalogItems, category, query]);

  const count = cartCount(cartItems);
  const total = cartTotal(cartItems, descuento);
  const cartMismatch = Boolean(cartKioscoId && kioscoId && cartKioscoId !== kioscoId);
  const fiadoListo = metodoPago !== 'fiado' || Boolean(clienteId);
  const canCheckout = Boolean(caja) && hydrated && !cartMismatch && fiadoListo;
  const scanNotice = scanner.lastScan && scanner.lastScan.at > dismissedScanAt ? scanner.lastScan : null;

  const handleAdd = (producto: ProductoRow) => {
    const result = addProducto(producto);
    setAddNotice(result.message ?? null);
  };

  const handleClearCart = () => {
    clearCart();
    setMontoRecibido('');
    setCheckoutError(null);
    setAddNotice(null);
  };

  const handleMetodoChange = (value: MetodoPagoUI) => {
    setMetodoPago(value);
    if (value !== 'efectivo') setMontoRecibido('');
  };

  const checkout = async () => {
    if (!kioscoId || !caja || cartItems.length === 0) return;
    setCheckoutError(null);

    if (metodoPago === 'fiado' && !clienteId) {
      setCheckoutError('Elegí el cliente al que le vas a fiar la venta.');
      return;
    }

    const recibido = metodoPago === 'efectivo' && montoRecibido.trim() ? parseMoneyInput(montoRecibido) : null;
    if (recibido !== null && recibido < total) {
      setCheckoutError(`El monto recibido es menor al total (${formatMoney(total, currency)}).`);
      return;
    }

    setCheckoutLoading(true);
    const { data, error } = await supabase.rpc('registrar_venta', {
      p_kiosco_id: kioscoId,
      p_items: cartItems.map((item) => ({ producto_id: item.productoId, cantidad: item.cantidad })),
      // "Fiado" no existe en el enum de Postgres: se guarda como `otro` + cliente.
      p_metodo_pago: metodoPago === 'fiado' ? 'otro' : metodoPago,
      p_descuento: descuento,
      p_monto_recibido: recibido,
      p_notas: notas.trim() || null,
      p_cliente_id: metodoPago === 'fiado' ? clienteId : null,
    });
    setCheckoutLoading(false);

    if (error || !data) {
      setCheckoutError(getErrorMessage(error ?? 'No se pudo registrar la venta.'));
      return;
    }

    // El servidor ya descontó el stock; reflejamos el mismo resultado sin esperar
    // al evento de Realtime para que la grilla no muestre stock viejo.
    for (const item of cartItems) {
      const current = findById(item.productoId);
      if (current) applyStock(item.productoId, current.stock - item.cantidad);
    }

    // El RPC ya movió el saldo del cliente: recargamos el cuaderno.
    if (metodoPago === 'fiado') void useCuadernoStore.getState().load(kioscoId, { force: true });

    clearCart();
    setMontoRecibido('');
    setAddNotice(null);
    setTicket(data);
    setCartOpen(false);
    void cargarResumen(caja.id);
  };

  const handleOpenCaja = async (monto: number) => {
    if (!kioscoId) return;
    const ok = await abrirCaja(kioscoId, monto);
    if (ok) setOpenCajaOpen(false);
  };

  const activate = async () => {
    if (kioscoId) await abrirSesion(kioscoId);
  };

  const rotate = async () => {
    if (kioscoId) await abrirSesion(kioscoId, true);
  };

  const deactivate = async () => {
    if (kioscoId) await cerrarSesion(kioscoId);
  };

  if (!kiosco) {
    if (!kioscosLoaded) {
      return (
        <Screen>
          <PageHeader title="Caja" />
          {kioscoError ? (
            <Banner
              tone="danger"
              title="No pudimos cargar tus kioscos"
              action={<Button label="Reintentar" size="sm" variant="secondary" onPress={() => void loadKioscos(true)} />}
            >
              {kioscoError}
            </Banner>
          ) : (
            <Spinner label="Cargando kioscos…" />
          )}
        </Screen>
      );
    }

    return (
      <Screen>
        <PageHeader title="Caja" subtitle="Primero creá tu kiosco para empezar a vender." />
        <KioscoOnboarding />
      </Screen>
    );
  }

  const renderCartPanel = (options: { scrollItems: boolean; showHeader: boolean }) => (
    <CartPanel
      items={cartItems}
      descuento={descuento}
      metodoPago={metodoPago}
      clienteId={clienteId}
      clientes={clientes}
      notas={notas}
      currency={currency}
      montoRecibido={montoRecibido}
      canCheckout={canCheckout}
      checkoutLoading={checkoutLoading}
      error={checkoutError}
      scrollItems={options.scrollItems}
      showHeader={options.showHeader}
      onIncrement={incrementar}
      onDecrement={decrementar}
      onRemove={removeItem}
      onDescuentoChange={setDescuento}
      onMetodoChange={handleMetodoChange}
      onClienteChange={setClienteId}
      onNotasChange={setNotas}
      onMontoRecibidoChange={setMontoRecibido}
      onCheckout={() => void checkout()}
      onClear={handleClearCart}
    />
  );

  return (
    <Screen scroll={false}>
      <View className="flex-1">
        <PageHeader
          eyebrow="Punto de venta"
          title="Caja"
          subtitle={`${kiosco.nombre} · ${kiosco.moneda}`}
          actions={
            <>
              <Button
                label={scanner.connected ? 'Escáner activo' : 'Escáner'}
                variant="secondary"
                size="sm"
                onPress={() => setPairingOpen(true)}
                icon={
                  <Feather
                    name="smartphone"
                    size={15}
                    color={scanner.connected ? palette.primary : palette.muted}
                  />
                }
              />
              <Button
                label="Productos"
                variant="ghost"
                size="sm"
                onPress={() => router.push('/productos')}
                icon={<Feather name="box" size={15} color={palette.muted} />}
              />
            </>
          }
        />

        <View className="gap-3">
          <CajaBanner
            caja={caja}
            loading={cajaLoading}
            onAbrir={() => setOpenCajaOpen(true)}
            onVerTurno={() => router.push('/caja')}
          />

          {cajaError && !openCajaOpen ? <Banner tone="danger">{cajaError}</Banner> : null}

          {pairingEnabled && scanner.status === 'error' ? (
            <Banner
              tone="danger"
              title="Escáner remoto sin conexión"
              action={<Button label="Reintentar" size="sm" variant="secondary" onPress={scanner.retry} />}
            >
              {scanner.error ?? 'Revisá Realtime y las políticas del proyecto.'}
            </Banner>
          ) : null}

          {pairingEnabled && scanner.connected ? (
            <Banner tone="success" title="Escáner remoto activo">
              {scanner.peerCount === 0
                ? 'Esperando al celular. Compartí el código desde el botón Escáner.'
                : `${scanner.peerCount} celular${scanner.peerCount > 1 ? 'es' : ''} conectado${scanner.peerCount > 1 ? 's' : ''}.`}
            </Banner>
          ) : null}

          {scanNotice ? (
            <Banner
              tone={scanNotice.outcome.ok ? 'success' : 'danger'}
              title={scanNotice.outcome.ok ? 'Producto agregado' : 'No se pudo agregar'}
              action={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar aviso de escaneo"
                  onPress={() => setDismissedScanAt(Date.now())}
                  className="h-8 w-8 items-center justify-center rounded-lg"
                >
                  <Feather name="x" size={14} color={palette.muted} />
                </Pressable>
              }
            >
              {scanNotice.outcome.ok
                ? `${scanNotice.outcome.nombre ?? scanNotice.code} · ${scanNotice.outcome.cantidad ?? 1} en el carrito`
                : (scanNotice.outcome.message ?? 'Código no encontrado.')}
            </Banner>
          ) : null}

          {cartMismatch ? (
            <Banner
              tone="warning"
              title="El carrito es de otro kiosco"
              action={<Button label="Vaciar" size="sm" variant="secondary" onPress={handleClearCart} />}
            >
              Cambiaste de kiosco. Vacía el carrito para cobrar con {kiosco.nombre}.
            </Banner>
          ) : null}

          {addNotice ? (
            <Banner
              tone="warning"
              action={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar aviso"
                  onPress={() => setAddNotice(null)}
                  className="h-8 w-8 items-center justify-center rounded-lg"
                >
                  <Feather name="x" size={14} color={palette.muted} />
                </Pressable>
              }
            >
              {addNotice}
            </Banner>
          ) : null}
        </View>

        <View className={desktop ? 'mt-4 min-h-0 flex-1 flex-row gap-5' : 'mt-4 flex-1'}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: desktop ? 8 : 96, gap: 12 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {catalogError ? (
              <Banner tone="danger" title="No pudimos cargar el catálogo">
                {catalogError}
              </Banner>
            ) : null}

            <ProductPicker
              products={filtered}
              totalCount={catalogItems.length}
              query={query}
              onQueryChange={setQuery}
              categories={categories}
              category={category}
              onCategoryChange={setCategory}
              onAdd={handleAdd}
              loading={catalogLoading}
              currency={currency}
              emptyAction={
                <Button
                  label="Cargar producto"
                  size="sm"
                  onPress={() => router.push('/productos')}
                  icon={<Feather name="plus" size={14} color={palette.primaryFg} />}
                />
              }
            />
          </ScrollView>

          {desktop ? (
            <View
              className="min-h-0 w-[380px] shrink-0 overflow-hidden rounded-none border-[3px] border-black bg-surface"
              style={pixelShadow(5)}
            >
              {renderCartPanel({ scrollItems: true, showHeader: true })}
            </View>
          ) : null}
        </View>

        {!desktop && count > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver carrito"
            onPress={() => setCartOpen(true)}
            style={({ pressed }) => [pixelShadow(4), pressed ? { transform: [{ translateY: 2 }] } : undefined]}
            className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between gap-3 rounded-none border-[3px] border-black bg-surface px-3 py-2.5"
          >
            <View className="flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center border-2 border-black bg-accent">
                <Feather name="shopping-cart" size={16} color={palette.ink} />
              </View>
              <View>
                <Text className="font-pixel text-pixel-2xs uppercase text-muted">Carrito</Text>
                <Text className="font-body-semibold text-sm text-fg">
                  {count} {count === 1 ? 'producto' : 'productos'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-3">
              <Money value={total} currency={currency} size="md" className="text-primary-ink" />
              <Feather name="chevron-up" size={18} color={palette.muted} />
            </View>
          </Pressable>
        ) : null}
      </View>

      <PairingModal
        visible={pairingOpen}
        onClose={() => setPairingOpen(false)}
        session={sessionForKiosco}
        hostActive={pairingEnabled}
        activating={pairingLoading}
        peerCount={scanner.peerCount}
        status={scanner.status}
        error={pairingError ?? scanner.error}
        onActivate={() => void activate()}
        onRotate={() => void rotate()}
        onDeactivate={() => void deactivate()}
      />

      <OpenCajaModal
        visible={openCajaOpen}
        onClose={() => setOpenCajaOpen(false)}
        onConfirm={(monto) => void handleOpenCaja(monto)}
        loading={cajaLoading}
        error={cajaError}
        currency={currency}
      />

      <CheckoutSuccessModal ticket={ticket} onClose={() => setTicket(null)} currency={currency} />

      <Modal visible={cartOpen} onClose={() => setCartOpen(false)} title="Carrito" size="lg">
        {renderCartPanel({ scrollItems: false, showHeader: false })}
      </Modal>
    </Screen>
  );
}
