/**
 * Espejo en JS de los tokens de `tailwind.config.js`.
 * Se usa únicamente donde una API nativa exige un color real (StatusBar,
 * ActivityIndicator, cámara, tema de navegación). Los componentes usan clases.
 */
export const palette = {
  bg: '#0F1419',
  surface: '#1A1F26',
  elevated: '#232A33',
  fg: '#F8FAFC',
  muted: '#94A3B8',
  primary: '#10B981',
  primaryFg: '#0F1419',
  accent: '#F59E0B',
  danger: '#EF4444',
  dangerInk: '#F87171',
  overlay: '#05080C',
  line: 'rgba(255, 255, 255, 0.08)',
  glass: 'rgba(255, 255, 255, 0.05)',
} as const;

/** Tema de React Navigation alineado al sistema de diseño. */
export const navigationTheme = {
  dark: true,
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
    bold: { fontFamily: 'SpaceGrotesk_600SemiBold', fontWeight: '600' as const },
    heavy: { fontFamily: 'SpaceGrotesk_700Bold', fontWeight: '700' as const },
  },
};
