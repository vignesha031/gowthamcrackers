import React, { useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '@/theme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  length: number;
  /** show dots instead of digits */
  secure?: boolean;
  autoFocus?: boolean;
  oneTimeCode?: boolean;
  boxSize?: { width: number; height: number };
}

export function PinInput({ value, onChange, length, secure, autoFocus, oneTimeCode, boxSize }: Props) {
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  return (
    <>
      <TouchableOpacity activeOpacity={1} onPress={() => ref.current?.focus()} style={styles.row}>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.box, boxSize]}>
            {secure ? (
              value[i] ? <View style={styles.dot} /> : null
            ) : (
              <View>{value[i] ? <TextDigit d={value[i]} /> : null}</View>
            )}
          </View>
        ))}
      </TouchableOpacity>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        secureTextEntry={secure}
        autoFocus={autoFocus}
        autoComplete={oneTimeCode ? (Platform.OS === 'android' ? 'sms-otp' : 'one-time-code') : undefined}
        importantForAutofill={oneTimeCode ? 'yes' : undefined}
        accessibilityLabel={oneTimeCode ? `${length}-digit verification code` : undefined}
        style={styles.hidden}
      />
    </>
  );
}

function TextDigit({ d }: { d: string }) {
  return <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{d}</Text>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 18 },
  box: { width: 44, height: 52, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.text },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
