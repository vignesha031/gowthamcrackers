import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/context';
import { uid } from '@/api';
import { openUpi } from '@/contact';
import { confirm } from '@/confirm';
import { colors } from '@/theme';
import { inr, monthYear, phoneDisplay } from '@/utils';
import { Btn, Card, Centered, ErrorText, Field, Header, Screen } from '@/components/ui';

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useApp();
  const [done, setDone] = useState(false);
  return (
    <TouchableOpacity
      onPress={async () => {
        await Clipboard.setStringAsync(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      accessibilityLabel={`Copy ${label}`}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}
    >
      <Text style={{ color: colors.muted, width: 84, fontSize: 12 }}>{label}</Text>
      <Text style={{ flex: 1, fontWeight: '700', color: colors.text }}>{value}</Text>
      <Text style={{ color: done ? colors.green : colors.maroon, fontSize: 11, fontWeight: '700' }}>{done ? t('நகலெடுக்கப்பட்டது', 'Copied') : t('நகல்', 'Copy')}</Text>
    </TouchableOpacity>
  );
}

/**
 * 11. Pay an instalment.
 * The shop collects through UPI / bank transfer (as on the flyer). The customer pays in their
 * UPI app, comes back, taps "I have paid" — it is recorded as awaiting verification, and they
 * send the screenshot on WhatsApp. (A backend can later flip the status to "confirmed".)
 */
export default function PayScreen() {
  const { t, lang, me, config, enrolments, pay } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const e = enrolments.find((x) => x.id === id);
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // one key per screen visit: if the tap is retried (slow network), the server returns the first payment
  const key = useRef(uid());
  if (!e || !config || !me) return <Centered loading />;
  const SHOP = config.shop;
  const row = e.instalments.find((i) => i.status === 'pending');

  if (!row) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={t('பணம் செலுத்துதல்', 'Payment')} onBack={() => router.back()} />
        <Screen>
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="checkmark-circle" size={80} color={colors.green} />
            <Text style={{ fontWeight: '800', fontSize: 18, marginTop: 10, textAlign: 'center' }}>
              {e.verifyingCount ? t('அனைத்து தவணைகளும் சரிபார்ப்பில் உள்ளன', 'All instalments are paid or waiting for the shop to verify') : t('அனைத்து தவணைகளும் செலுத்தப்பட்டன!', 'All instalments are paid!')}
            </Text>
          </View>
        </Screen>
      </View>
    );
  }

  const month = monthYear(row.month, lang);
  const note = `Plan${e.planN} ${monthYear(row.month, 'en').replace(' ', '')} ${me.mobile}`;
  const overdue = row.state === 'overdue';

  async function record() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await pay(e!.id, { method, ...(utr.trim() && { utr: utr.trim() }) }, key.current);
      router.replace({ pathname: '/success', params: { id: e!.id, no: String(row!.no), ref: r.payment.ref } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('பணம் செலுத்துதல்', 'Payment')} sub={`Plan ${e.planN} · ${month}`} onBack={() => router.back()} />
      <Screen>
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="ribbon-outline" size={30} color={colors.gold} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '800' }}>₹ {inr(row.amount)}</Text>
            <Text style={{ color: colors.muted }}>
              {t('தவணை', 'Instalment')} {row.no} / {e.totalInstalments} · {month}
            </Text>
          </View>
        </Card>
        {!!row.rejectedReason && (
          <Text style={{ color: colors.red, marginBottom: 12, lineHeight: 20 }}>{t('முந்தைய பணம் ஏற்கப்படவில்லை', 'Your last payment was not accepted')}: {row.rejectedReason}</Text>
        )}
        {overdue && (
          <Text style={{ color: colors.red, marginBottom: 12, lineHeight: 20 }}>
            {t(`${e.dueDay} தேதி கடந்துவிட்டது. இப்போது செலுத்தினால் போனஸ் & பரிசு கிடைக்காது.`, `The ${e.dueDay}th has passed. Paying now means no bonus & free gift (see terms).`)}
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {([['upi', 'phone-portrait-outline', 'UPI'], ['bank', 'business-outline', t('வங்கி மாற்றம்', 'Bank transfer')]] as const).map(([k, ic, label]) => (
            <TouchableOpacity key={k} onPress={() => setMethod(k)} style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', borderColor: method === k ? colors.maroon : colors.border, backgroundColor: method === k ? colors.goldLight : '#fff' }}>
              <Ionicons name={ic} size={22} color={colors.maroon} />
              <Text style={{ fontWeight: '700', marginTop: 4, fontSize: 12 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {method === 'upi' ? (
          <Card>
            <Btn variant="gold" ta="UPI ஆப்பில் செலுத்து" en="Pay with GPay / PhonePe / Paytm" icon="open-outline" onPress={() => openUpi(SHOP, row.amount, note)} />
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginVertical: 10 }}>{t('அல்லது இந்த UPI ID-க்கு அனுப்பவும்', 'or send to this UPI ID')}</Text>
            <CopyRow label="UPI ID" value={SHOP.upiId} />
            <CopyRow label={t('பெயர்', 'Name')} value={SHOP.legalName} />
          </Card>
        ) : (
          <Card>
            <CopyRow label={t('கணக்கு எண்', 'A/C No.')} value={SHOP.bank.number} />
            <CopyRow label={t('பெயர்', 'Name')} value={SHOP.bank.name} />
            <CopyRow label="IFSC" value={SHOP.bank.ifsc} />
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{SHOP.bank.bank} · {SHOP.bank.branch} · {SHOP.bank.type}</Text>
          </Card>
        )}

        <Field label={method === 'upi' ? t('UPI பரிவர்த்தனை எண் / UTR (விருப்பம்)', 'UPI transaction ID / UTR (optional)') : t('வங்கி UTR / குறிப்பு எண் (விருப்பம்)', 'Bank UTR / reference number (optional)')} value={utr} onChangeText={setUtr} autoCapitalize="characters" maxLength={40} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Ionicons name="logo-whatsapp" size={16} color={colors.green} />
          <Text style={{ marginLeft: 6, color: colors.muted, fontSize: 12, flex: 1 }}>
            {t(`பணம் செலுத்திய பின் ஸ்க்ரீன் ஷாட்டை ${phoneDisplay(SHOP.phone)} வாட்ஸ்அப்பில் அனுப்புங்கள்`, `After paying, send the screenshot to WhatsApp ${phoneDisplay(SHOP.phone)}`)}
          </Text>
        </View>

        <Btn
          ta={`₹${inr(row.amount)} செலுத்தினேன்`}
          en="I have paid"
          disabled={busy}
          onPress={() =>
            confirm(
              t('பணம் செலுத்திவிட்டீர்களா?', 'Have you paid?'),
              t(`₹${inr(row.amount)} செலுத்தியிருந்தால் மட்டும் உறுதி செய்யவும்.`, `Confirm only if you have already paid ₹${inr(row.amount)}.`),
              t('ஆம், செலுத்தினேன்', 'Yes, I paid'),
              t('இல்லை', 'Not yet'),
              record,
            )
          }
        />
        <ErrorText>{error}</ErrorText>
      </Screen>
    </View>
  );
}
