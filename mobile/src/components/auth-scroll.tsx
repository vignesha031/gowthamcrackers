import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';

interface Props {
  children: React.ReactNode;
  /** Wrap in a SafeAreaView (turn off if the screen handles insets itself) */
  safe?: boolean;
  bg?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Scrollable, keyboard-aware container for the login / onboarding pages, so
 * nothing gets cut off on small screens or hidden behind the keyboard.
 */
export function AuthScroll({ children, safe = true, bg = colors.cream, contentStyle }: Props) {
  const Wrap = safe ? SafeAreaView : React.Fragment;
  const wrapProps = safe ? { style: { flex: 1, backgroundColor: bg } } : {};
  return (
    <Wrap {...wrapProps}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ flexGrow: 1 }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Wrap>
  );
}
