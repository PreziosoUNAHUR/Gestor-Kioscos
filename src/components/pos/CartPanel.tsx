import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Money } from '@/components/ui/Money';
import type { CuadernoContactoRow, MetodoPago } from '@/lib/database.types';
import { cn } from '@/lib/cn';
import { formatMoney, metodoPagoLabel, parseMoneyInput } from '@/lib/format';
import { pixelPressed, pixelShadow } from '@/lib/retro';
import { palette } from '@/lib/theme';
import {
  cartCount,
  cartSubtotal,
  cartTotal,
  type CartItem,
  type MetodoPagoUI,
} from '@/stores/cart';

type CartPanelProps = {
  items: CartItem[];
  descuento: number;
  metodoPago: MetodoPagoUI;
  clienteId: string | null;
  clientes: CuadernoContactoRow[];
  notas: string;
  currency: string;
  montoRecibido: string;
  canCheckout: boolean;
  checkoutLoading?: boolean;
  error?: string | null;
  scrollItems?: boolean;
  showHeader?: boolean;
  onIncrement: (productoId: string) => void;
  onDecrement: (productoId: string) => void;
  onRemove: (productoId: string) => void;
  onDescuentoChange: (value: number) => void;
  onMetodoChange: (value: MetodoPagoUI) => void;
  onClienteChange: (value: string | null) => void;
  onNotasChange: (value: string) => void;
  onMontoRecibidoChange: (value: string) => void;
  onCheckout: () => void;
  onClear: () => void;
};

const METODOS_UI: MetodoPagoUI[] = [
  'efectivo',
  'debito',
  'credito',
  'transferencia',
  'qr',
  'fiado',
  'otro',
];

function metodoLabel(metodo: MetodoPagoUI): string {
  return metodo === 'fiado' ? 'Fiado' : metodoPagoLabel(metodo as MetodoPago);
}

export function CartPanel({
  items,
  descuento,
  metodoPago,
  clienteId,
  clientes,
  notas,
  currency,
  montoRecibido,
  canCheckout,
  checkoutLoading = false,
  error,
  scrollItems = true,
  showHeader = true,
  onIncrement,
  onDecrement,
  onRemove,
  onDescuentoChange,
  onMetodoChange,
  onClienteChange,
  onNotasChange,
  onMontoRecibidoChange,
  onCheckout,
  onClear,
}: CartPanelProps) {
  const [descuentoText, setDescuentoText] = useState(descuento ? String(descuento) : '');
  const [clientQuery, setClientQuery] = useState('');

  useEffect(() => {
    if (descuento === 0) setDescuentoText('');
  }, [descuento]);

  const subtotal = cartSubtotal(items);
  const total = cartTotal(items, descuento);
  const count = cartCount(items);
  const recibido = parseMoneyInput(montoRecibido);
  const vuelto = metodoPago === 'efectivo' && montoRecibido.trim() ? recibido - total : null;

  const clientesActivos = clientes.filter((cliente) => cliente.tipo === 'cliente');
  const selectedCliente = clientesActivos.find((cliente) => cliente.id === clienteId) ?? null;
  const search = clientQuery.trim().toLowerCase();
  const clientesFiltrados = search
    ? clientesActivos.filter((cliente) => cliente.nombre.toLowerCase().includes(search))
    : clientesActivos;
  const fiadoIncompleto = metodoPago === 'fiado' && !selectedCliente;

  const lines = (
    <View className="gap-2">
      {items.length === 0 ? (
        <EmptyState
          icon={<Feather name="shopping-cart" size={24} color={palette.muted} />}
          title="El carrito está vacío"
          description="Escaneá un código o tocá un producto para empezar."
          className="border-0 bg-transparent px-2 py-8"
        />
      ) : (
        items.map((item) => (
          <View
            key={item.productoId}
            className="gap-2 rounded-none border-[3px] border-black bg-elevated p-2.5"
          >
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1 gap-0.5">
                <Text className="font-body-semibold text-sm leading-5 text-fg" numberOfLines={2}>
                  {item.nombre}
                </Text>
                <Text className="font-mono text-2xs text-muted">
                  {formatMoney(item.precioUnitario, currency)} c/u
                  {item.codigoBarras ? ` · ${item.codigoBarras}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${item.nombre}`}
                onPress={() => onRemove(item.productoId)}
                hitSlop={6}
                className="h-7 w-7 items-center justify-center border-2 border-black bg-[#FEE2E2] active:translate-x-0.5 active:translate-y-0.5"
              >
                <Feather name="x" size={13} color={palette.dangerInk} />
              </Pressable>
            </View>

            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-1.5">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Restar uno de ${item.nombre}`}
                  onPress={() => onDecrement(item.productoId)}
                  style={({ pressed }) => [pixelShadow(2), pressed ? pixelPressed(2) : undefined]}
                  className="h-8 w-8 items-center justify-center rounded-none border-2 border-black bg-surface"
                >
                  <Feather name="minus" size={14} color={palette.fg} />
                </Pressable>
                <Text className="min-w-[32px] text-center font-pixel text-pixel-xs text-fg">
                  {item.cantidad}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Sumar uno de ${item.nombre}`}
                  onPress={() => onIncrement(item.productoId)}
                  style={({ pressed }) => [pixelShadow(2), pressed ? pixelPressed(2) : undefined]}
                  className="h-8 w-8 items-center justify-center rounded-none border-2 border-black bg-success"
                >
                  <Feather name="plus" size={14} color={palette.ink} />
                </Pressable>
              </View>

              <Money value={item.precioUnitario * item.cantidad} currency={currency} size="sm" />
            </View>
          </View>
        ))
      )}
    </View>
  );

  const configuracion = (
    <View className="gap-3">
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <Input
            label="Descuento"
            value={descuentoText}
            onChangeText={(text) => {
              setDescuentoText(text);
              onDescuentoChange(parseMoneyInput(text));
            }}
            placeholder="0,00"
            keyboardType="decimal-pad"
          />
        </View>
        <View className="flex-1 items-end justify-center pb-1">
          <Text className="font-pixel text-pixel-2xs uppercase text-muted">Subtotal</Text>
          <Money value={subtotal} currency={currency} size="sm" />
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="font-pixel text-pixel-2xs uppercase tracking-wide text-fg">Medio de pago</Text>
        <View className="flex-row flex-wrap gap-1.5">
          {METODOS_UI.map((metodo) => {
            const active = metodo === metodoPago;
            return (
              <Pressable
                key={metodo}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onMetodoChange(metodo)}
                style={({ pressed }) => [
                  pixelShadow(active ? 2 : 1),
                  pressed ? pixelPressed(1) : undefined,
                ]}
                className={cn(
                  'min-h-[34px] justify-center rounded-none border-2 border-black px-2',
                  active ? 'bg-accent' : 'bg-elevated',
                )}
              >
                <Text
                  className={cn(
                    'font-pixel text-pixel-2xs uppercase',
                    active ? 'text-ink' : 'text-muted',
                  )}
                >
                  {metodoLabel(metodo)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {metodoPago === 'fiado' ? (
        <View className="gap-2 rounded-none border-[3px] border-black bg-[#FDF2F8] p-2.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="font-pixel text-pixel-2xs uppercase text-fg">Cliente del fiado</Text>
            {selectedCliente ? (
              <Badge tone="pink">
                {formatMoney(selectedCliente.saldo_fiado, currency)}
              </Badge>
            ) : null}
          </View>

          {clientesActivos.length === 0 ? (
            <Text className="font-body text-2xs leading-4 text-muted">
              Todavía no hay clientes. Creá uno en Cuaderno para poder fiar.
            </Text>
          ) : (
            <>
              <Input
                value={clientQuery}
                onChangeText={setClientQuery}
                placeholder="Buscar cliente…"
                autoCorrect={false}
                inputClassName="min-h-[38px]"
              />
              <ScrollView
                style={{ maxHeight: 132 }}
                contentContainerStyle={{ gap: 6 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {clientesFiltrados.length === 0 ? (
                  <Text className="font-body text-2xs text-muted">Sin resultados.</Text>
                ) : (
                  clientesFiltrados.map((cliente) => {
                    const active = cliente.id === clienteId;
                    return (
                      <Pressable
                        key={cliente.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => onClienteChange(active ? null : cliente.id)}
                        className={cn(
                          'flex-row items-center justify-between gap-2 border-2 border-black px-2 py-1.5',
                          active ? 'bg-pink' : 'bg-elevated',
                        )}
                      >
                        <Text className="flex-1 font-body-medium text-xs text-ink" numberOfLines={1}>
                          {cliente.nombre}
                        </Text>
                        <Text className="font-mono text-2xs text-ink">
                          {formatMoney(cliente.saldo_fiado, currency)}
                        </Text>
                        {active ? <Feather name="check" size={13} color={palette.ink} /> : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </>
          )}

          {selectedCliente ? (
            <Text className="font-body text-2xs leading-4 text-muted">
              Se suman {formatMoney(total, currency)} a la cuenta de {selectedCliente.nombre}.
            </Text>
          ) : (
            <Text className="font-body text-2xs leading-4 text-danger-ink">
              Elegí un cliente para registrar la venta fiada.
            </Text>
          )}
        </View>
      ) : null}

      {metodoPago === 'efectivo' ? (
        <View className="gap-1.5">
          <Input
            label="Recibido"
            value={montoRecibido}
            onChangeText={onMontoRecibidoChange}
            placeholder={formatMoney(total, currency)}
            keyboardType="decimal-pad"
          />
          <View className="flex-row flex-wrap gap-1.5">
            {[total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000]
              .filter((amount, index, array) => amount > 0 && array.indexOf(amount) === index)
              .map((amount) => (
                <Pressable
                  key={amount}
                  accessibilityRole="button"
                  onPress={() => onMontoRecibidoChange(String(amount))}
                  className="min-h-[30px] justify-center border-2 border-black bg-elevated px-2 active:translate-x-0.5 active:translate-y-0.5"
                >
                  <Text className="font-mono text-2xs text-muted">{formatMoney(amount, currency)}</Text>
                </Pressable>
              ))}
          </View>
          {vuelto !== null ? (
            <Text
              className={cn(
                'font-body text-xs',
                vuelto < 0 ? 'text-danger-ink' : 'text-success-ink',
              )}
            >
              {vuelto < 0
                ? `Faltan ${formatMoney(Math.abs(vuelto), currency)}`
                : `Vuelto ${formatMoney(vuelto, currency)}`}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Input
        label="Notas"
        value={notas}
        onChangeText={onNotasChange}
        placeholder="Opcional (ej. cliente con cuenta)"
        multiline
        maxLength={280}
        inputClassName="min-h-[54px]"
      />

      {error ? <Banner tone="danger">{error}</Banner> : null}
    </View>
  );

  return (
    <View className="min-h-0 flex-1">
      {showHeader ? (
        <View className="shrink-0 flex-row items-center justify-between gap-2 border-b-[3px] border-black bg-primary px-3 py-2">
          <View className="flex-row items-center gap-2">
            <Feather name="shopping-cart" size={15} color="#FFFFFF" />
            <Text className="font-pixel text-pixel-2xs uppercase text-white">Carrito</Text>
            <Badge tone="accent">{count}</Badge>
          </View>
          {items.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vaciar carrito"
              onPress={onClear}
              className="min-h-[32px] justify-center border-2 border-black bg-[#FEE2E2] px-2 active:translate-x-0.5 active:translate-y-0.5"
            >
              <Text className="font-pixel text-pixel-2xs uppercase text-danger-ink">Vaciar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {scrollItems ? (
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerStyle={{ padding: 10, gap: 12 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {lines}
          {configuracion}
        </ScrollView>
      ) : (
        <View className="gap-3 p-2.5">
          {lines}
          {configuracion}
        </View>
      )}

      <View className="shrink-0 gap-2 border-t-[3px] border-black bg-surface px-3 py-2.5">
        {fiadoIncompleto ? (
          <Text className="font-body text-2xs text-danger-ink">
            Falta elegir el cliente del fiado.
          </Text>
        ) : null}
        <View className="flex-row items-end justify-between gap-2">
          <View>
            <Text className="font-pixel text-pixel-2xs uppercase text-muted">Total</Text>
            <Text className="font-pixel text-pixel-sm text-primary-ink">
              {formatMoney(total, currency)}
            </Text>
            {metodoPago === 'fiado' && selectedCliente ? (
              <Text className="font-body text-2xs text-muted" numberOfLines={1}>
                Fiado a {selectedCliente.nombre}
              </Text>
            ) : null}
          </View>
          <Button
            label={canCheckout ? 'Cobrar' : 'Sin caja'}
            variant="primary"
            onPress={onCheckout}
            loading={checkoutLoading}
            disabled={!canCheckout || items.length === 0 || fiadoIncompleto}
            size="lg"
            icon={<Feather name="check" size={16} color={palette.ink} />}
          />
        </View>
      </View>
    </View>
  );
}
