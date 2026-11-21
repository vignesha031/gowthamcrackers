import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp, useFocusRefresh, usePullRefresh } from '@/context';
import { colors } from '@/theme';
import { inr, monthYear } from '@/utils';
import { Btn, Card, Centered, ErrorText, Header, Pill, Progress, Screen } from '@/components/ui';

/** 6. My Plans */
export default function MyPlansScreen() {
  const { t, lang, ready, me, enrolments, loadError, refresh } = useApp();
  const router = useRouter();
  const pull = usePullRefresh();
  useFocusRefresh();
  if (!ready || (!me && !loadError)) return <Centered loading />;
  if (!me && loadError) return <Centered message={loadError} onRetry={refresh} />;
  const totalPaid = enrolments.reduce((a, e) => a + e.paidAmount, 0);

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('என் திட்டங்கள்', 'My Plans')} />
      <Screen {...pull}>
        <ErrorText>{loadError ? t('புதுப்பிக்க முடியவில்லை. இழுத்து மீண்டும் முயற்சிக்கவும்.', 'Could not refresh. Pull down to try again.') : undefined}</ErrorText>
        {!enrolments.length ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="sparkles-outline" size={64} color={colors.border} />
            <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 12 }}>{t('நீங்கள் இன்னும் எந்த திட்டத்திலும் இணையவில்லை', 'You have not joined any plan yet')}</Text>
            <Btn variant="gold" ta="திட்டங்களைப் பார்" en="View Plans" onPress={() => router.push('/plans')} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : (
          <>
            <View style={styles.total}>
              <Text style={{ color: colors.goldLight, fontSize: 12 }}>{t('இதுவரை செலுத்தியது', 'Total paid so far')}</Text>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>₹{inr(totalPaid)}</Text>
            </View>
            {enrolments.map((e) => {
              const next = e.instalments.find((i) => i.status === 'pending');
              const done = e.status === 'completed' || e.paidCount === e.totalCount;
              return (
                <Card key={e.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="ribbon-outline" size={26} color={colors.gold} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: colors.maroon, fontSize: 16 }}>Plan {e.planN} · ₹{inr(e.monthly)} / {t('மாதம்', 'month')}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{t('பட்டாசு மதிப்பு', 'Cracker value')} ₹{inr(e.crackerValueIfOnTrack)}</Text>
                    </View>
                    {done ? (
                      <Pill text={t('முடிந்தது', 'Completed')} color={colors.green} bg="#E3F4EA" />
                    ) : e.overdueCount > 0 ? (
                      <Pill text={t('தாமதம்', 'Overdue')} color={colors.red} bg="#FBE5E2" />
                    ) : e.verifyingCount > 0 ? (
                      <Pill text={t('சரிபார்ப்பில்', 'Verifying')} color="#8A6410" bg={colors.goldLight} />
                    ) : null}
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <Progress value={e.paidCount / e.totalCount} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{e.paidCount} / {e.totalCount} {t('தவணைகள்', 'instalments')}</Text>
                      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>₹{inr(e.paidAmount)} / ₹{inr(e.monthly * e.totalCount)}</Text>
                    </View>
                  </View>
                  {next && (
                    <Text style={{ color: colors.text, marginTop: 8, fontSize: 12 }}>
                      {t('அடுத்தது', 'Next')}: {monthYear(next.month, lang)}
                    </Text>
                  )}
                  <View style={styles.actions}>
                    {!!next && e.status === 'active' && <Btn compact variant="gold" ta="தவணை செலுத்து" en="Pay" onPress={() => router.push({ pathname: '/pay', params: { id: e.id } })} style={{ flex: 1 }} />}
                    <Btn compact ta="விவரங்கள்" en="Details" onPress={() => router.push({ pathname: '/chit/[id]', params: { id: e.id } })} style={{ flex: 1 }} />
                  </View>
                </Card>
              );
            })}
            <Btn variant="outline" ta="மற்றொரு திட்டத்தில் இணை" en="Join another plan" onPress={() => router.push('/plans')} />
          </>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  total: { backgroundColor: colors.maroon, borderRadius: 16, padding: 16, marginBottom: 14, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
