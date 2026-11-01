import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type Tone = 'default' | 'primary' | 'accent' | 'danger';

const VALUE_TONES: Record<Tone, string> = {
  default: 'text-fg',
  primary: 'text-primary-ink',
  accent: 'text-accent-ink',
  danger: 'text-danger-ink',
};

type StatProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  className?: string;
};

export function Stat({ label, value, hint, tone = 'default', className }: StatProps) {
  return (
    <View className={cn('flex-1 gap-1 rounded-xl border border-line bg-surface/60 px-3 py-3', className)}>
      <Text className="font-body-medium text-2xs uppercase tracking-wide text-muted">{label}</Text>
      <Text className={cn('font-mono-medium text-lg tabular-nums', VALUE_TONES[tone])}>{value}</Text>
      {hint ? <Text className="font-body text-2xs text-muted">{hint}</Text> : null}
    </View>
  );
}
