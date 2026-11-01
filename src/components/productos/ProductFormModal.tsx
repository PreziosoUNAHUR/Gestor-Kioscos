import { useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { ProductoRow } from '@/lib/database.types';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, parseMoneyInput } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

const PRODUCT_COLUMNS =
  'id,kiosco_id,codigo_barras,sku,nombre,categoria,precio_costo,precio_venta,stock,stock_minimo,activo,imagen_url,created_at,updated_at';

type ProductFormModalProps = {
  visible: boolean;
  producto: ProductoRow | null;
  kioscoId: string;
  currency?: string;
  onClose: () => void;
  onSaved: (producto: ProductoRow) => void;
};

/** Los campos de stock son enteros: "1.000" debe leerse como mil, no como uno. */
function parseIntegerInput(text: string): number {
  const cleaned = text.replace(/[^\d-]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

export function ProductFormModal({
  visible,
  producto,
  kioscoId,
  currency = 'ARS',
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [sku, setSku] = useState('');
  const [categoria, setCategoria] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [precioCosto, setPrecioCosto] = useState('');
  const [stock, setStock] = useState('0');
  const [stockMinimo, setStockMinimo] = useState('5');
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmBaja, setConfirmBaja] = useState(false);

  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      loadedKeyRef.current = null;
      return;
    }

    // Sólo inicializamos al abrir (o al cambiar de producto). Si Realtime
    // actualiza el stock mientras editamos, no pisamos lo que escribió el usuario.
    const key = producto?.id ?? 'nuevo';
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;

    setError(null);
    setLoading(false);
    setConfirmBaja(false);

    if (producto) {
      setNombre(producto.nombre);
      setCodigo(producto.codigo_barras ?? '');
      setSku(producto.sku ?? '');
      setCategoria(producto.categoria ?? '');
      setPrecioVenta(String(Number(producto.precio_venta)));
      setPrecioCosto(String(Number(producto.precio_costo)));
      setStock(String(producto.stock));
      setStockMinimo(String(producto.stock_minimo));
      setActivo(producto.activo);
    } else {
      setNombre('');
      setCodigo('');
      setSku('');
      setCategoria('');
      setPrecioVenta('');
      setPrecioCosto('');
      setStock('0');
      setStockMinimo('5');
      setActivo(true);
    }
  }, [producto, visible]);

  const submit = async () => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    const venta = Math.max(0, parseMoneyInput(precioVenta));
    const costo = Math.max(0, parseMoneyInput(precioCosto));
    const stockNum = parseIntegerInput(stock);
    const minimo = Math.max(0, parseIntegerInput(stockMinimo));

    setLoading(true);
    setError(null);

    try {
      if (!producto) {
        const { data, error: insertError } = await supabase
          .from('productos')
          .insert({
            kiosco_id: kioscoId,
            nombre: nombre.trim(),
            codigo_barras: codigo.trim() || null,
            sku: sku.trim() || null,
            categoria: categoria.trim() || null,
            precio_costo: costo,
            precio_venta: venta,
            stock: stockNum,
            stock_minimo: minimo,
            activo: true,
          })
          .select(PRODUCT_COLUMNS)
          .single();

        if (insertError) throw insertError;
        if (!data) throw new Error('No se pudo crear el producto.');
        onSaved(data);
        return;
      }

      const { data, error: updateError } = await supabase
        .from('productos')
        .update({
          nombre: nombre.trim(),
          codigo_barras: codigo.trim() || null,
          sku: sku.trim() || null,
          categoria: categoria.trim() || null,
          precio_costo: costo,
          precio_venta: venta,
          stock_minimo: minimo,
          activo,
        })
        .eq('id', producto.id)
        .select(PRODUCT_COLUMNS)
        .single();

      if (updateError) throw updateError;
      if (!data) throw new Error('No se pudo guardar el producto.');

      let saved = data;

      // `stock` no es editable por UPDATE (permiso por columna): va por RPC para
      // que quede registrado en el kardex.
      if (stockNum !== producto.stock) {
        const { data: adjusted, error: stockError } = await supabase.rpc('ajustar_stock', {
          p_producto_id: producto.id,
          p_stock_nuevo: stockNum,
          p_motivo: 'Ajuste manual desde Productos',
        });
        if (stockError) throw stockError;
        if (adjusted) saved = adjusted;
      }

      onSaved(saved);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  const darDeBaja = async () => {
    if (!producto) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: bajaError } = await supabase
        .from('productos')
        .update({ activo: false })
        .eq('id', producto.id)
        .select(PRODUCT_COLUMNS)
        .single();

      if (bajaError) throw bajaError;
      if (!data) throw new Error('No se pudo dar de baja el producto.');
      onSaved(data);
    } catch (bajaError) {
      setError(getErrorMessage(bajaError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={producto ? 'Editar producto' : 'Nuevo producto'}
      subtitle={producto ? 'Los cambios se sincronizan con la caja al instante.' : 'Cargá los datos para empezar a venderlo.'}
      size="md"
      footer={
        <View className="gap-2">
          {producto && producto.activo ? (
            confirmBaja ? (
              <Banner
                tone="danger"
                title="¿Dar de baja el producto?"
                action={
                  <View className="flex-row gap-2">
                    <Button
                      label="Cancelar"
                      size="sm"
                      variant="secondary"
                      onPress={() => setConfirmBaja(false)}
                    />
                    <Button
                      label="Confirmar"
                      size="sm"
                      variant="danger"
                      onPress={() => void darDeBaja()}
                      loading={loading}
                    />
                  </View>
                }
              >
                Deja de aparecer en la caja. El historial de ventas se conserva.
              </Banner>
            ) : (
              <Button
                label="Dar de baja"
                variant="ghost"
                onPress={() => setConfirmBaja(true)}
                icon={<Feather name="trash-2" size={14} color={palette.dangerInk} />}
              />
            )
          ) : null}

          <View className="flex-row gap-2">
            <Button label="Cancelar" variant="secondary" onPress={onClose} className="flex-1" />
            <Button
              label={producto ? 'Guardar cambios' : 'Crear producto'}
              onPress={() => void submit()}
              loading={loading}
              className="flex-1"
            />
          </View>
        </View>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Input
        label="Nombre"
        value={nombre}
        onChangeText={setNombre}
        placeholder="Coca-Cola 500 ml"
        maxLength={120}
        autoFocus={!producto}
        returnKeyType="next"
      />

      <View className="flex-row gap-3">
        <Input
          label="Código de barras"
          value={codigo}
          onChangeText={setCodigo}
          placeholder="7790895000017"
          autoCapitalize="none"
          autoCorrect={false}
          containerClassName="flex-1"
          inputClassName="font-mono"
        />
        <Input
          label="SKU"
          value={sku}
          onChangeText={setSku}
          placeholder="Opcional"
          autoCapitalize="characters"
          autoCorrect={false}
          containerClassName="flex-1"
          inputClassName="font-mono"
        />
      </View>

      <Input
        label="Categoría"
        value={categoria}
        onChangeText={setCategoria}
        placeholder="Bebidas, Golosinas, Almacén…"
        maxLength={60}
      />

      <View className="flex-row gap-3">
        <Input
          label="Precio de venta"
          value={precioVenta}
          onChangeText={setPrecioVenta}
          placeholder="0,00"
          keyboardType="decimal-pad"
          containerClassName="flex-1"
          hint={precioVenta ? formatMoney(parseMoneyInput(precioVenta), currency) : undefined}
        />
        <Input
          label="Precio de costo"
          value={precioCosto}
          onChangeText={setPrecioCosto}
          placeholder="0,00"
          keyboardType="decimal-pad"
          containerClassName="flex-1"
          hint="Para calcular la ganancia."
        />
      </View>

      <View className="flex-row gap-3">
        <Input
          label="Stock"
          value={stock}
          onChangeText={setStock}
          placeholder="0"
          keyboardType="number-pad"
          containerClassName="flex-1"
          hint="Se ajusta por RPC y queda en el kardex."
        />
        <Input
          label="Stock mínimo"
          value={stockMinimo}
          onChangeText={setStockMinimo}
          placeholder="5"
          keyboardType="number-pad"
          containerClassName="flex-1"
          hint="Alerta de reposición."
        />
      </View>

      {producto ? (
        <View className="flex-row items-center justify-between gap-3 rounded-xl border border-line bg-bg/40 px-3 py-2.5">
          <View className="flex-1">
            <Text className="font-body-medium text-sm text-fg">Producto activo</Text>
            <Text className="font-body text-2xs text-muted">
              Si lo desactivás, no aparece en la caja ni en el escáner.
            </Text>
          </View>
          <Switch
            value={activo}
            onValueChange={setActivo}
            trackColor={{ false: palette.elevated, true: palette.primary }}
            thumbColor={palette.fg}
          />
        </View>
      ) : null}
    </Modal>
  );
}
