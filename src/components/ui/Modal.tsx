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
import { pixelShadow } from '@/lib/retro';
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
  sm: 440,
  md: 580,
  lg: 780,
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
          className="absolute inset-0 bg-overlay/75"
          onPress={() => {
            if (dismissable) onClose();
          }}
        />

        <View
          className="w-full overflow-hidden rounded-none border-[4px] border-black bg-surface"
          style={{ maxWidth: MAX_WIDTH[size], maxHeight: height * 0.92, ...pixelShadow(10, 'rgba(0,0,0,0.4)') }}
        >
          {title ? (
            <View className="flex-row items-center justify-between gap-3 border-b-[3px] border-black bg-primary px-3 py-2.5">
              <View className="flex-1 gap-0.5">
                <Text className="font-pixel text-pixel-xs uppercase tracking-wide text-white">{title}</Text>
                {subtitle ? <Text className="font-body text-2xs text-white/90">{subtitle}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={onClose}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-none border-[3px] border-black bg-accent active:translate-x-0.5 active:translate-y-0.5"
              >
                <Feather name="x" size={15} color={palette.ink} />
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            className="shrink"
            contentContainerStyle={{ padding: 16, gap: 14 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? (
            <View className={cn('border-t-[3px] border-black bg-bg px-4 py-3')}>{footer}</View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}
