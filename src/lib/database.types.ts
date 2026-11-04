/**
 * Tipos del esquema público de Supabase (escritos a mano, equivalentes a
 * `supabase gen types typescript`). Se actualizan junto con las migraciones.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RolMiembro = 'owner' | 'admin' | 'cajero';
export type MetodoPago = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'qr' | 'otro';
export type EstadoVenta = 'completada' | 'anulada';
export type EstadoCaja = 'abierta' | 'cerrada';
export type TipoMovStock = 'inicial' | 'venta' | 'anulacion' | 'compra' | 'ajuste';
export type TipoCuaderno = 'cliente' | 'proveedor';
export type TipoMovCuaderno = 'cargo' | 'pago' | 'ajuste';

export type KioscoRow = {
  id: string;
  nombre: string;
  moneda: string;
  zona_horaria: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MiembroRow = {
  kiosco_id: string;
  user_id: string;
  rol: RolMiembro;
  created_at: string;
};

export type ProductoRow = {
  id: string;
  kiosco_id: string;
  codigo_barras: string | null;
  sku: string | null;
  nombre: string;
  categoria: string | null;
  precio_costo: number;
  precio_venta: number;
  stock: number;
  stock_minimo: number;
  activo: boolean;
  imagen_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CajaRow = {
  id: string;
  kiosco_id: string;
  estado: EstadoCaja;
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_inicial: number;
  efectivo_esperado: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  resumen: Json | null;
  notas_cierre: string | null;
  abierta_por: string | null;
  cerrada_por: string | null;
  created_at: string;
};

export type VentaRow = {
  id: string;
  kiosco_id: string;
  caja_id: string;
  numero: number;
  fecha: string;
  subtotal: number;
  descuento: number;
  total: number;
  metodo_pago: MetodoPago;
  monto_recibido: number | null;
  vuelto: number | null;
  estado: EstadoVenta;
  anulada_at: string | null;
  anulada_por: string | null;
  motivo_anulacion: string | null;
  usuario_id: string | null;
  notas: string | null;
  cliente_id: string | null;
  es_fiado: boolean;
  created_at: string;
};

export type CuadernoContactoRow = {
  id: string;
  kiosco_id: string;
  tipo: TipoCuaderno;
  nombre: string;
  telefono: string | null;
  saldo_fiado: number;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CuadernoMovimientoRow = {
  id: string;
  kiosco_id: string;
  contacto_id: string;
  tipo: TipoMovCuaderno;
  monto: number;
  descripcion: string | null;
  venta_id: string | null;
  usuario_id: string | null;
  created_at: string;
};

export type VentaItemRow = {
  id: string;
  venta_id: string;
  kiosco_id: string;
  producto_id: string | null;
  nombre: string;
  codigo_barras: string | null;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  subtotal: number;
};

export type CompraRow = {
  id: string;
  kiosco_id: string;
  caja_id: string | null;
  fecha: string;
  proveedor: string | null;
  comprobante: string | null;
  metodo_pago: MetodoPago;
  total: number;
  notas: string | null;
  usuario_id: string | null;
  created_at: string;
};

export type CompraItemRow = {
  id: string;
  compra_id: string;
  kiosco_id: string;
  producto_id: string | null;
  nombre: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
};

export type GastoRow = {
  id: string;
  kiosco_id: string;
  caja_id: string | null;
  fecha: string;
  categoria: string;
  concepto: string;
  monto: number;
  metodo_pago: MetodoPago;
  comprobante: string | null;
  notas: string | null;
  usuario_id: string | null;
  created_at: string;
};

export type MovimientoStockRow = {
  id: string;
  kiosco_id: string;
  producto_id: string;
  tipo: TipoMovStock;
  cantidad: number;
  stock_resultante: number;
  referencia_id: string | null;
  motivo: string | null;
  usuario_id: string | null;
  created_at: string;
};

export type ScannerSesionRow = {
  id: string;
  kiosco_id: string;
  codigo: string;
  activa: boolean;
  expira_at: string;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      kioscos: Table<
        KioscoRow,
        {
          id?: string;
          nombre: string;
          moneda?: string;
          zona_horaria?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<{
          nombre: string;
          moneda: string;
          zona_horaria: string;
        }>
      >;
      kiosco_miembros: Table<
        MiembroRow,
        { kiosco_id: string; user_id: string; rol?: RolMiembro; created_at?: string },
        Partial<{ rol: RolMiembro }>
      >;
      productos: Table<
        ProductoRow,
        {
          id?: string;
          kiosco_id: string;
          codigo_barras?: string | null;
          sku?: string | null;
          nombre: string;
          categoria?: string | null;
          precio_costo?: number;
          precio_venta: number;
          stock?: number;
          stock_minimo?: number;
          activo?: boolean;
          imagen_url?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<{
          codigo_barras: string | null;
          sku: string | null;
          nombre: string;
          categoria: string | null;
          precio_costo: number;
          precio_venta: number;
          stock_minimo: number;
          activo: boolean;
          imagen_url: string | null;
        }>
      >;
      cajas: Table<
        CajaRow,
        {
          id?: string;
          kiosco_id: string;
          estado?: EstadoCaja;
          fecha_apertura?: string;
          fecha_cierre?: string | null;
          monto_inicial?: number;
          efectivo_esperado?: number | null;
          efectivo_contado?: number | null;
          diferencia?: number | null;
          resumen?: Json | null;
          notas_cierre?: string | null;
          abierta_por?: string | null;
          cerrada_por?: string | null;
          created_at?: string;
        },
        Partial<{
          estado: EstadoCaja;
          fecha_cierre: string | null;
          efectivo_esperado: number | null;
          efectivo_contado: number | null;
          diferencia: number | null;
          resumen: Json | null;
          notas_cierre: string | null;
          cerrada_por: string | null;
        }>
      >;
      ventas: Table<
        VentaRow,
        {
          id?: string;
          kiosco_id: string;
          caja_id: string;
          numero: number;
          fecha?: string;
          subtotal: number;
          descuento?: number;
          total: number;
          metodo_pago?: MetodoPago;
          monto_recibido?: number | null;
          vuelto?: number | null;
          estado?: EstadoVenta;
          anulada_at?: string | null;
          anulada_por?: string | null;
          motivo_anulacion?: string | null;
          usuario_id?: string | null;
          notas?: string | null;
          cliente_id?: string | null;
          es_fiado?: boolean;
          created_at?: string;
        },
        Partial<{
          estado: EstadoVenta;
          anulada_at: string | null;
          anulada_por: string | null;
          motivo_anulacion: string | null;
          cliente_id: string | null;
          es_fiado: boolean;
        }>
      >;
      venta_items: Table<
        VentaItemRow,
        {
          id?: string;
          venta_id: string;
          kiosco_id: string;
          producto_id?: string | null;
          nombre: string;
          codigo_barras?: string | null;
          cantidad: number;
          precio_unitario: number;
          costo_unitario?: number;
        },
        Partial<{ cantidad: number }>
      >;
      compras: Table<
        CompraRow,
        {
          id?: string;
          kiosco_id: string;
          caja_id?: string | null;
          fecha?: string;
          proveedor?: string | null;
          comprobante?: string | null;
          metodo_pago?: MetodoPago;
          total: number;
          notas?: string | null;
          usuario_id?: string | null;
          created_at?: string;
        },
        Partial<{ notas: string | null }>
      >;
      compra_items: Table<
        CompraItemRow,
        {
          id?: string;
          compra_id: string;
          kiosco_id: string;
          producto_id?: string | null;
          nombre: string;
          cantidad: number;
          costo_unitario: number;
        },
        Partial<{ cantidad: number }>
      >;
      gastos: Table<
        GastoRow,
        {
          id?: string;
          kiosco_id: string;
          caja_id?: string | null;
          fecha?: string;
          categoria?: string;
          concepto: string;
          monto: number;
          metodo_pago?: MetodoPago;
          comprobante?: string | null;
          notas?: string | null;
          usuario_id?: string | null;
          created_at?: string;
        },
        Partial<{
          fecha: string;
          categoria: string;
          concepto: string;
          monto: number;
          metodo_pago: MetodoPago;
          comprobante: string | null;
          notas: string | null;
        }>
      >;
      movimientos_stock: Table<
        MovimientoStockRow,
        {
          id?: string;
          kiosco_id: string;
          producto_id: string;
          tipo: TipoMovStock;
          cantidad: number;
          stock_resultante: number;
          referencia_id?: string | null;
          motivo?: string | null;
          usuario_id?: string | null;
          created_at?: string;
        },
        never
      >;
      scanner_sesiones: Table<
        ScannerSesionRow,
        {
          id?: string;
          kiosco_id: string;
          codigo: string;
          activa?: boolean;
          expira_at?: string;
          created_by?: string | null;
          created_at?: string;
          revoked_at?: string | null;
        },
        Partial<{ activa: boolean; revoked_at: string | null }>
      >;
      cuaderno_contactos: Table<
        CuadernoContactoRow,
        {
          id?: string;
          kiosco_id: string;
          tipo: TipoCuaderno;
          nombre: string;
          telefono?: string | null;
          saldo_fiado?: number;
          notas?: string | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        Partial<{
          nombre: string;
          telefono: string | null;
          saldo_fiado: number;
          notas: string | null;
          activo: boolean;
        }>
      >;
      cuaderno_movimientos: Table<
        CuadernoMovimientoRow,
        {
          id?: string;
          kiosco_id: string;
          contacto_id: string;
          tipo: TipoMovCuaderno;
          monto: number;
          descripcion?: string | null;
          venta_id?: string | null;
          usuario_id?: string | null;
          created_at?: string;
        },
        never
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      crear_kiosco: {
        Args: { p_nombre: string; p_moneda?: string; p_zona_horaria?: string };
        Returns: KioscoRow;
      };
      abrir_caja: {
        Args: { p_kiosco_id: string; p_monto_inicial?: number };
        Returns: CajaRow;
      };
      cerrar_caja: {
        Args: { p_caja_id: string; p_efectivo_contado: number; p_notas?: string | null };
        Returns: CajaRow;
      };
      resumen_caja: {
        Args: { p_caja_id: string };
        Returns: Json;
      };
      resumen_ventas: {
        Args: { p_kiosco_id: string; p_desde: string; p_hasta: string };
        Returns: Json;
      };
      registrar_venta: {
        Args: {
          p_kiosco_id: string;
          p_items: Json;
          p_metodo_pago?: MetodoPago;
          p_descuento?: number;
          p_monto_recibido?: number | null;
          p_notas?: string | null;
          p_cliente_id?: string | null;
        };
        Returns: VentaRow;
      };
      registrar_movimiento_cuaderno: {
        Args: {
          p_contacto_id: string;
          p_tipo: TipoMovCuaderno;
          p_monto: number;
          p_descripcion?: string | null;
        };
        Returns: CuadernoContactoRow;
      };
      estadisticas_negocio: {
        Args: {
          p_kiosco_id: string;
          p_desde: string;
          p_hasta: string;
          p_comp_desde?: string | null;
          p_comp_hasta?: string | null;
          p_dias_stock?: number;
        };
        Returns: Json;
      };
      anular_venta: {
        Args: { p_venta_id: string; p_motivo: string };
        Returns: VentaRow;
      };
      ajustar_stock: {
        Args: { p_producto_id: string; p_stock_nuevo: number; p_motivo?: string | null };
        Returns: ProductoRow;
      };
      abrir_sesion_scanner: {
        Args: { p_kiosco_id: string };
        Returns: ScannerSesionRow;
      };
      resolver_sesion_scanner: {
        Args: { p_codigo: string };
        Returns: string | null;
      };
      cerrar_sesion_scanner: {
        Args: { p_kiosco_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      rol_miembro: RolMiembro;
      metodo_pago: MetodoPago;
      estado_venta: EstadoVenta;
      estado_caja: EstadoCaja;
      tipo_mov_stock: TipoMovStock;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
