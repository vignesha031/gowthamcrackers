import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp, usePullRefresh } from '@/context';
import { colors } from '@/theme';
import { inr } from '@/utils';
import { Card, Centered, Header, Screen } from '@/components/ui';

/** 8. All plans (the 6 plans from the flyer) */
export default function PlansScreen() {
  const { t, config, configError, reloadConfig } = useApp();
  const router = useRouter();
  const pull = usePullRefresh();
  const SCHEME = config?.scheme;
  if (!config) return <Centered loading={!configError} message={configError} onRetry={reloadConfig} />;
  if (!SCHEME) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={t('திட்டங்கள்', 'Plans')} onBack={() => router.back()} />
        <Screen {...pull}><Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>{t('தற்போது திறந்த திட்டம் எதுவும் இல்லை', 'No scheme is open right now')}</Text></Screen>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <Header title={t('திட்டங்கள்', 'Plans')} sub={t(SCHEME.periodTa, SCHEME.periodEn)} onBack={() => router.back()} />
      <Screen {...pull}>
        {!SCHEME.joinOpen && <Text style={{ color: colors.red, marginBottom: 10 }}>{t('இந்த திட்டத்தில் சேர்க்கை முடிந்தது', 'Joining is closed for this scheme')}</Text>}
        <Text style={{ color: colors.muted, marginBottom: 12 }}>
          {t(`${SCHEME.instalments} மாதங்கள் செலுத்துங்கள் - ${SCHEME.bonusInstalments} மாத போனஸ் உடன் பட்டாசு பெறுங்கள்`, `Pay for ${SCHEME.instalments} months — get crackers with ${SCHEME.bonusInstalments} month bonus on top`)}
        </Text>
        {SCHEME.plans.map((p) => {
          return (
            <TouchableOpacity key={p.id} activeOpacity={0.9} onPress={() => router.push({ pathname: '/plan/[id]', params: { id: p.id } })}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.badge}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>{p.n}</Text>
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontWeight: '800', fontSize: 17, color: colors.maroon }}>Plan {p.n}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>₹{inr(p.monthly)} × {SCHEME.instalments} {t('மாதம்', 'months')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>{t('பட்டாசின் மதிப்பு', 'Cracker value')}</Text>
                    <Text style={{ fontWeight: '800', fontSize: 20, color: colors.green }}>₹{inr(p.crackerValue)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginLeft: 6 }} />
                </View>
                <View style={styles.line} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{t('நீங்கள் செலுத்துவது', 'You pay')}: <Text style={{ color: colors.text, fontWeight: '700' }}>₹{inr(p.total)}</Text></Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{t('கம்பெனி போனஸ்', 'Bonus')}: <Text style={{ color: colors.text, fontWeight: '700' }}>₹{inr(p.bonus)}</Text></Text>
                </View>
                <Text style={{ color: colors.maroon, fontSize: 12, marginTop: 6, fontWeight: '600' }}>🎁 {t(p.giftTa, p.giftEn)}</Text>
              </Card>
            </TouchableOpacity>
          );
        })}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  line: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
});
