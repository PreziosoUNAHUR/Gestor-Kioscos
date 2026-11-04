/**
 * Espejo en JS de los tokens de `tailwind.config.js`.
 * Se usa únicamente donde una API nativa exige un color real (StatusBar,
 * ActivityIndicator, cámara, tema de navegación). Los componentes usan clases.
 */
export const palette = {
  bg: '#F5E6C8',
  surface: '#D1E5F0',
  elevated: '#FFFFFF',
  fg: '#1A1A1A',
  muted: '#4A4A4A',
  primary: '#4A90E2',
  primaryFg: '#FFFFFF',
  primaryInk: '#184E91',
  accent: '#FACC15',
  accentInk: '#785800',
  danger: '#EF4444',
  dangerInk: '#A01818',
  success: '#4ADE80',
  successInk: '#146E37',
  pink: '#F472B6',
  orange: '#FB923C',
  ink: '#111111',
  overlay: '#14181C',
  line: '#000000',
  glass: '#D1E5F0',
} as const;

/** Tema de React Navigation alineado al sistema de diseño retro. */
export const navigationTheme = {
  dark: false,
  colors: {
    primary: palette.primary,
    background: palette.bg,
    card: palette.surface,
    text: palette.fg,
    border: palette.line,
    notification: palette.accent,
  },
  fonts: {
    regular: { fontFamily: 'Geist_400Regular', fontWeight: '400' as const },
    medium: { fontFamily: 'Geist_500Medium', fontWeight: '500' as const },
    bold: { fontFamily: 'PressStart2P_400Regular', fontWeight: '400' as const },
    heavy: { fontFamily: 'PressStart2P_400Regular', fontWeight: '400' as const },
  },
};
