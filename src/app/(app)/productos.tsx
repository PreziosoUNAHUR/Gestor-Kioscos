import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ProductFormModal } from '@/components/productos/ProductFormModal';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { Stat } from '@/components/ui/Stat';
import { useActiveKiosco, useEnsureCatalog } from '@/hooks/useKioscoData';
import type { ProductoRow } from '@/lib/database.types';
import { getErrorMessage } from '@/lib/errors';
import { normalizeText } from '@/lib/format';
import { pixelPressed, pixelShadow } from '@/lib/retro';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import { useCatalogStore } from '@/stores/catalog';

const PRODUCT_COLUMNS =
  'id,kiosco_id,codigo_barras,sku,nombre,categoria,precio_costo,precio_venta,stock,stock_minimo,activo,imagen_url,created_at,updated_at';

function categoryOf(producto: ProductoRow): string {
  return producto.categoria?.trim() || 'Sin categoría';
}

export default function ProductosScreen() {
  const kiosco = useActiveKiosco();
  const kioscoId = kiosco?.id ?? null;
  const currency = kiosco?.moneda ?? 'ARS';

  useEnsureCatalog(kioscoId);

  const activeItems = useCatalogStore((store) => store.items);
  const loading = useCatalogStore((store) => store.loading);
  const catalogError = useCatalogStore((store) => store.error);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [inactive, setInactive] = useState<ProductoRow[]>([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductoRow | null>(null);

  const loadInactive = useCallback(async () => {
    if (!kioscoId) return;
    setInactiveLoading(true);
    const { data, error } = await supabase
      .from('productos')
      .select(PRODUCT_COLUMNS)
      .eq('kiosco_id', kioscoId)
      .eq('activo', false)
      .order('nombre', { ascending: true })
      .limit(500);

    setInactiveLoading(false);
    if (error) {
      setLocalError(getErrorMessage(error));
      return;
    }
    setInactive(data ?? []);
  }, [kioscoId]);

  useEffect(() => {
    if (showInactive) void loadInactive();
  }, [loadInactive, showInactive]);

  const allItems = useMemo(() => {
    if (!showInactive) return activeItems;

    const byId = new Map<string, ProductoRow>();
    for (const item of activeItems) byId.set(item.id, item);
    for (const item of inactive) byId.set(item.id, item);

    return Array.from(byId.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [activeItems, inactive, showInactive]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of allItems) {
      const key = categoryOf(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [
      { value: 'all', label: 'Todas', count: allItems.length },
      ...Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'es'))
        .map(([value, count]) => ({ value, label: value, count })),
    ];
  }, [allItems]);

  const filtered = useMemo(() => {
    const search = normalizeText(query);
    const byCategory = category === 'all' ? allItems : allItems.filter((item) => categoryOf(item) === category);

    if (!search) return byCategory;

    return byCategory.filter((item) =>
      normalizeText(
        `${item.nombre} ${item.codigo_barras ?? ''} ${item.sku ?? ''} ${item.categoria ?? ''}`,
      ).includes(search),
    );
  }, [allItems, category, query]);

  const sinStock = activeItems.filter((item) => item.stock <= 0).length;
  const stockBajo = activeItems.filter((item) => item.stock > 0 && item.stock <= item.stock_minimo).length;

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (producto: ProductoRow) => {
    setEditing(producto);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSaved = (producto: ProductoRow) => {
    // upsert() quita del catálogo los productos con activo = false.
    useCatalogStore.getState().upsert(producto);
    setInactive((prev) => {
      const rest = prev.filter((item) => item.id !== producto.id);
      return producto.activo ? rest : [producto, ...rest];
    });
    setLocalError(null);
    closeForm();
  };

  if (!kiosco) {
    return (
      <Screen>
        <PageHeader title="Productos" />
        <EmptyState
          icon={<Feather name="package" size={24} color={palette.muted} />}
          title="Todavía no hay un kiosco"
          description="Creá tu kiosco desde Ajustes para cargar el catálogo."
          action={<Button label="Ir a Ajustes" onPress={() => router.push('/ajustes')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="Catálogo"
        title="Productos"
        subtitle="Stock, precios y códigos de barras del kiosco."
        actions={
          <Button
            label="Nuevo producto"
            onPress={openNew}
            icon={<Feather name="plus" size={15} color={palette.primaryFg} />}
          />
        }
      />

      <View className="mb-4 flex-row flex-wrap gap-2">
        <Stat label="Activos" value={String(activeItems.length)} className="min-w-[120px]" />
        <Stat
          label="Sin stock"
          value={String(sinStock)}
          tone={sinStock > 0 ? 'danger' : 'default'}
          className="min-w-[120px]"
        />
        <Stat
          label="Stock bajo"
          value={String(stockBajo)}
          tone={stockBajo > 0 ? 'accent' : 'default'}
          className="min-w-[120px]"
        />
      </View>

      {catalogError ? (
        <Banner tone="danger" title="No pudimos cargar el catálogo" className="mb-3">
          {catalogError}
        </Banner>
      ) : null}

      {localError ? (
        <Banner
          tone="danger"
          title="Ocurrió un error"
          className="mb-3"
          action={<Button label="Cerrar" size="sm" variant="secondary" onPress={() => setLocalError(null)} />}
        >
          {localError}
        </Banner>
      ) : null}

      <Card className="mb-4 gap-3">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre, código, SKU o categoría…"
          autoCorrect={false}
          returnKeyType="search"
          right={<Feather name="search" size={16} color={palette.muted} />}
        />

        <Segmented options={categories} value={category} onChange={setCategory} />

        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="font-body text-2xs text-muted">
            {filtered.length} de {allItems.length} productos
          </Text>
          <Button
            label={showInactive ? 'Ocultar bajas' : 'Incluir bajas'}
            variant="ghost"
            size="sm"
            onPress={() => setShowInactive((value) => !value)}
            icon={
              <Feather
                name={showInactive ? 'eye-off' : 'eye'}
                size={14}
                color={palette.muted}
              />
            }
          />
        </View>

        {showInactive && inactiveLoading ? <Spinner compact label="Cargando productos dados de baja…" /> : null}
      </Card>

      {loading && activeItems.length === 0 ? (
        <Spinner label="Cargando productos…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Feather name="package" size={24} color={palette.muted} />}
          title={allItems.length === 0 ? 'Todavía no cargaste productos' : 'No encontramos resultados'}
          description={
            allItems.length === 0
              ? 'Cargá el primer producto para empezar a vender en la caja.'
              : 'Probá con otra búsqueda, categoría o incluí los productos dados de baja.'
          }
          action={
            allItems.length === 0 ? (
              <Button
                label="Cargar primer producto"
                onPress={openNew}
                icon={<Feather name="plus" size={15} color={palette.primaryFg} />}
              />
            ) : undefined
          }
        />
      ) : (
        <View className="gap-2">
          {filtered.map((producto) => {
            const stockTone =
              producto.stock <= 0 ? 'danger' : producto.stock <= producto.stock_minimo ? 'accent' : 'primary';

            return (
              <Pressable
                key={producto.id}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${producto.nombre}`}
                onPress={() => openEdit(producto)}
                style={({ pressed }) => [pixelShadow(3), pressed ? pixelPressed(3) : undefined]}
                className="flex-row items-center gap-3 rounded-none border-[3px] border-black bg-elevated px-2.5 py-2"
              >
                <View className="h-9 w-9 items-center justify-center border-2 border-black bg-accent">
                  <Feather name="box" size={16} color={palette.ink} />
                </View>

                <View className="flex-1 gap-0.5">
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    <Text className="font-body-semibold text-sm text-fg" numberOfLines={1}>
                      {producto.nombre}
                    </Text>
                    {!producto.activo ? <Badge tone="muted">Baja</Badge> : null}
                  </View>
                  <Text className="font-mono text-2xs text-muted" numberOfLines={1}>
                    {producto.codigo_barras ?? producto.sku ?? 'Sin código'}
                    {producto.categoria ? ` · ${producto.categoria}` : ''}
                  </Text>
                </View>

                <View className="items-end gap-1">
                  <Money value={producto.precio_venta} currency={currency} size="sm" />
                  <Badge tone={stockTone}>{`${producto.stock} u.`}</Badge>
                </View>

                <Feather name="chevron-right" size={16} color={palette.muted} />
              </Pressable>
            );
          })}
        </View>
      )}

      <ProductFormModal
        visible={formOpen}
        producto={editing}
        kioscoId={kiosco.id}
        currency={currency}
        onClose={closeForm}
        onSaved={handleSaved}
      />
    </Screen>
  );
}
