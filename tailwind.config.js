/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

/* -------------------------------------------------------------------------- */
/*  Gestor Kioscos · sistema de diseño                                         */
/*                                                                             */
/*  - Dark mode por defecto. El tema claro existe SOLO para reportes: se       */
/*    activa envolviendo el reporte en <ReportTheme> (clase `.theme-light`).   */
/*  - Colores como variables CSS en canales "R G B" para que Tailwind pueda    */
/*    aplicar opacidad (bg-primary/15). Glass y bordes son rgba() completos.   */
/*  - Los componentes NUNCA usan hex: sólo estos tokens (theme.colors se       */
/*    reemplaza por completo, no se extiende la paleta por defecto).           */
/*                                                                             */
/*  Contraste medido (WCAG 2.2, texto normal ≥ 4.5:1):                         */
/*   fg / bg 17.7 · muted / bg 7.2 · muted / surface 6.5 · primary / bg 7.3    */
/*   accent / bg 8.6 · primary-fg sobre primary 7.3 · danger-ink / glass 5.9   */
/*   (#EF4444 puro da 4.4 sobre glass: sólo para rellenos, bordes e íconos;    */
/*    el texto de peligro usa `danger-ink` #F87171).                           */
/* -------------------------------------------------------------------------- */

const themes = {
  dark: {
    '--color-bg': '15 20 25', //          #0F1419 carbón casi negro
    '--color-surface': '26 31 38', //     #1A1F26 superficies sólidas
    '--color-elevated': '35 42 51', //    #232A33 hover / popovers
    '--color-fg': '248 250 252', //       #F8FAFC texto principal
    '--color-muted': '148 163 184', //    #94A3B8 texto secundario
    '--color-primary': '16 185 129', //   #10B981 verde menta
    '--color-primary-fg': '15 20 25', //  texto sobre relleno primario (7.3:1)
    '--color-primary-ink': '16 185 129', // texto/ícono primario sobre superficies
    '--color-accent': '245 158 11', //    #F59E0B amber
    '--color-accent-ink': '245 158 11',
    '--color-danger': '239 68 68', //     #EF4444
    '--color-danger-ink': '248 113 113', // #F87171 variante legible para texto
    '--color-overlay': '5 8 12',
    '--color-glass': 'rgba(255, 255, 255, 0.05)',
    '--color-line': 'rgba(255, 255, 255, 0.08)',
  },
  light: {
    '--color-bg': '248 250 252',
    '--color-surface': '255 255 255',
    '--color-elevated': '241 245 249',
    '--color-fg': '15 20 25',
    '--color-muted': '71 85 105', //      #475569 (7.6:1 sobre blanco)
    '--color-primary': '16 185 129',
    '--color-primary-fg': '15 20 25',
    '--color-primary-ink': '4 120 87', // #047857 (5.5:1 sobre blanco)
    '--color-accent': '245 158 11',
    '--color-accent-ink': '180 83 9', //  #B45309 (5.0:1)
    '--color-danger': '239 68 68',
    '--color-danger-ink': '185 28 28', // #B91C1C (6.5:1)
    '--color-overlay': '15 20 25',
    '--color-glass': 'rgba(255, 255, 255, 0.85)',
    '--color-line': 'rgba(15, 20, 25, 0.10)',
  },
};

const channel = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],

  // El tema oscuro vive en `:root` (no en la clase `.dark`). Declarar `class`
  // evita que el runtime web de NativeWind intente forzar el esquema "media".
  darkMode: 'class',

  // Tailwind purga las clases de `addBase` que no encuentra en el código: los
  // temas se aplican con nombres de clase dinámicos, así que se fuerzan.
  safelist: ['theme-dark', 'theme-light'],

  // `fontWeight` desactivado a propósito: en React Native cada peso es un
  // archivo/familia distinta (font-heading-bold, font-body-medium…). Combinar
  // `font-bold` con una familia custom provoca "faux bold" en Android.
  corePlugins: { fontWeight: false },

  theme: {
    // Breakpoints explícitos (mismos que Tailwind): sm 640 · md 768 (tablet) ·
    // lg 1024 (desktop) · xl 1280 · 2xl 1536.
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },

    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: channel('--color-bg'),
      surface: channel('--color-surface'),
      elevated: channel('--color-elevated'),
      fg: channel('--color-fg'),
      muted: channel('--color-muted'),
      overlay: channel('--color-overlay'),
      glass: 'var(--color-glass)',
      line: 'var(--color-line)',
      primary: {
        DEFAULT: channel('--color-primary'),
        fg: channel('--color-primary-fg'),
        ink: channel('--color-primary-ink'),
      },
      accent: {
        DEFAULT: channel('--color-accent'),
        ink: channel('--color-accent-ink'),
      },
      danger: {
        DEFAULT: channel('--color-danger'),
        ink: channel('--color-danger-ink'),
      },
    },

    borderColor: ({ theme }) => ({ ...theme('colors'), DEFAULT: 'var(--color-line)' }),

    extend: {
      /**
       * Tipografías (se cargan en src/lib/fonts.ts con los MISMOS nombres).
       * - heading / KPIs  → Space Grotesk
       * - body / UI       → Geist (si falla la carga, fonts.ts registra Outfit
       *                     bajo estos mismos nombres: fallback transparente)
       * - números/precios → JetBrains Mono (monoespaciada = columnas tabulares)
       * En nativo sólo se usa el primer valor; en web el resto es stack CSS.
       */
      fontFamily: {
        heading: ['SpaceGrotesk_600SemiBold', 'sans-serif'],
        'heading-medium': ['SpaceGrotesk_500Medium', 'sans-serif'],
        'heading-bold': ['SpaceGrotesk_700Bold', 'sans-serif'],
        body: ['Geist_400Regular', 'sans-serif'],
        'body-medium': ['Geist_500Medium', 'sans-serif'],
        'body-semibold': ['Geist_600SemiBold', 'sans-serif'],
        mono: ['JetBrainsMono_400Regular', 'monospace'],
        'mono-medium': ['JetBrainsMono_500Medium', 'monospace'],
        'mono-bold': ['JetBrainsMono_700Bold', 'monospace'],
        // Sin Inter/Roboto/system: cualquier `font-sans` cae también en Geist.
        sans: ['Geist_400Regular', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['11px', { lineHeight: '14px', letterSpacing: '0.06em' }],
        kpi: ['32px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        'kpi-lg': ['44px', { lineHeight: '48px', letterSpacing: '-0.03em' }],
      },

      // Áreas táctiles: WCAG 2.2 exige ≥ 24px (2.5.8); en caja usamos 44/56px.
      spacing: { touch: '44px', 'touch-lg': '56px' },
      minHeight: { touch: '44px', 'touch-lg': '56px' },
      minWidth: { touch: '44px' },
    },
  },

  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': themes.dark,
        '.theme-dark': themes.dark,
        '.theme-light': themes.light,
      });
    }),
  ],
};
