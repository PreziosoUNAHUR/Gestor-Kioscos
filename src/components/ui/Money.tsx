import { Text } from 'react-native';

import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';

type MoneySize = 'sm' | 'md' | 'lg' | 'kpi';

const SIZES: Record<MoneySize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  kpi: 'text-kpi',
};

type MoneyProps = {
  value: number | string | null | undefined;
  currency?: string;
  size?: MoneySize;
  className?: string;
  muted?: boolean;
};

export function Money({ value, currency = 'ARS', size = 'md', className, muted = false }: MoneyProps) {
  return (
    <Text
      className={cn(
        'font-mono tabular-nums',
        SIZES[size],
        muted ? 'text-muted' : 'text-fg',
        className,
      )}
    >
      {formatMoney(value, currency)}
    </Text>
  );
}
