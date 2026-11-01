import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { cn } from '@/lib/cn';
import { palette } from '@/lib/theme';

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  dismissable?: boolean;
};

const MAX_WIDTH: Record<NonNullable<ModalProps['size']>, number> = {
  sm: 420,
  md: 560,
  lg: 760,
};

export function Modal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  dismissable = true,
}: ModalProps) {
  const { height } = useWindowDimensions();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (dismissable) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        <Pressable
          accessibilityLabel="Cerrar"
          className="absolute inset-0 bg-overlay/80"
          onPress={() => {
            if (dismissable) onClose();
          }}
        />

        <View
          className="w-full overflow-hidden rounded-2xl border border-line bg-surface web:backdrop-blur-2xl"
          style={{ maxWidth: MAX_WIDTH[size], maxHeight: height * 0.9 }}
        >
          {title ? (
            <View className="flex-row items-start justify-between gap-4 border-b border-line px-5 py-4">
              <View className="flex-1 gap-0.5">
                <Text className="font-heading text-lg text-fg">{title}</Text>
                {subtitle ? <Text className="font-body text-xs text-muted">{subtitle}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={onClose}
                hitSlop={8}
                className="h-9 w-9 items-center justify-center rounded-lg border border-line bg-bg/50"
              >
                <Feather name="x" size={16} color={palette.muted} />
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            className="shrink"
            contentContainerStyle={{ padding: 20, gap: 14 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? <View className={cn('border-t border-line px-5 py-4')}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}
