import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp, useFocusRefresh, usePullRefresh } from '@/context';
import { openWhatsApp } from '@/contact';
import { colors } from '@/theme';
import { fmtDay, inr, monthYear } from '@/utils';
import type { InstalmentState } from '@/types';
import { Btn, Card, Header, Pill, Progress, Row, Screen } from '@/components/ui';

const FULFIL: Record<string, { ta: string; en: string; step: number }> = {
  not_started: { ta: 'இன்னும் தொடங்கவில்லை', en: 'Not started', step: 0 },
  list_received: { ta: 'பட்டியல் பெறப்பட்டது', en: 'List received', step: 1 },
  packing: { ta: 'பேக்கிங்', en: 'Packing', step: 2 },
  dispatched: { ta: 'அனுப்பப்பட்டது', en: 'Dispatched', step: 3 },
  ready_for_pickup: { ta: 'கடையில் எடுக்கத் தயார்', en: 'Ready for pick-up', step: 3 },
  delivered: { ta: 'வழங்கப்பட்டது', en: 'Delivered', step: 4 },
};

/** 13. One plan: instalments, bonus status, cracker value, fulfilment */
export default function PlanProgressScreen() {
  const { t, lang, me, config, enrolments } = useApp();
  const router = useRouter();
  const pull = usePullRefresh();
  useFocusRefresh(3000);
  const { id } = useLocalSearchParams<{ id: string }>();
  const e = enrolments.find((x) => x.id === id);
  if (!e || !me || !config) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={t('என் திட்டம்', 'My Plan')} onBack={() => router.back()} />
        <Screen {...pull}><Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>{t('திட்டம் கிடைக்கவில்லை', 'Plan not found')}</Text></Screen>
      </View>
    );
  }
  const f = FULFIL[e.fulfilment.status] ?? FULFIL.not_started;
  const next = e.instalments.find((i) => i.status === 'pending');
  const allPaid = e.paidCount === e.totalCount;

  const pill = (st: InstalmentState) => {
    switch (st) {
      case 'paid': return <Pill text={t('உறுதி ✓', 'Paid ✓')} color={colors.green} bg="#E3F4EA" />;
      case 'verifying': return <Pill text={t('சரிபார்ப்பில்', 'Verifying')} color="#8A6410" bg={colors.goldLight} />;
      case 'due': return <Pill text={t('செலுத்த வேண்டும்', 'Due')} color="#fff" bg={colors.maroon} />;
      case 'overdue': return <Pill text={t('தாமதம்', 'Overdue')} color={colors.red} bg="#FBE5E2" />;
      default: return <Pill text={t('வரவிருக்கும்', 'Upcoming')} color={colors.muted} bg="#F1EADB" />;
    }
  };

  const chooseMsg = `வணக்கம், ${me.name ?? ''} (${me.mobile}). Plan ${e.planN} - ₹${inr(e.crackerValue)} மதிப்பிற்கு பட்டாசு பட்டியல் அனுப்புகிறேன்.`;

  return (
    <View style={{ flex: 1 }}>
      <Header title={`Plan ${e.planN} · ₹${inr(e.monthly)}`} sub={t(e.schemeNameTa, e.schemeNameEn)} onBack={() => router.back()} />
      <Screen {...pull}>
        <View style={styles.hero}>
          <Text style={{ color: colors.goldLight, fontSize: 12 }}>{t('இப்போதைய பட்டாசு மதிப்பு', 'Cracker value so far')}</Text>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>₹{inr(e.crackerValue)}</Text>
          <Text style={{ color: colors.goldLight, fontSize: 12, marginTop: 2 }}>
            {t(`தொடர்ந்து சரியாக செலுத்தினால் ₹${inr(e.crackerValueIfOnTrack)}`, `₹${inr(e.crackerValueIfOnTrack)} if you keep paying on time`)}
          </Text>
          <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
            <Progress value={e.paidCount / e.totalCount} fill={colors.gold} track="rgba(255,255,255,0.25)" />
          </View>
          <Text style={{ color: colors.goldLight, fontSize: 12, marginTop: 6 }}>
            {e.paidCount} / {e.totalCount} {t('தவணைகள்', 'instalments')} · ₹{inr(e.paidAmount)} {t('செலுத்தியது', 'paid')}
            {e.verifyingCount > 0 ? ` · ${e.verifyingCount} ${t('சரிபார்ப்பில்', 'verifying')}` : ''}
          </Text>
        </View>

        <Card style={{ borderColor: e.bonusSafe ? colors.green : colors.red }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={e.bonusSafe ? 'shield-checkmark' : 'warning'} size={26} color={e.bonusSafe ? colors.green : colors.red} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontWeight: '800', color: e.bonusSafe ? colors.green : colors.red }}>
                {e.bonusEarned ? t('போனஸ் & பரிசு கிடைத்தது!', 'Bonus & gift earned!') : e.bonusSafe ? t('போனஸ் & பரிசு பாதுகாப்பாக உள்ளது', 'Bonus & gift on track') : t('போனஸ் & பரிசு ஆபத்தில்', 'Bonus & gift at risk')}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                {e.bonusSafe
                  ? t(`+₹${inr(e.bonusAmount)} போனஸ் + ${e.giftTa}`, `+₹${inr(e.bonusAmount)} bonus + ${e.giftEn}`)
                  : t(`ஒவ்வொரு மாதமும் ${e.dueDay} தேதிக்குள் செலுத்தாததால் போனஸ் கிடைக்காது; செலுத்திய தொகைக்கு பட்டாசு பெறலாம்.`, `A missed ${e.dueDay}th cut-off means no bonus; you can still take crackers for the amount paid.`)}
              </Text>
            </View>
          </View>
        </Card>

        <Text style={styles.h}>{t('தவணைகள்', 'Instalments')}</Text>
        <Card style={{ padding: 0 }}>
          {e.instalments.map((r, idx) => (
            <View key={r.id} style={[styles.inst, idx < e.instalments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={[styles.num, r.state === 'paid' && { backgroundColor: colors.green }, r.state === 'verifying' && { backgroundColor: colors.gold }]}>
                {r.state === 'paid' ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{r.no}</Text>}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '700' }}>{monthYear(r.month, lang)} · ₹{inr(r.amount)}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {r.paidOn
                    ? `${r.state === 'paid' ? t('செலுத்தியது', 'Paid') : t('அனுப்பியது', 'Sent')} ${fmtDay(r.paidOn, lang)}${r.onTime === false ? ` · ${t('தாமதம்', 'late')}` : ''}${r.paymentRef ? ` · ${r.paymentRef}` : ''}`
                    : `${t('கடைசி நாள்', 'Pay by')} ${fmtDay(r.dueDate, lang)}`}
                </Text>
                {!!r.rejectedReason && <Text style={{ color: colors.red, fontSize: 11 }}>{t('ஏற்கப்படவில்லை', 'Not accepted')}: {r.rejectedReason}</Text>}
              </View>
              {pill(r.state)}
            </View>
          ))}
        </Card>
        {!!next && e.status === 'active' && <Btn ta="அடுத்த தவணை செலுத்து" en="Pay next instalment" icon="arrow-forward" onPress={() => router.push({ pathname: '/pay', params: { id: e.id } })} />}
        <View style={{ height: 10 }} />
        <Btn compact variant="outline" ta="பணம் செலுத்தியவை" en="Payment history" onPress={() => router.push('/payments')} />

        <Text style={[styles.h, { marginTop: 20 }]}>{t('பட்டாசு பெறுதல்', 'Getting your crackers')}</Text>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons name={f.step >= 4 ? 'checkmark-circle' : 'cube-outline'} size={22} color={f.step >= 4 ? colors.green : colors.maroon} />
            <Text style={{ marginLeft: 8, fontWeight: '800', color: colors.maroon }}>{t(f.ta, f.en)}</Text>
          </View>
          <Progress value={f.step / 4} fill={colors.gold} />
          {!!e.fulfilment.note && <Text style={{ color: colors.text, marginTop: 8, lineHeight: 19 }}>{e.fulfilment.note}</Text>}
          {!!e.fulfilment.trackingRef && <Row left={t('டிராக்கிங் எண்', 'Tracking')} right={e.fulfilment.trackingRef} />}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 }} />
          <Row left={t('பட்டாசு தேர்வு கடைசி நாள்', 'Choose crackers by')} right={fmtDay(e.chooseBy, lang)} />
          <Row left={t('பார்சல் தொடக்கம்', 'Parcels from')} right={fmtDay(e.parcelFrom, lang)} />
          <Row left={t('கடையில் நேரில் பெற', 'Store pick-up by')} right={fmtDay(e.pickupBy, lang)} />
          <Row left={t('உங்கள் தேர்வு', 'Your choice')} right={me.deliveryMode === 'pickup' ? t('கடையில் நேரில்', 'Store pick-up') : t('பார்சல்', 'Parcel')} />
          <Text style={{ color: colors.muted, fontSize: 12, marginVertical: 8, lineHeight: 18 }}>
            {allPaid
              ? t(`உங்கள் பட்டாசு பட்டியலை வாட்ஸ்அப்பில் அனுப்புங்கள். ${fmtDay(e.chooseBy, 'ta')}-க்குள் அனுப்பாவிட்டால் கடை தேர்வு செய்யும்.`, `Send your cracker list on WhatsApp. If you do not order by ${fmtDay(e.chooseBy, 'en')}, the shop chooses for you.`)
              : t('கடைசி தவணைக்குப் பின் உங்கள் பட்டாசு பட்டியலை வாட்ஸ்அப்பில் அனுப்புங்கள்.', 'After the last instalment, send your cracker list on WhatsApp.')}
          </Text>
          <Btn compact variant="gold" ta="பட்டாசு பட்டியல் அனுப்பு" en="Send cracker list" icon="logo-whatsapp" onPress={() => openWhatsApp(config.shop, chooseMsg)} />
        </Card>
        <Btn variant="outline" ta="நிபந்தனைகள்" en="Terms & conditions" onPress={() => router.push('/terms')} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.maroon, borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 14 },
  h: { fontSize: 15, fontWeight: '800', color: colors.maroon, marginBottom: 8 },
  inst: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
});
