import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';

/**
 * Los nombres deben coincidir exactamente con `theme.extend.fontFamily` de
 * `tailwind.config.js`. En React Native cada peso es una familia distinta.
 *
 * Press Start 2P es la voz retro de títulos, botones y KPIs. Geist queda para
 * el cuerpo (formularios y tablas) para no sacrificar legibilidad.
 */
export function useAppFonts() {
  return useFonts({
    PressStart2P_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
}
