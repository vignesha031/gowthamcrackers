import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { draftFromMe, useApp } from '@/context';
import { colors } from '@/theme';
import { inr } from '@/utils';
import { Btn, Card, Centered, ErrorText, Field, Header, Row, Screen } from '@/components/ui';
import { DeliveryForm, validDelivery } from '@/components/delivery-form';
import type { Draft } from '@/types';

/** 10. Join: confirm name + delivery, accept terms (no KYC) → POST /enrolments */
export default function JoinScreen() {
  const { t, me, config, configError, reloadConfig, saveProfile, join } = useApp();
  const router = useRouter();
  const { plan: planId } = useLocalSearchParams<{ plan: string }>();
  const [draft, setDraft] = useState<Draft>(() => draftFromMe(me));
  const [refCode, setRefCode] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!config) return <Centered loading={!configError} message={configError} onRetry={reloadConfig} />;
  const plan = config.scheme?.plans.find((p) => p.id === planId);
  if (!plan || !config.scheme) return null;
  const ok = agree && draft.name.trim().length >= 2 && validDelivery(draft);

  async function submit() {
    if (busy || !plan) return;
    setBusy(true);
    setError('');
    try {
      await saveProfile({ ...draft, name: draft.name.trim(), ...(refCode.trim() && !me?.referredBy && { referralCode: refCode.trim() }) });
      const e = await join(plan.id);
      router.replace({ pathname: '/pay', params: { id: e.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('திட்டத்தில் இணை', 'Join Plan')} onBack={() => router.back()} />
      <Screen>
        <Card>
          <Text style={{ fontWeight: '800', color: colors.maroon, marginBottom: 4 }}>Plan {plan.n}</Text>
          <Row left={t('மாத தவணை', 'Monthly')} right={`₹${inr(plan.monthly)}`} />
          <Row left={t('பட்டாசின் மதிப்பு', 'Cracker value')} right={`₹${inr(plan.crackerValue)}`} bold />
        </Card>

        <Field label={t('பெயர்', 'Name')} value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} />
        <DeliveryForm draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
        {!me?.referredBy && (
          <Field label={t('பரிந்துரை குறியீடு (விருப்பம்)', 'Referral code (optional)')} value={refCode} onChangeText={(v) => setRefCode(v.toUpperCase())} autoCapitalize="characters" maxLength={12} />
        )}

        <TouchableOpacity onPress={() => setAgree(!agree)} accessibilityRole="checkbox" accessibilityState={{ checked: agree }} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 14 }}>
          <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={24} color={colors.maroon} />
          <Text style={{ flex: 1, marginLeft: 10, color: colors.text, lineHeight: 20 }}>
            {t('நான் திட்ட நிபந்தனைகளைப் படித்து ஏற்கிறேன். ', 'I have read and accept the scheme terms. ')}
            <Text onPress={() => router.push('/terms')} style={{ color: colors.maroon, fontWeight: '700', textDecorationLine: 'underline' }}>{t('நிபந்தனைகள்', 'View terms')}</Text>
          </Text>
        </TouchableOpacity>

        <ErrorText>{error}</ErrorText>
        <Btn ta="இணைந்து முதல் தவணை செலுத்து" en="Join & pay first instalment" disabled={!ok || busy} onPress={submit} />
      </Screen>
    </View>
  );
}
