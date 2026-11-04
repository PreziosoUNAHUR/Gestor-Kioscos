/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

/* -------------------------------------------------------------------------- */
/*  Gestor Kioscos · sistema de diseño "Retro UI / Pixel Art"                  */
/*                                                                             */
/*  - Fondo crema, ventanas celestes, barras de título azules y bordes negros  */
/*    de 3-4 px con sombras duras (sin blur).                                  */
/*  - La tipografía de títulos/botones es Press Start 2P. El cuerpo usa Geist  */
/*    para que formularios y tablas sigan siendo legibles.                     */
/*  - Colores como variables CSS en canales "R G B" para conservar la        */
/*    compatibilidad con NativeWind y la opacidad (bg-primary/15).             */
/* -------------------------------------------------------------------------- */

const themes = {
  retro: {
    '--color-bg': '245 230 200', //       #F5E6C8 crema de escritorio
    '--color-surface': '209 229 240', //  #D1E5F0 ventana celeste
    '--color-elevated': '255 255 255', // #FFFFFF campos y filas
    '--color-fg': '26 26 26', //          #1A1A1A tinta
    '--color-muted': '74 74 74', //       #4A4A4A texto secundario (7.9:1)
    '--color-primary': '74 144 226', //   #4A90E2 barra de título
    '--color-primary-fg': '255 255 255',
    '--color-primary-ink': '24 78 145', // #184E91 azul legible sobre celeste
    '--color-accent': '250 204 21', //    #FACC15 amarillo
    '--color-accent-ink': '120 88 0', //  #785800
    '--color-danger': '239 68 68', //     #EF4444
    '--color-danger-ink': '160 24 24', // #A01818
    '--color-success': '74 222 128', //   #4ADE80
    '--color-success-ink': '20 110 55', //#146E37
    '--color-pink': '244 114 182', //     #F472B6
    '--color-orange': '251 146 60', //    #FB923C
    '--color-ink': '17 17 17', //         #111111 texto sobre botones vivos
    '--color-overlay': '20 24 28',
    '--color-glass': '#D1E5F0',
    '--color-line': '#000000',
  },
};

const channel = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],

  darkMode: 'class',

  safelist: ['theme-retro'],

  // En React Native cada peso es una familia distinta; Press Start 2P sólo
  // tiene 400. Evitamos "faux bold" desactivando fontWeight.
  corePlugins: { fontWeight: false },

  theme: {
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
      ink: channel('--color-ink'),
      pink: channel('--color-pink'),
      orange: channel('--color-orange'),
      primary: {
        DEFAULT: channel('--color-primary'),
        fg: channel('--color-primary-fg'),
        ink: channel('--color-primary-ink'),
      },
      accent: {
        DEFAULT: channel('--color-accent'),
        ink: channel('--color-accent-ink'),
      },
      success: {
        DEFAULT: channel('--color-success'),
        ink: channel('--color-success-ink'),
      },
      danger: {
        DEFAULT: channel('--color-danger'),
        ink: channel('--color-danger-ink'),
      },
      black: '#000000',
      white: '#FFFFFF',
    },

    borderColor: ({ theme }) => ({ ...theme('colors'), DEFAULT: '#000000' }),

    extend: {
      fontFamily: {
        // Press Start 2P: títulos, botones, navegación, KPIs y códigos.
        pixel: ['PressStart2P_400Regular', 'monospace'],
        heading: ['PressStart2P_400Regular', 'monospace'],
        'heading-medium': ['PressStart2P_400Regular', 'monospace'],
        'heading-bold': ['PressStart2P_400Regular', 'monospace'],
        // Cuerpo legible para formularios, tablas y descripciones.
        body: ['Geist_400Regular', 'sans-serif'],
        'body-medium': ['Geist_500Medium', 'sans-serif'],
        'body-semibold': ['Geist_600SemiBold', 'sans-serif'],
        mono: ['JetBrainsMono_400Regular', 'monospace'],
        'mono-medium': ['JetBrainsMono_500Medium', 'monospace'],
        'mono-bold': ['JetBrainsMono_700Bold', 'monospace'],
        sans: ['Geist_400Regular', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['11px', { lineHeight: '14px', letterSpacing: '0.04em' }],
        // Escala pixel: pensada para Press Start 2P (no usar en párrafos).
        'pixel-2xs': ['7px', { lineHeight: '12px', letterSpacing: '0.02em' }],
        'pixel-xs': ['8px', { lineHeight: '14px', letterSpacing: '0.02em' }],
        'pixel-sm': ['10px', { lineHeight: '17px', letterSpacing: '0.01em' }],
        pixel: ['12px', { lineHeight: '20px', letterSpacing: '0' }],
        'pixel-lg': ['15px', { lineHeight: '24px', letterSpacing: '0' }],
        'pixel-xl': ['19px', { lineHeight: '30px', letterSpacing: '0' }],
        kpi: ['24px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        'kpi-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
      },

      spacing: { touch: '44px', 'touch-lg': '56px' },
      minHeight: { touch: '44px', 'touch-lg': '56px' },
      minWidth: { touch: '44px' },

      boxShadow: {
        pixel: '4px 4px 0px 0px #000000',
        'pixel-sm': '2px 2px 0px 0px #000000',
        'pixel-lg': '8px 8px 0px 0px rgba(0,0,0,0.35)',
        'pixel-xl': '10px 10px 0px 0px rgba(0,0,0,0.35)',
        none: 'none',
      },
    },
  },

  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': themes.retro,
        '.theme-retro': themes.retro,
      });
    }),
  ],
};
