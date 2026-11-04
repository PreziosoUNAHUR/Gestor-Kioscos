import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { palette } from '@/lib/theme';

type InputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  right?: ReactNode;
  containerClassName?: string;
  inputClassName?: string;
};

export const Input = forwardRef<ComponentRef<typeof TextInput>, InputProps>(function Input(
  { label, hint, error, right, containerClassName, inputClassName, multiline, style, ...rest },
  ref,
) {
  return (
    <View className={cn('w-full gap-1.5', containerClassName)}>
      {label ? (
        <Text className="font-pixel text-pixel-2xs uppercase tracking-wide text-fg">{label}</Text>
      ) : null}

      <View className="relative w-full justify-center">
        <TextInput
          ref={ref}
          placeholderTextColor={palette.muted}
          selectionColor={palette.primary}
          className={cn(
            'w-full rounded-none border-[3px] bg-elevated px-3 py-2 font-body text-base text-fg',
            multiline ? 'min-h-[88px]' : 'min-h-touch',
            error ? 'border-danger' : 'border-black',
            right ? 'pr-11' : '',
            inputClassName,
          )}
          style={[{ textAlignVertical: multiline ? 'top' : 'center' }, style]}
          multiline={multiline}
          {...rest}
        />
        {right ? <View className="absolute right-2 items-center justify-center">{right}</View> : null}
      </View>

      {error ? (
        <Text className="font-body text-xs text-danger-ink">{error}</Text>
      ) : hint ? (
        <Text className="font-body text-xs text-muted">{hint}</Text>
      ) : null}
    </View>
  );
});
