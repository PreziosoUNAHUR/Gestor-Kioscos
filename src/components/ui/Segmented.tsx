import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { pixelPressed, pixelShadow } from '@/lib/retro';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type SegmentedProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <View className={cn('flex-row flex-wrap gap-2', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              pixelShadow(active ? 3 : 2),
              pressed ? pixelPressed(2) : undefined,
            ]}
            className={cn(
              'min-h-[38px] flex-row items-center gap-1.5 rounded-none border-[3px] border-black px-2.5 py-1.5',
              active ? 'bg-accent' : 'bg-elevated',
            )}
          >
            <Text
              className={cn(
                'font-pixel text-pixel-2xs uppercase tracking-wide',
                active ? 'text-ink' : 'text-muted',
              )}
            >
              {option.label}
            </Text>
            {typeof option.count === 'number' ? (
              <Text className={cn('font-mono-bold text-2xs', active ? 'text-ink' : 'text-muted')}>
                {option.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
