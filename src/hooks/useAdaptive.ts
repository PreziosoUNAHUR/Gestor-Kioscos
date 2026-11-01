import { useWindowDimensions } from 'react-native';

/** A partir de acá usamos sidebar (PC / tablet grande); abajo, tabs. */
export const DESKTOP_BREAKPOINT = 1024;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
