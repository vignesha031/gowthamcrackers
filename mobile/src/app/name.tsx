import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/context';
import { colors } from '@/theme';
import { AuthScroll } from '@/components/auth-scroll';
import { Btn, ErrorText, Field, Logo } from '@/components/ui';

/** 4. First login only: just a name (no KYC, no MPIN) */
export default function NameScreen() {
  const { t, lang, saveProfile } = useApp();
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function next() {
    setBusy(true);
    setError('');
    try {
      await saveProfile({ name: name.trim(), lang });
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthScroll>
      <View style={styles.content}>
        <View style={{ marginTop: 20, marginBottom: 10 }}>
          <Logo size={46} />
        </View>
        <Text style={styles.title}>{t('உங்கள் பெயர்', 'What is your name?')}</Text>
        <Text style={styles.sub}>{t('பரிசு மற்றும் பார்சலுக்கு தேவை', 'Used for your gift and parcel')}</Text>
        <View style={{ height: 24 }} />
        <Field label={t('பெயர்', 'Name')} value={name} onChangeText={setName} autoFocus autoComplete="name" placeholder={t('உங்கள் பெயர்', 'Your name')} />
        <ErrorText>{error}</ErrorText>
        <Btn ta="தொடரவும்" en="Continue" disabled={name.trim().length < 2 || busy} onPress={next} />
      </View>
    </AuthScroll>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 20, color: colors.text },
  sub: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 4 },
});
