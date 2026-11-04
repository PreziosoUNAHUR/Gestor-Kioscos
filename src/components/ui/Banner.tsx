import type { ComponentProps, ReactNode } from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { cn } from '@/lib/cn';
import { palette } from '@/lib/theme';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, { box: string; text: string; icon: string }> = {
  info: { box: 'border-black bg-surface', text: 'text-fg', icon: palette.primaryInk },
  success: { box: 'border-black bg-[#DCFCE7]', text: 'text-[#14532D]', icon: palette.successInk },
  warning: { box: 'border-black bg-[#FEF9C3]', text: 'text-[#5B4A00]', icon: palette.accentInk },
  danger: { box: 'border-black bg-[#FEE2E2]', text: 'text-[#5B0A0A]', icon: palette.dangerInk },
};

const ICONS: Record<Tone, ComponentProps<typeof Feather>['name']> = {
  info: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  danger: 'alert-circle',
};

type BannerProps = {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function Banner({ tone = 'info', title, children, className, action }: BannerProps) {
  const styles = TONES[tone];

  return (
    <View className={cn('flex-row items-start gap-2.5 rounded-none border-[3px] px-3 py-2.5', styles.box, className)}>
      <Feather name={ICONS[tone]} size={16} color={styles.icon} style={{ marginTop: 2 }} />
      <View className="flex-1 gap-0.5">
        {title ? <Text className={cn('font-pixel text-pixel-2xs uppercase leading-4', styles.text)}>{title}</Text> : null}
        {typeof children === 'string' ? (
          <Text className={cn('font-body text-xs leading-5', styles.text)}>{children}</Text>
        ) : (
          children
        )}
      </View>
      {action}
    </View>
  );
}
