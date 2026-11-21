import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/api';
import { useApp } from '@/context';
import { colors } from '@/theme';
import { fmtDay, inr, monthYear } from '@/utils';
import type { PaymentRow } from '@/types';
import { Card, Centered, ErrorText, Header, Pill, Screen } from '@/components/ui';

/** Payment history: every "I have paid" with its status */
export default function PaymentsScreen() {
  const { t, lang } = useApp();
  const router = useRouter();
  const [items, setItems] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems((await api.payments()).items);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!items && !error) return <Centered loading />;
  if (!items) return <Centered message={error} onRetry={load} />;
  const pill = (s: PaymentRow['status']) =>
    s === 'confirmed' ? <Pill text={t('உறுதி ✓', 'Confirmed ✓')} color={colors.green} bg="#E3F4EA" />
    : s === 'rejected' ? <Pill text={t('ஏற்கப்படவில்லை', 'Rejected')} color={colors.red} bg="#FBE5E2" />
    : <Pill text={t('சரிபார்ப்பில்', 'Verifying')} color="#8A6410" bg={colors.goldLight} />;
  const method = (m: PaymentRow['method']) => (m === 'upi' ? 'UPI' : m === 'bank' ? t('வங்கி', 'Bank') : t('ரொக்கம்', 'Cash'));

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('பணம் செலுத்தியவை', 'Payment History')} onBack={() => router.back()} />
      <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
        <ErrorText>{error}</ErrorText>
        {!items.length && (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="receipt-outline" size={64} color={colors.border} />
            <Text style={{ color: colors.muted, marginTop: 10 }}>{t('இன்னும் பணம் செலுத்தவில்லை', 'No payments yet')}</Text>
          </View>
        )}
        {items.map((p) => (
          <Card key={p.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>₹{inr(p.amount)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Plan {p.planN} · {monthYear(p.month, lang)} · {t('தவணை', 'Instalment')} {p.no}</Text>
              </View>
              {pill(p.status)}
            </View>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>{p.ref} · {method(p.method)} · {fmtDay(p.paidOn, lang)}</Text>
            {!!p.rejectReason && <Text style={{ color: colors.red, fontSize: 12, marginTop: 4 }}>{p.rejectReason}</Text>}
          </Card>
        ))}
      </Screen>
    </View>
  );
}
