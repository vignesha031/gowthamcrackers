import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/context';
import { openWhatsApp } from '@/contact';
import { colors } from '@/theme';
import { fmtDay, inr, monthYear, phoneDisplay } from '@/utils';
import { Btn, Card, Row } from '@/components/ui';

/** 12. Payment recorded (waiting for the shop to verify) */
export default function SuccessScreen() {
  const { t, lang, me, config, enrolments } = useApp();
  const router = useRouter();
  const { id, no, ref } = useLocalSearchParams<{ id: string; no: string; ref: string }>();
  const e = enrolments.find((x) => x.id === id);
  const row = e?.instalments.find((x) => x.no === Number(no));
  const phone = config?.shop.phone ?? '';

  const msg = e && row
    ? `வணக்கம், ${me?.name ?? ''} (${me?.mobile ?? ''}). Plan ${e.planN} - ${monthYear(row.month, 'en')} தவணை ₹${inr(row.amount)} செலுத்தினேன். Ref ${ref}. Screenshot இணைக்கப்பட்டுள்ளது.`
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, padding: 20, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Ionicons name="checkmark-circle" size={96} color={colors.green} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.green, textAlign: 'center' }}>{t('தவணை பதிவு செய்யப்பட்டது!', 'Instalment recorded!')}</Text>
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 4 }}>{t('கடை சரிபார்த்த பின் உறுதி செய்யப்படும்', 'It will be confirmed once the shop verifies it')}</Text>
      </View>
      {e && row && (
        <Card>
          <Row left="Plan" right={`Plan ${e.planN}`} />
          <Row left={t('மாதம்', 'Month')} right={monthYear(row.month, lang)} />
          <Row left={t('தொகை', 'Amount')} right={`₹ ${inr(row.amount)}`} bold />
          {!!ref && <Row left={t('குறிப்பு எண்', 'Reference')} right={ref} />}
          {!!row.paidOn && <Row left={t('நாள்', 'Date')} right={fmtDay(row.paidOn, lang)} />}
          {row.onTime !== null && <Row left={t('நேரத்தில் செலுத்தியது', 'Paid on time')} right={row.onTime ? t('ஆம்', 'Yes') : t('இல்லை', 'No')} color={row.onTime ? colors.green : colors.red} />}
        </Card>
      )}
      <Text style={{ textAlign: 'center', color: colors.text, marginBottom: 12, lineHeight: 20 }}>
        {t(`அடுத்த படி: பணம் செலுத்திய ஸ்க்ரீன் ஷாட்டை ${phoneDisplay(phone)} வாட்ஸ்அப்பில் அனுப்புங்கள்.`, `Next step: send your payment screenshot to WhatsApp ${phoneDisplay(phone)}.`)}
      </Text>
      {!!config && <Btn ta="ஸ்க்ரீன் ஷாட் அனுப்பு" en="Send screenshot on WhatsApp" icon="logo-whatsapp" onPress={() => openWhatsApp(config.shop, msg)} />}
      <View style={{ height: 10 }} />
      <Btn variant="gold" ta="என் திட்டத்தைப் பார்" en="View my plan" onPress={() => { router.dismissAll(); router.push({ pathname: '/chit/[id]', params: { id: id ?? '' } }); }} />
      <View style={{ height: 10 }} />
      <Btn variant="outline" ta="முகப்பு" en="Back to Home" onPress={() => router.dismissAll()} />
    </View>
  );
}
