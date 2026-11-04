import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { pixelShadow } from '@/lib/retro';

type Tone = 'default' | 'primary' | 'accent' | 'danger';

const VALUE_TONES: Record<Tone, string> = {
  default: 'text-fg',
  primary: 'text-success-ink',
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
    <View
      className={cn('flex-1 gap-1 rounded-none border-[3px] border-black bg-elevated px-2.5 py-2.5', className)}
      style={pixelShadow(3)}
    >
      <Text className="font-pixel text-pixel-2xs uppercase tracking-wide text-muted">{label}</Text>
      <Text className={cn('font-pixel text-pixel-sm tabular-nums', VALUE_TONES[tone])}>{value}</Text>
      {hint ? <Text className="font-body text-2xs leading-4 text-muted">{hint}</Text> : null}
    </View>
  );
}
