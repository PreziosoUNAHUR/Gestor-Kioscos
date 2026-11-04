import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Money } from '@/components/ui/Money';
import { Segmented, type SegmentOption } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import type { ProductoRow } from '@/lib/database.types';
import { pixelPressed, pixelShadow } from '@/lib/retro';
import { palette } from '@/lib/theme';

type ProductPickerProps = {
  products: ProductoRow[];
  totalCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  categories: SegmentOption<string>[];
  category: string;
  onCategoryChange: (value: string) => void;
  onAdd: (producto: ProductoRow) => void;
  loading: boolean;
  currency?: string;
  emptyAction?: ReactNode;
};

function stockBadge(producto: ProductoRow): { tone: 'primary' | 'accent' | 'danger'; label: string } {
  if (producto.stock <= 0) return { tone: 'danger', label: 'Sin stock' };
  if (producto.stock <= producto.stock_minimo) return { tone: 'accent', label: `${producto.stock} u.` };
  return { tone: 'primary', label: `${producto.stock} u.` };
}

export function ProductPicker({
  products,
  totalCount,
  query,
  onQueryChange,
  categories,
  category,
  onCategoryChange,
  onAdd,
  loading,
  currency = 'ARS',
  emptyAction,
}: ProductPickerProps) {
  return (
    <View className="gap-3">
      <Input
        value={query}
        onChangeText={onQueryChange}
        placeholder="Buscar por nombre, código o categoría…"
        autoCorrect={false}
        returnKeyType="search"
        right={<Feather name="search" size={16} color={palette.muted} />}
      />

      <Segmented options={categories} value={category} onChange={onCategoryChange} />

      {loading && products.length === 0 ? (
        <Spinner compact label="Cargando catálogo…" />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Feather name="package" size={24} color={palette.muted} />}
          title="No hay productos para mostrar"
          description={
            totalCount === 0
              ? 'Cargá tu primer producto para empezar a vender.'
              : 'Probá con otra búsqueda o categoría.'
          }
          action={emptyAction}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            {products.map((producto) => {
              const badge = stockBadge(producto);
              return (
                <Pressable
                  key={producto.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Agregar ${producto.nombre}`}
                  onPress={() => onAdd(producto)}
                  style={({ pressed }) => [pixelShadow(3), pressed ? pixelPressed(3) : undefined]}
                  className="min-w-[145px] max-w-[240px] flex-1 basis-[145px] gap-1.5 rounded-none border-[3px] border-black bg-elevated p-2.5"
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 font-body-semibold text-sm leading-5 text-fg" numberOfLines={2}>
                      {producto.nombre}
                    </Text>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </View>

                  <Money
                    value={producto.precio_venta}
                    currency={currency}
                    size="sm"
                    className="text-primary-ink"
                  />

                  {producto.categoria ? (
                    <Text className="font-body text-2xs text-muted" numberOfLines={1}>
                      {producto.categoria}
                    </Text>
                  ) : null}

                  {producto.codigo_barras ? (
                    <Text className="font-mono text-2xs text-muted" numberOfLines={1}>
                      {producto.codigo_barras}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Text className="font-body text-2xs text-muted">
            Mostrando {products.length} de {totalCount} productos activos.
          </Text>
        </>
      )}
    </View>
  );
}
