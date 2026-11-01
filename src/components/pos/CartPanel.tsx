import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Money } from '@/components/ui/Money';
import type { MetodoPago } from '@/lib/database.types';
import { cn } from '@/lib/cn';
import { METODOS_PAGO, formatMoney, metodoPagoLabel, parseMoneyInput } from '@/lib/format';
import { palette } from '@/lib/theme';
import { cartCount, cartSubtotal, cartTotal, type CartItem } from '@/stores/cart';

type CartPanelProps = {
  items: CartItem[];
  descuento: number;
  metodoPago: MetodoPago;
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
  onMetodoChange: (value: MetodoPago) => void;
  onNotasChange: (value: string) => void;
  onMontoRecibidoChange: (value: string) => void;
  onCheckout: () => void;
  onClear: () => void;
};

export function CartPanel({
  items,
  descuento,
  metodoPago,
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
  onNotasChange,
  onMontoRecibidoChange,
  onCheckout,
  onClear,
}: CartPanelProps) {
  const [descuentoText, setDescuentoText] = useState(descuento ? String(descuento) : '');

  useEffect(() => {
    if (descuento === 0) setDescuentoText('');
  }, [descuento]);

  const subtotal = cartSubtotal(items);
  const total = cartTotal(items, descuento);
  const count = cartCount(items);
  const recibido = parseMoneyInput(montoRecibido);
  const vuelto = metodoPago === 'efectivo' && montoRecibido.trim() ? recibido - total : null;

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
          <View key={item.productoId} className="gap-2 rounded-xl border border-line bg-bg/40 p-2.5">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1 gap-0.5">
                <Text className="font-body-semibold text-sm text-fg" numberOfLines={2}>
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
                className="h-8 w-8 items-center justify-center rounded-lg"
              >
                <Feather name="x" size={14} color={palette.muted} />
              </Pressable>
            </View>

            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-1">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Restar uno de ${item.nombre}`}
                  onPress={() => onDecrement(item.productoId)}
                  className="h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface"
                >
                  <Feather name="minus" size={14} color={palette.fg} />
                </Pressable>
                <Text className="min-w-[36px] text-center font-mono-medium text-sm text-fg">{item.cantidad}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Sumar uno de ${item.nombre}`}
                  onPress={() => onIncrement(item.productoId)}
                  className="h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface"
                >
                  <Feather name="plus" size={14} color={palette.fg} />
                </Pressable>
              </View>

              <Money value={item.precioUnitario * item.cantidad} currency={currency} size="sm" />
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <View className="flex-1">
      {showHeader ? (
        <View className="flex-row items-center justify-between gap-2 border-b border-line px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Feather name="shopping-cart" size={16} color={palette.primary} />
            <Text className="font-heading text-base text-fg">Carrito</Text>
            <Badge tone={count > 0 ? 'primary' : 'neutral'}>{count}</Badge>
          </View>
          {items.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vaciar carrito"
              onPress={onClear}
              className="min-h-touch justify-center px-1"
            >
              <Text className="font-body-medium text-2xs text-muted">Vaciar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {scrollItems ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 12, gap: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {lines}
        </ScrollView>
      ) : (
        <View className="p-3">{lines}</View>
      )}

      <View className="gap-3 border-t border-line px-4 py-3">
        <View className="flex-row gap-2">
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
              inputClassName="min-h-touch"
            />
          </View>
          <View className="flex-1 justify-end">
            <Text className="font-body text-2xs text-muted">Subtotal</Text>
            <Money value={subtotal} currency={currency} size="sm" />
          </View>
        </View>

        <View className="gap-1.5">
          <Text className="font-body-medium text-xs text-muted">Medio de pago</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {METODOS_PAGO.map((metodo) => {
              const active = metodo === metodoPago;
              return (
                <Pressable
                  key={metodo}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onMetodoChange(metodo)}
                  className={cn(
                    'min-h-[36px] justify-center rounded-lg border px-2.5',
                    active ? 'border-primary/40 bg-primary/10' : 'border-line bg-bg/40',
                  )}
                >
                  <Text className={cn('font-body-medium text-2xs', active ? 'text-primary-ink' : 'text-muted')}>
                    {metodoPagoLabel(metodo)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {metodoPago === 'efectivo' ? (
          <View className="gap-1.5">
            <Input
              label="Recibido"
              value={montoRecibido}
              onChangeText={onMontoRecibidoChange}
              placeholder={formatMoney(total, currency)}
              keyboardType="decimal-pad"
              inputClassName="min-h-touch"
            />
            <View className="flex-row flex-wrap gap-1.5">
              {[total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000]
                .filter((amount, index, array) => amount > 0 && array.indexOf(amount) === index)
                .map((amount) => (
                  <Pressable
                    key={amount}
                    accessibilityRole="button"
                    onPress={() => onMontoRecibidoChange(String(amount))}
                    className="min-h-[32px] justify-center rounded-lg border border-line bg-bg/40 px-2"
                  >
                    <Text className="font-mono text-2xs text-muted">{formatMoney(amount, currency)}</Text>
                  </Pressable>
                ))}
            </View>
            {vuelto !== null ? (
              <Text className={cn('font-body text-xs', vuelto < 0 ? 'text-danger-ink' : 'text-muted')}>
                {vuelto < 0 ? `Faltan ${formatMoney(Math.abs(vuelto), currency)}` : `Vuelto ${formatMoney(vuelto, currency)}`}
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
          inputClassName="min-h-[60px]"
        />

        {error ? <Banner tone="danger">{error}</Banner> : null}

        <View className="flex-row items-end justify-between gap-2 border-t border-line pt-3">
          <View>
            <Text className="font-body-medium text-2xs uppercase tracking-wide text-muted">Total</Text>
            <Money value={total} currency={currency} size="lg" className="text-primary-ink" />
          </View>
          <Button
            label={canCheckout ? 'Cobrar' : 'Sin caja'}
            onPress={onCheckout}
            loading={checkoutLoading}
            disabled={!canCheckout || items.length === 0}
            size="lg"
            icon={<Feather name="check" size={16} color={palette.primaryFg} />}
          />
        </View>
      </View>
    </View>
  );
}
