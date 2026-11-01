import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'primary' | 'accent' | 'danger' | 'muted';

const TONES: Record<Tone, string> = {
  neutral: 'border-line bg-elevated',
  primary: 'border-primary/30 bg-primary/10',
  accent: 'border-accent/30 bg-accent/10',
  danger: 'border-danger/30 bg-danger/10',
  muted: 'border-line bg-bg/60',
};

const TEXT_TONES: Record<Tone, string> = {
  neutral: 'text-fg',
  primary: 'text-primary-ink',
  accent: 'text-accent-ink',
  danger: 'text-danger-ink',
  muted: 'text-muted',
};

type BadgeProps = {
  children: string | number;
  tone?: Tone;
  className?: string;
  textClassName?: string;
};

export function Badge({ children, tone = 'neutral', className, textClassName }: BadgeProps) {
  return (
    <View className={cn('rounded-full border px-2 py-0.5', TONES[tone], className)}>
      <Text className={cn('font-body-semibold text-2xs uppercase tracking-wide', TEXT_TONES[tone], textClassName)}>
        {children}
      </Text>
    </View>
  );
}
