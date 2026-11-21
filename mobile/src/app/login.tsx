import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/context';
import { colors } from '@/theme';
import { normalizeMobile } from '@/utils';
import { AuthScroll } from '@/components/auth-scroll';
import { Btn, ErrorText, Logo } from '@/components/ui';

/** 2. Mobile number */
export default function LoginScreen() {
  const { t, requestOtp } = useApp();
  const router = useRouter();
  const { mobile: prefill } = useLocalSearchParams<{ mobile?: string }>();
  const [mobile, setMobile] = useState(() => normalizeMobile(prefill ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = /^[6-9]\d{9}$/.test(mobile);

  async function next() {
    setBusy(true);
    setError('');
    try {
      const r = await requestOtp(mobile);
      router.push({ pathname: '/otp', params: { mobile, length: String(r.length), ...(r.devOtp && { devOtp: r.devOtp }) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScroll>
      <View style={styles.content}>
        <View style={{ marginTop: 20 }}>
          <Logo size={46} />
        </View>
        <Text style={styles.title}>{t('உங்கள் மொபைல் எண்ணை உள்ளிடுங்கள்', 'Enter your mobile number')}</Text>
        <Text style={styles.sub}>{t('OTP மூலம் உள்நுழையலாம்', 'We will send a one-time password')}</Text>
        <View style={styles.phoneRow}>
          <Text style={styles.cc}>+91</Text>
          <TextInput
            style={{ flex: 1, fontSize: 16, color: colors.text }}
            keyboardType="phone-pad"
            autoComplete="tel"
            importantForAutofill="yes"
            accessibilityLabel="Mobile number"
            value={mobile}
            onChangeText={(v) => setMobile(normalizeMobile(v))}
            placeholder="9876543210"
            placeholderTextColor={colors.muted}
          />
        </View>
        <ErrorText>{error}</ErrorText>
        <View style={{ height: 12 }} />
        <Btn ta="தொடரவும்" en="Continue" disabled={!valid || busy} onPress={next} />
        <View style={{ flexGrow: 1, minHeight: 24 }} />
        <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 12 }}>
          {t('தொடர்வதன் மூலம் திட்ட விதிமுறைகளை ஏற்கிறீர்கள்', 'By continuing you accept the scheme terms')}
        </Text>
      </View>
    </AuthScroll>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, flexShrink: 0, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 26, color: colors.text },
  sub: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 4 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 12, height: 52, paddingHorizontal: 14, marginTop: 22 },
  cc: { fontSize: 16, fontWeight: '600', marginRight: 12, color: colors.text },
});
