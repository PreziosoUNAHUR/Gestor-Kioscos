import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/cn';
import { pixelShadow } from '@/lib/retro';

type CardProps = {
  children: ReactNode;
  className?: string;
  /** Se conserva por compatibilidad: en retro las ventanas son sólidas. */
  glass?: boolean;
  padded?: boolean;
  /** Sin sombra dura (para filas internas o contenedores que ya la tienen). */
  flat?: boolean;
};

export function Card({ children, className, padded = true, flat = false }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-none border-[3px] border-black bg-surface',
        padded && 'p-4',
        className,
      )}
      style={flat ? undefined : pixelShadow(5)}
    >
      {children}
    </View>
  );
}
