import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';
import { palette } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'outline';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  children?: ReactNode;
  label?: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  textClassName?: string;
  fullWidth?: boolean;
};

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary border border-primary',
  secondary: 'bg-surface border border-line',
  ghost: 'bg-transparent border border-transparent',
  danger: 'bg-danger border border-danger',
  accent: 'bg-accent border border-accent',
  outline: 'bg-transparent border border-primary/50',
};

const TEXT_VARIANTS: Record<Variant, string> = {
  primary: 'text-primary-fg',
  secondary: 'text-fg',
  ghost: 'text-muted',
  danger: 'text-bg',
  accent: 'text-primary-fg',
  outline: 'text-primary-ink',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-touch px-3',
  md: 'min-h-touch px-4',
  lg: 'min-h-touch-lg px-6',
};

const TEXT_SIZES: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
};

export function Button({
  children,
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  textClassName,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  const spinnerColor = variant === 'primary' || variant === 'accent' || variant === 'danger' ? palette.primaryFg : palette.fg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-xl',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        icon
      )}
      {label ? (
        <Text className={cn('font-body-semibold', TEXT_SIZES[size], TEXT_VARIANTS[variant], textClassName)}>
          {label}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
