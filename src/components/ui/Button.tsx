import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';
import { pixelPressed, pixelShadow } from '@/lib/retro';
import { palette } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'outline' | 'orange' | 'pink' | 'blue';
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
  primary: 'bg-success border-black',
  secondary: 'bg-elevated border-black',
  ghost: 'bg-transparent border-transparent',
  danger: 'bg-danger border-black',
  accent: 'bg-accent border-black',
  outline: 'bg-surface border-black',
  orange: 'bg-orange border-black',
  pink: 'bg-pink border-black',
  blue: 'bg-primary border-black',
};

const TEXT_VARIANTS: Record<Variant, string> = {
  primary: 'text-ink',
  secondary: 'text-fg',
  ghost: 'text-fg',
  danger: 'text-white',
  accent: 'text-ink',
  outline: 'text-fg',
  orange: 'text-ink',
  pink: 'text-ink',
  blue: 'text-white',
};

const ICON_COLORS: Record<Variant, string> = {
  primary: palette.ink,
  secondary: palette.fg,
  ghost: palette.fg,
  danger: '#FFFFFF',
  accent: palette.ink,
  outline: palette.fg,
  orange: palette.ink,
  pink: palette.ink,
  blue: '#FFFFFF',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-[36px] px-2.5 py-1.5',
  md: 'min-h-touch px-3.5 py-2',
  lg: 'min-h-touch-lg px-4 py-2.5',
};

const TEXT_SIZES: Record<Size, string> = {
  sm: 'text-pixel-2xs',
  md: 'text-pixel-xs',
  lg: 'text-pixel-sm',
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
  const isGhost = variant === 'ghost';
  const iconColor = ICON_COLORS[variant];

  const renderedIcon =
    isValidElement(icon) && icon.type !== undefined
      ? cloneElement(icon as ReactElement<{ color?: string }>, { color: iconColor })
      : icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        isGhost ? undefined : pixelShadow(4),
        pressed && !isDisabled && !isGhost ? pixelPressed(4) : undefined,
      ]}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-none border-[3px]',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'danger' || variant === 'blue' ? '#FFFFFF' : palette.ink}
        />
      ) : (
        renderedIcon
      )}
      {label ? (
        <Text
          className={cn(
            'font-pixel uppercase tracking-wide',
            TEXT_SIZES[size],
            TEXT_VARIANTS[variant],
            textClassName,
          )}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
