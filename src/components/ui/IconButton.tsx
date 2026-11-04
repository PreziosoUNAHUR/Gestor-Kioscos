import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { cn } from '@/lib/cn';
import { pixelPressed, pixelShadow } from '@/lib/retro';
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
  default: { box: 'border-black bg-elevated', color: palette.fg },
  primary: { box: 'border-black bg-success', color: palette.ink },
  danger: { box: 'border-black bg-danger', color: '#FFFFFF' },
} as const;

export function IconButton({ name, label, onPress, tone = 'default', disabled, className }: IconButtonProps) {
  const styles = TONES[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [pixelShadow(3), pressed && !disabled ? pixelPressed(3) : undefined]}
      className={cn(
        'h-touch w-touch items-center justify-center rounded-none border-[3px]',
        styles.box,
        disabled && 'opacity-40',
        className,
      )}
    >
      <Feather name={name} size={17} color={styles.color} />
    </Pressable>
  );
}
