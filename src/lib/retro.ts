import type { ViewStyle } from 'react-native';

/**
 * Sombras duras del sistema retro. React Native 0.76+ soporta `boxShadow`
 * (web y nativo), así que no hace falta una imagen ni un componente extra.
 */
export function pixelShadow(offset = 4, color = '#000000'): ViewStyle {
  return { boxShadow: `${offset}px ${offset}px 0px 0px ${color}` } as ViewStyle;
}

/** Estado presionado: el bloque "se hunde" y pierde la sombra. */
export function pixelPressed(offset = 4): ViewStyle {
  return {
    boxShadow: '0px 0px 0px 0px transparent',
    transform: [{ translateX: offset }, { translateY: offset }],
  } as ViewStyle;
}

/** Borde grueso compatible con web y nativo. */
export const PIXEL_BORDER = 3;

export const pixelSurface: ViewStyle = {
  borderWidth: PIXEL_BORDER,
  borderColor: '#000000',
};
