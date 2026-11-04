import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { pixelShadow } from '@/lib/retro';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  eyebrow?: string;
};

/**
 * Ventana retro: barra de título azul con botones de "sistema" y contenido
 * debajo. Se usa en todas las pantallas para dar continuidad visual.
 */
export function PageHeader({ title, subtitle, actions, className, eyebrow }: PageHeaderProps) {
  return (
    <View className={cn('mb-5', className)}>
      <View className="rounded-none border-[3px] border-black bg-surface" style={pixelShadow(6)}>
        <View className="flex-row items-center justify-between gap-3 border-b-[3px] border-black bg-primary px-3 py-2">
          <Text className="flex-1 font-pixel text-pixel-xs uppercase leading-5 tracking-wide text-white" numberOfLines={1}>
            {title}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View className="h-3 w-3 border-2 border-black bg-accent" />
            <View className="h-3 w-3 border-2 border-black bg-success" />
            <View className="h-3 w-3 border-2 border-black bg-danger" />
          </View>
        </View>

        <View className="gap-2 px-3 py-2.5">
          {eyebrow ? (
            <Text className="font-pixel text-pixel-2xs uppercase tracking-wide text-primary-ink">{eyebrow}</Text>
          ) : null}
          {subtitle ? <Text className="font-body text-xs leading-5 text-muted">{subtitle}</Text> : null}
          {actions ? <View className="flex-row flex-wrap items-center gap-2 pt-0.5">{actions}</View> : null}
        </View>
      </View>
    </View>
  );
}
