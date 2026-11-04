import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'primary' | 'accent' | 'danger' | 'muted' | 'pink' | 'orange';

const TONES: Record<Tone, string> = {
  neutral: 'border-black bg-elevated',
  primary: 'border-black bg-success',
  accent: 'border-black bg-accent',
  danger: 'border-black bg-[#FCA5A5]',
  muted: 'border-black bg-bg',
  pink: 'border-black bg-pink',
  orange: 'border-black bg-orange',
};

const TEXT_TONES: Record<Tone, string> = {
  neutral: 'text-fg',
  primary: 'text-ink',
  accent: 'text-ink',
  danger: 'text-[#5B0A0A]',
  muted: 'text-muted',
  pink: 'text-ink',
  orange: 'text-ink',
};

type BadgeProps = {
  children: string | number;
  tone?: Tone;
  className?: string;
  textClassName?: string;
};

export function Badge({ children, tone = 'neutral', className, textClassName }: BadgeProps) {
  return (
    <View className={cn('rounded-none border-2 px-1.5 py-0.5', TONES[tone], className)}>
      <Text
        className={cn(
          'font-pixel text-pixel-2xs uppercase tracking-wide',
          TEXT_TONES[tone],
          textClassName,
        )}
      >
        {children}
      </Text>
    </View>
  );
}
