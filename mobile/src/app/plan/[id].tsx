import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/context';
import { colors } from '@/theme';
import { fmtDay, inr } from '@/utils';
import { Btn, Card, Centered, Header, Row, Screen } from '@/components/ui';

/** 9. Plan details → Join */
export default function PlanDetails() {
  const { t, lang, config, configError, reloadConfig } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const SCHEME = config?.scheme;
  if (!config) return <Centered loading={!configError} message={configError} onRetry={reloadConfig} />;
  const plan = SCHEME?.plans.find((p) => p.id === id);
  if (!SCHEME || !plan) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Plan" onBack={() => router.back()} />
        <Screen><Text>{t('திட்டம் கிடைக்கவில்லை', 'Plan not found')}</Text></Screen>
      </View>
    );
  }
  const m = { value: plan.crackerValue, paid: plan.total, bonus: plan.bonus };
  const [gta, gen] = [plan.giftTa, plan.giftEn];
  const steps: [string, string][] = [
    [`மாதம் ₹${inr(plan.monthly)} வீதம் ${SCHEME.instalments} மாதங்கள் (${SCHEME.periodTa}) செலுத்துங்கள்`, `Pay ₹${inr(plan.monthly)} a month for ${SCHEME.instalments} months (${SCHEME.periodEn})`],
    [`ஒவ்வொரு மாதமும் ${SCHEME.dueDay} தேதிக்குள் செலுத்தினால் போனஸ் + பரிசு`, `Pay by the ${SCHEME.dueDay}th each month to keep the bonus + gift`],
    [`${fmtDay(SCHEME.chooseBy, 'ta')}-க்குள் ₹${inr(m.value)} மதிப்பிற்கு பட்டாசு தேர்வு செய்யுங்கள்`, `Choose crackers worth ₹${inr(m.value)} by ${fmtDay(SCHEME.chooseBy, 'en')}`],
    [`${fmtDay(SCHEME.parcelFrom, 'ta')} முதல் பார்சல் / மதுரையில் நேரில் பெறலாம்`, `Get a parcel from ${fmtDay(SCHEME.parcelFrom, 'en')}, or pick up in Madurai`],
  ];

  return (
    <View style={{ flex: 1 }}>
      <Header title={`Plan ${plan.n}`} sub={t(SCHEME.nameTa, SCHEME.nameEn)} onBack={() => router.back()} />
      <Screen>
        <View style={styles.hero}>
          <Text style={{ color: colors.goldLight, fontSize: 12 }}>{t('மாத தவணை', 'Monthly instalment')}</Text>
          <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800' }}>₹{inr(plan.monthly)}</Text>
          <Text style={{ color: colors.goldLight, marginTop: 6 }}>{t('பட்டாசின் மதிப்பு', 'You get crackers worth')}</Text>
          <Text style={{ color: colors.gold, fontSize: 26, fontWeight: '800' }}>₹{inr(m.value)}</Text>
        </View>

        <Card>
          <Row left={t('செலுத்தும் தவணை', 'Instalment')} right={`₹${inr(plan.monthly)} × ${SCHEME.instalments} ${t('மாதம்', 'months')}`} />
          <Row left={t('செலுத்தும் மொத்த பணம்', 'You pay in total')} right={`₹${inr(m.paid)}`} />
          <Row left={t('கம்பெனி போனஸ்', 'Company bonus')} right={`+ ₹${inr(m.bonus)}`} color={colors.green} />
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 }} />
          <Row left={t('பட்டாசின் மதிப்பு', 'Cracker value')} right={`₹${inr(m.value)}`} bold />
        </Card>

        <Card>
          <Text style={styles.h}>{t('சிறப்பு பலன்கள்', 'Special benefits')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="gift-outline" size={22} color={colors.gold} />
            <Text style={{ marginLeft: 10, flex: 1 }}>{t(`${SCHEME.bonusInstalments} மாத போனஸ் (₹${inr(m.bonus)})`, `${SCHEME.bonusInstalments} month bonus (₹${inr(m.bonus)})`)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <Ionicons name="ribbon-outline" size={22} color={colors.gold} />
            <Text style={{ marginLeft: 10, flex: 1 }}>{t(gta, gen)}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.h}>{t('எப்படி செயல்படும்', 'How it works')}</Text>
          {steps.map(([ta, en], i) => (
            <View key={en} style={{ flexDirection: 'row', marginTop: 8 }}>
              <View style={styles.num}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text></View>
              <Text style={{ flex: 1, marginLeft: 10 }}>{t(ta, en)}</Text>
            </View>
          ))}
        </Card>

        <Btn ta="இந்த திட்டத்தில் இணை" en={`Join Plan ${plan.n}`} icon="arrow-forward" disabled={!SCHEME.joinOpen} onPress={() => router.push({ pathname: '/join', params: { plan: plan.id } })} />
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 10 }}>{SCHEME.joinOpen ? t('நிபந்தனைகள் பொருந்தும்', 'Terms and conditions apply') : t('சேர்க்கை முடிந்தது', 'Joining is closed')}</Text>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, backgroundColor: colors.maroon, alignItems: 'center', padding: 20, marginBottom: 14 },
  h: { fontSize: 15, fontWeight: '800', color: colors.maroon, marginBottom: 6 },
  num: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
