import { ActivityIndicator, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { palette } from '@/lib/theme';

type SpinnerProps = {
  label?: string;
  className?: string;
  compact?: boolean;
};

export function Spinner({ label, className, compact = false }: SpinnerProps) {
  return (
    <View className={cn('items-center justify-center gap-2', compact ? 'py-3' : 'flex-1 py-12', className)}>
      <ActivityIndicator color={palette.primary} />
      {label ? <Text className="font-body text-sm text-muted">{label}</Text> : null}
    </View>
  );
}
