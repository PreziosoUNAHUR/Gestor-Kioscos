import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/cn';

type CardProps = {
  children: ReactNode;
  className?: string;
  /** Glassmorphism sutil (sólo tiene efecto real en web). */
  glass?: boolean;
  padded?: boolean;
};

export function Card({ children, className, glass = false, padded = true }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-2xl border border-line',
        glass ? 'bg-glass web:backdrop-blur-xl' : 'bg-surface/70',
        padded && 'p-4',
        className,
      )}
    >
      {children}
    </View>
  );
}
