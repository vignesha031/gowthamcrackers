import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FALLBACK_BRAND } from '@/config';
import { useApp } from '@/context';
import { colors, radius, shadow } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type { IconName };

/** Text wordmark: கௌதம் / பட்டாசு கடை / SINCE 1987 */
export function Logo({ size = 40, light }: { size?: number; light?: boolean }) {
  const { config } = useApp();
  const SHOP = config?.shop ?? FALLBACK_BRAND;
  const main = light ? '#fff' : colors.maroon;
  const accent = light ? colors.goldLight : colors.gold;
  return (
    <View accessible accessibilityLabel={SHOP.nameEn} style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: size * 0.8, fontWeight: '800', color: main, lineHeight: size * 1.05, paddingHorizontal: 4 }}>{SHOP.nameTa}</Text>
      <Text style={{ fontSize: Math.max(10, size * 0.3), fontWeight: '700', color: accent, lineHeight: size * 0.45 }}>{SHOP.subTa}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.12, marginTop: size * 0.1 }}>
        <View style={{ width: size * 0.35, height: StyleSheet.hairlineWidth, backgroundColor: accent }} />
        <Text style={{ fontSize: Math.max(8, size * 0.18), fontWeight: '600', color: accent, letterSpacing: size * 0.06 }}>SINCE {SHOP.since}</Text>
        <View style={{ width: size * 0.35, height: StyleSheet.hairlineWidth, backgroundColor: accent }} />
      </View>
    </View>
  );
}

interface BtnProps {
  ta: string;
  en?: string;
  onPress: () => void;
  variant?: 'maroon' | 'gold' | 'outline';
  icon?: IconName;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Primary button: Tamil label with English sub-label */
export function Btn({ ta, en, onPress, variant = 'maroon', icon, disabled, compact, style }: BtnProps) {
  const outline = variant === 'outline';
  const bg = outline ? '#fff' : variant === 'gold' ? colors.gold : colors.maroon;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, outline && { borderWidth: 1.5, borderColor: colors.maroon }, compact && { height: 46 }, style]}
    >
      <View style={{ alignItems: 'center', flex: 1 }}>
        <Text style={[styles.btnTa, compact && { fontSize: 14 }, outline && { color: colors.maroon }]}>{ta}</Text>
        {!!en && <Text style={[styles.btnEn, compact && { fontSize: 10 }, outline && { color: colors.muted }]}>{en}</Text>}
      </View>
      {icon && <Ionicons name={icon} size={20} color={outline ? colors.maroon : '#fff'} style={{ position: 'absolute', right: 16 }} />}
    </TouchableOpacity>
  );
}

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  style?: TextInputProps['style'];
}

export function Field({ label, style, ...rest }: FieldProps) {
  return (
    <View style={{ marginBottom: 14 }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Maroon header bar with optional back button */
export function Header({ title, sub, onBack }: { title: string; sub?: string; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} accessibilityLabel="Back" style={{ padding: 4, width: 30 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 30 }} />
      )}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!sub && <Text style={styles.headerSub}>{sub}</Text>}
      </View>
      <View style={{ width: 30 }} />
    </View>
  );
}

export function Screen({ children, refreshing, onRefresh }: { children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.maroon} colors={[colors.maroon]} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Row({ left, right, bold, color }: { left: string; right: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 }}>
      <Text style={{ color: colors.muted, flexShrink: 1 }}>{left}</Text>
      <Text style={{ color: color ?? colors.text, fontWeight: bold ? '800' : '600', textAlign: 'right', flexShrink: 1 }}>{right}</Text>
    </View>
  );
}

export function Pill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Progress({ value, fill = colors.maroon, track = colors.border }: { value: number; fill?: string; track?: string }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ height: 8, width: `${Math.max(0, Math.min(100, value * 100))}%`, backgroundColor: fill }} />
    </View>
  );
}

/** Full-screen loader / error with a retry button. */
export function Centered({ loading, message, onRetry }: { loading?: boolean; message?: string; onRetry?: () => void }) {
  const { t } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
      {loading ? <ActivityIndicator size="large" color={colors.maroon} /> : <Ionicons name="cloud-offline-outline" size={56} color={colors.border} />}
      {!!message && <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>{message}</Text>}
      {onRetry && <Btn ta="மீண்டும் முயற்சி" en="Try again" onPress={onRetry} style={{ alignSelf: 'stretch' }} />}
    </View>
  );
}

/** Inline error line (red). */
export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <Text accessibilityRole="alert" style={{ color: colors.red, textAlign: 'center', marginVertical: 8, lineHeight: 19 }}>{children}</Text>;
}

export const styles = StyleSheet.create({
  btn: { height: 54, borderRadius: radius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnTa: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  btnEn: { color: '#F6E6BC', fontSize: 11, marginTop: 1, textAlign: 'center' },
  label: { color: colors.muted, fontSize: 12, marginBottom: 5 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, height: 46, color: colors.text, fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: radius, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.border, ...shadow },
  header: { backgroundColor: colors.maroon, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 14 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub: { color: colors.goldLight, fontSize: 11 },
});
