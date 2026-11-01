import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

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
            className={cn(
              'min-h-touch flex-row items-center gap-1.5 rounded-full border px-3',
              active ? 'border-primary/40 bg-primary/10' : 'border-line bg-surface/60',
            )}
          >
            <Text className={cn('font-body-medium text-xs', active ? 'text-primary-ink' : 'text-muted')}>
              {option.label}
            </Text>
            {typeof option.count === 'number' ? (
              <Text className={cn('font-mono text-2xs', active ? 'text-primary-ink' : 'text-muted')}>
                {option.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
