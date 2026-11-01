import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  eyebrow?: string;
};

export function PageHeader({ title, subtitle, actions, className, eyebrow }: PageHeaderProps) {
  return (
    <View className={cn('mb-5 flex-row flex-wrap items-end justify-between gap-3', className)}>
      <View className="flex-1 gap-1">
        {eyebrow ? (
          <Text className="font-body-semibold text-2xs uppercase tracking-wide text-primary-ink">{eyebrow}</Text>
        ) : null}
        <Text className="font-heading text-2xl text-fg">{title}</Text>
        {subtitle ? <Text className="font-body text-sm text-muted">{subtitle}</Text> : null}
      </View>
      {actions ? <View className="flex-row flex-wrap items-center gap-2">{actions}</View> : null}
    </View>
  );
}
