import { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { draftFromMe, useApp, usePullRefresh } from '@/context';
import { colors } from '@/theme';
import { Btn, Centered, ErrorText, Field, Header, Screen } from '@/components/ui';
import { DeliveryForm, validDelivery } from '@/components/delivery-form';
import type { Draft } from '@/types';

/** My profile: name + delivery preference → PATCH /me */
export default function MyProfileScreen() {
  const { t, me, saveProfile } = useApp();
  const router = useRouter();
  const pull = usePullRefresh();
  const [draft, setDraft] = useState<Draft>(() => draftFromMe(me));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!me) return <Centered loading />;
  const ok = draft.name.trim().length >= 2 && validDelivery(draft);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await saveProfile({ ...draft, name: draft.name.trim(), ...(code.trim() && !me?.referredBy && { referralCode: code.trim() }) });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('என் விவரம்', 'My Profile')} onBack={() => router.back()} />
      <Screen {...pull}>
        <Field label={t('பெயர்', 'Name')} value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} />
        <Field label={t('மொபைல் எண்', 'Mobile')} value={`+91 ${me.mobile}`} editable={false} />
        <DeliveryForm draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
        {!me.referredBy && <Field label={t('பரிந்துரை குறியீடு (ஒரு முறை)', 'Referral code (once)')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={12} />}
        {!ok && <Text style={{ color: colors.red, marginBottom: 10 }}>{t('பெயர் மற்றும் முகவரியை நிரப்பவும்', 'Please complete your name and delivery details')}</Text>}
        <ErrorText>{error}</ErrorText>
        <Btn ta="சேமி" en="Save" disabled={!ok || busy} onPress={save} />
      </Screen>
    </View>
  );
}
