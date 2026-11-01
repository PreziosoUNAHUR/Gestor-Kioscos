import type { ComponentProps, ReactNode } from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { cn } from '@/lib/cn';
import { palette } from '@/lib/theme';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, { box: string; text: string; icon: string }> = {
  info: { box: 'border-primary/25 bg-primary/5', text: 'text-fg', icon: palette.primary },
  success: { box: 'border-primary/30 bg-primary/10', text: 'text-fg', icon: palette.primary },
  warning: { box: 'border-accent/30 bg-accent/10', text: 'text-fg', icon: palette.accent },
  danger: { box: 'border-danger/30 bg-danger/10', text: 'text-fg', icon: palette.dangerInk },
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
    <View className={cn('flex-row items-start gap-3 rounded-xl border px-3 py-2.5', styles.box, className)}>
      <Feather name={ICONS[tone]} size={16} color={styles.icon} style={{ marginTop: 1 }} />
      <View className="flex-1 gap-0.5">
        {title ? <Text className={cn('font-body-semibold text-sm', styles.text)}>{title}</Text> : null}
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
