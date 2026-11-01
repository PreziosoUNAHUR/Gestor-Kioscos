import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { cn } from '@/lib/cn';
import { palette } from '@/lib/theme';

type IconButtonProps = {
  name: ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  className?: string;
};

const TONES = {
  default: { box: 'border-line bg-surface/70', color: palette.muted },
  primary: { box: 'border-primary/30 bg-primary/10', color: palette.primary },
  danger: { box: 'border-danger/30 bg-danger/10', color: palette.dangerInk },
} as const;

export function IconButton({ name, label, onPress, tone = 'default', disabled, className }: IconButtonProps) {
  const styles = TONES[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'h-touch w-touch items-center justify-center rounded-xl border',
        styles.box,
        disabled && 'opacity-40',
        className,
      )}
    >
      <Feather name={name} size={17} color={styles.color} />
    </Pressable>
  );
}
