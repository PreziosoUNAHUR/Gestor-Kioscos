# Gestor Kioscos

POS universal para kioscos, construido con **Expo SDK 58 + React Native + Supabase**. Funciona en
celular, tablet y PC desde el mismo código: barra inferior en mobile y sidebar en escritorio.

## Qué incluye

- **Caja (POS)** con búsqueda, categorías, carrito persistente, descuentos, medios de pago y vuelto.
- **Productos** con alta/edición, baja lógica, ajuste de stock auditado y alertas de stock mínimo.
- **Escáner remoto**: la cámara del celular agrega productos al carrito de la PC por Supabase Realtime.
- **Turnos**: apertura, resumen en vivo, cierre con diferencia de efectivo e historial.
- **Reportes** calculados en el servidor (hoy / 7 días / 30 días).
- **Ajustes**: kioscos, cuenta, conexión a Supabase y estado del escáner.
- Multi-kiosco por cuenta, RLS en todas las tablas y canales Realtime privados.

## Stack

| Capa | Tecnología |
| --- | --- |
| App | Expo SDK 58, Expo Router, React 19, React Native 0.88 |
| Estilos | NativeWind 4 + Tailwind 3 (tema oscuro por defecto) |
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
    (app)/             POS, productos, escáner, reportes, turno y ajustes
  components/
    layout/            sidebar y barra inferior adaptativa
    pos/               carrito, picker, pairing y caja
    productos/         formulario de producto
    ui/                kit de componentes
  hooks/               sincronización del escáner y datos del kiosco
  lib/                 Supabase, tipos, formato, tema y lógica pura
  stores/              Zustand: auth, kiosco, catálogo, carrito, caja y pairing
supabase/migrations/   esquema, Realtime y RPCs
```

## Cómo funciona el escáner remoto

1. La PC abre **Caja → Escáner** y activa la vinculación. Se crea una sesión en
   `scanner_sesiones` con un código de 6 caracteres y vencimiento.
2. El celular abre **Escáner**, escribe el código y resuelve el UUID del kiosco con una RPC. El
   celular nunca recibe ni escribe el UUID directamente.
3. Ambos se suscriben al canal privado `kiosco:<uuid>:scanner:<codigo>`.
4. Cada lectura viaja como broadcast `barcode`. La PC valida, agrega al carrito y responde con
   `scan-ack`; el celular muestra el resultado y vibra.
5. Hay un cooldown de 1200 ms **por código** en ambos lados para evitar dobles lecturas sin frenar
   ráfagas de productos distintos.

La PC y el celular son independientes: si la PC se apaga, el celular puede seguir vendiendo y
consultando stock; sólo se pausa el escaneo remoto.

## Notas de despliegue

- `ios/` y `android/` no se versionan: se generan con Continuous Native Generation desde `app.json`
  y los config plugins.
- La app usa cámara (`expo-camera`); para un build de producción usá `eas build` o
  `npx expo run:android|ios`. Expo Go sirve para desarrollo.
- La `anon key` es pública por diseño. La seguridad real vive en las políticas RLS y en las RPCs
  `security definer` del esquema.
