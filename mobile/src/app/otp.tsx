import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/context';
import { OTP_RESEND_SECONDS } from '@/config';
import { colors } from '@/theme';
import { AuthScroll } from '@/components/auth-scroll';
import { Btn, ErrorText } from '@/components/ui';
import { PinInput } from '@/components/pin-input';

/** 3. OTP verification → Home (or name screen on first login) */
export default function OtpScreen() {
  const { t, requestOtp, verifyOtp } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ mobile: string; length?: string; devOtp?: string }>();
  const mobile = params.mobile ?? '';
  const [length, setLength] = useState(Number(params.length) || 4);
  const [devOtp, setDevOtp] = useState(params.devOtp ?? '');
  const [otp, setOtp] = useState('');
  const [secs, setSecs] = useState(OTP_RESEND_SECONDS);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const busy = useRef(false);

  async function submit(code: string) {
    if (code.length !== length || busy.current) return;
    busy.current = true;
    setError('');
    try {
      const r = await verifyOtp(mobile, code);
      router.replace(r.isNew ? '/name' : '/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOtp('');
    } finally {
      busy.current = false;
    }
  }

  function onChange(code: string) {
    setOtp(code);
    setError('');
    submit(code);
  }

  useEffect(() => {
    if (secs <= 0) return;
    const id = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secs]);

  return (
    <AuthScroll>
      <View style={styles.content}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.iconCircle}>
          <Ionicons name="phone-portrait-outline" size={44} color={colors.maroon} />
        </View>
        <Text style={[styles.title, { color: colors.maroon }]}>{t('OTP சரிபார்ப்பு', 'OTP Verification')}</Text>
        <Text style={[styles.sub, { color: colors.text, marginTop: 10 }]}>
          +91 {mobile} {t('க்கு அனுப்பப்பட்டது', 'sent')}
        </Text>
        {!!devOtp && (
          <Text style={[styles.sub, { color: colors.gold, fontWeight: '700' }]}>
            {t(`சோதனை OTP: ${devOtp}`, `Test OTP (development server): ${devOtp}`)}
          </Text>
        )}

        <PinInput value={otp} onChange={onChange} length={length} autoFocus oneTimeCode />
        <ErrorText>{error}</ErrorText>
        {!!info && <Text style={{ textAlign: 'center', color: colors.green, marginBottom: 8 }}>{info}</Text>}

        <Text style={{ textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.maroon }}>00:{String(secs).padStart(2, '0')}</Text>
        <TouchableOpacity
          disabled={secs > 0}
          onPress={async () => {
            setOtp('');
            setError('');
            try {
              const r = await requestOtp(mobile);
              setLength(r.length);
              setDevOtp(r.devOtp ?? '');
              setSecs(OTP_RESEND_SECONDS);
              setInfo(t('புதிய OTP அனுப்பப்பட்டது', 'A new OTP has been sent'));
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
          style={{ alignItems: 'center', marginVertical: 10 }}
        >
          <Text style={{ color: secs > 0 ? colors.muted : colors.maroon }}>{t('மறுபடியும் அனுப்பு', 'Resend OTP')}</Text>
        </TouchableOpacity>
        <Btn ta="சரிபார்த்து தொடரவும்" en="Verify & Continue" disabled={otp.length !== length} onPress={() => submit(otp)} />
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Ionicons name="arrow-back" size={16} color={colors.maroon} />
          <Text style={{ color: colors.maroon, marginLeft: 6 }}>{t('மொபைல் எண்ணை மாற்று', 'Change Mobile Number')}</Text>
        </TouchableOpacity>
      </View>
    </AuthScroll>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, flexShrink: 0, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 26 },
  sub: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 4 },
  iconCircle: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
});
