import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <View className={cn('items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-6 py-10', className)}>
      {icon ? <View className="mb-1 opacity-80">{icon}</View> : null}
      <Text className="text-center font-heading text-base text-fg">{title}</Text>
      {description ? (
        <Text className="max-w-[420px] text-center font-body text-sm text-muted">{description}</Text>
      ) : null}
      {action ? <View className="mt-1">{action}</View> : null}
    </View>
  );
}
