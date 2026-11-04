# Gestor Kioscos

POS universal para kioscos, construido con **Expo SDK 58 + React Native + Supabase**. Funciona en
celular, tablet y PC desde el mismo código: barra inferior en mobile y sidebar en escritorio, con
una interfaz retro/pixel-art consistente.

## Qué incluye

- **Caja (POS)** con búsqueda, categorías, carrito persistente, controles `[+]` / `[-]`, descuentos,
  medios de pago, vuelto y venta **fiada** a un cliente del cuaderno.
- **Productos** con alta/edición, baja lógica, ajuste de stock auditado, alertas de stock mínimo y
  autocompletado por código de barras con **OpenFoodFacts**.
- **Cuaderno**: clientes, fiados, proveedores y pedidos por **WhatsApp** con los productos en stock
  seleccionados en un solo mensaje.
- **Estadísticas** calculadas en el servidor: períodos y comparación con el anterior, KPIs,
  evolución, calendario de calor, horas/días, rankings, rentabilidad, categorías, medios de pago,
  combos, vendedores, pérdidas, precios, salud de stock, predicción de agotamiento y
  recomendaciones de compra.
- **Turnos**: apertura, resumen en vivo, cierre con diferencia de efectivo e historial.
- **Escáner remoto** dentro de **Ajustes**: la cámara del celular agrega productos al carrito de la
  PC por Supabase Realtime.
- **Ajustes**: kioscos, cuenta, conexión a Supabase y estado del escáner.
- Multi-kiosco por cuenta, RLS en todas las tablas y canales Realtime privados.

## Stack

| Capa | Tecnología |
| --- | --- |
| App | Expo SDK 58, Expo Router, React 19, React Native 0.88 |
| Estilos | NativeWind 4 + Tailwind 3 (tema retro claro) |
| Tipografías | Press Start 2P, Geist y JetBrains Mono |
| Estado | Zustand + AsyncStorage |
| Backend | Supabase Auth, PostgreSQL, RLS y Realtime |
| Tests | `node:test` vía `tsx` |

## Requisitos

- Node.js 20 o superior.
- Una cuenta y un proyecto de [Supabase](https://supabase.com).
- Para builds nativos: Android Studio o Xcode, o EAS Build.

## Configuración

1. Instalá las dependencias:

   ```bash
   npm install
   ```

2. Copiá `.env.example` a `.env` y completá las claves públicas del proyecto
   (Supabase → **Project Settings → API**):

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-publica
   ```

3. Ejecutá las migraciones en el **SQL Editor** de Supabase, en este orden:

   ```text
   supabase/migrations/20261031000000_schema.sql
   supabase/migrations/20261031000100_realtime_scanner.sql
   supabase/migrations/20261031000200_scanner_sesiones.sql
   supabase/migrations/20261031000300_reportes.sql
   supabase/migrations/20261104000000_cuaderno.sql
   supabase/migrations/20261104000100_estadisticas.sql
   ```

4. En Supabase → **Realtime → Settings**, desactivá **Allow public access**. Los canales del
   escáner son privados y usan RLS con el JWT del usuario.

5. Habilitá el proveedor **Email** en Authentication. Si no querés confirmar emails en desarrollo,
   desactivá **Confirm email** en Authentication → Providers.

6. Reiniciá el servidor después de crear `.env` (las variables `EXPO_PUBLIC_*` se inlinean en el
   bundle):

   ```bash
   npx expo start --clear
   ```

## Comandos

```bash
npx expo start            # servidor de desarrollo
npx expo start --web      # abrir en el navegador
npx expo run:android      # build nativo local
npx expo run:ios          # build nativo local (macOS)
npm run test              # tests de la lógica del escáner
npm run typecheck         # tsc --noEmit
npm run lint              # expo lint
npm run export:web        # export estático de la app web
```

Usá siempre `npx expo install <paquete>` para agregar dependencias nativas: resuelve la versión
compatible con el SDK.

## Estructura

```text
src/
  app/                 rutas de Expo Router
    (auth)/            login y registro
    (app)/             POS, productos, cuaderno, estadísticas, turno y ajustes
  components/
    escaner/           panel de escáner remoto (dentro de Ajustes)
    estadisticas/      gráficos y mapa de calor
    layout/            sidebar y barra inferior adaptativa
    pos/               carrito, picker, pairing y caja
    productos/         formulario de producto
    ui/                kit de componentes retro
  hooks/               sincronización del escáner y datos del kiosco
  lib/                 Supabase, tipos, formato, tema, estadísticas y lógica pura
  stores/              Zustand: auth, kiosco, catálogo, carrito, caja, cuaderno y pairing
supabase/migrations/   esquema, Realtime, cuaderno y RPCs de estadísticas
```

## Cuaderno y fiado

- Los contactos viven en `cuaderno_contactos` (`cliente` o `proveedor`) y se dan de baja de forma
  lógica para conservar el historial.
- El saldo de un cliente sólo cambia con `registrar_movimiento_cuaderno` (fiado o pago). No se
  edita desde el formulario del contacto.
- Una venta fiada se guarda con `metodo_pago = 'otro'`, `cliente_id` y `es_fiado = true`; el
  resumen de caja la muestra como **Fiado** y el saldo del cliente se actualiza en la misma
  transacción.
- Desde un proveedor podés elegir productos con stock y abrir WhatsApp con el pedido ya armado
  (`whatsapp://send?phone=...&text=...`).

## Estadísticas

La pantalla **Estadísticas** usa una única RPC, `estadisticas_negocio`, que devuelve JSON agregado
para el período y su comparación. El frontend no descarga ventas ni calcula totales en memoria.

- Períodos: hoy, ayer, 7/30 días, semana, semana pasada, mes, mes pasado, año y rango
  personalizado.
- La comparación se hace contra el período inmediatamente anterior (o la ventana equivalente en
  rangos personalizados).
- La predicción de stock usa las ventas de los últimos 30 días, independientemente del período
  elegido, para que no cambie de escala.
- Las alertas e insights se generan en TypeScript a partir de los datos reales; no hay datos de
  ejemplo.
- Los gráficos se dibujan con Views y `boxShadow`, sin dependencias extra.

## Cómo funciona el escáner remoto

1. La PC abre **Caja → Escáner** y activa la vinculación. Se crea una sesión en
   `scanner_sesiones` con un código de 6 caracteres y vencimiento.
2. El celular abre **Ajustes → Escáner remoto**, escribe el código y resuelve el UUID del kiosco
   con una RPC. El celular nunca recibe ni escribe el UUID directamente.
3. Ambos se suscriben al canal privado `kiosco:<uuid>:scanner:<codigo>`.
4. Cada lectura viaja como broadcast `barcode`. La PC valida, agrega al carrito y responde con
   `scan-ack`; el celular muestra el resultado y vibra.
5. Hay un cooldown de 1200 ms **por código** en ambos lados para evitar dobles lecturas sin frenar
   ráfagas de productos distintos.

La PC y el celular son independientes: si la PC se apaga, el celular puede seguir vendiendo y
consultando stock; sólo se pausa el escaneo remoto.

## Diseño retro

- Fondo crema `#F5E6C8`, ventanas celestes `#D1E5F0`, barras de título azules `#4A90E2` y bordes
  negros de 3–4 px con sombras duras.
- Botones verdes, naranjas, rosas y amarillos; al presionarlos pierden la sombra y se desplazan.
- Press Start 2P para títulos, botones y KPIs; Geist para cuerpo y JetBrains Mono para números.
- Todos los componentes del kit comparten la misma escala, bordes y estados vacíos.

## Notas de despliegue

- `ios/` y `android/` no se versionan: se generan con Continuous Native Generation desde `app.json`
  y los config plugins.
- La app usa cámara (`expo-camera`); para un build de producción usá `eas build` o
  `npx expo run:android|ios`. Expo Go sirve para desarrollo.
- La `anon key` es pública por diseño. La seguridad real vive en las políticas RLS y en las RPCs
  `security definer` del esquema.
