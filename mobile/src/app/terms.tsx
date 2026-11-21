import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp, usePullRefresh } from '@/context';
import { colors } from '@/theme';
import { Card, Centered, Header, Screen } from '@/components/ui';

/** Terms & conditions — straight from the flyer */
export default function TermsScreen() {
  const { t, config, configError, reloadConfig } = useApp();
  const router = useRouter();
  const pull = usePullRefresh();
  if (!config) return <Centered loading={!configError} message={configError} onRetry={reloadConfig} />;
  const SHOP = config.shop;
  const SCHEME = config.scheme;
  const TERMS = SCHEME?.terms ?? [];
  return (
    <View style={{ flex: 1 }}>
      <Header title={t('அன்பான நிபந்தனைகள்', 'Terms & Conditions')} sub={SCHEME ? t(SCHEME.nameTa, SCHEME.nameEn) : undefined} onBack={() => router.back()} />
      <Screen {...pull}>
        <Card>
          {TERMS.map((x, i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Ionicons name="flame" size={16} color={colors.gold} style={{ marginTop: 3 }} />
              <Text style={{ flex: 1, marginLeft: 10, lineHeight: 21, color: colors.text }}>{t(x.ta, x.en)}</Text>
            </View>
          ))}
        </Card>
        <Text style={{ fontWeight: '800', color: colors.maroon, marginBottom: 8 }}>{t('எங்கள் கடைகள்', 'Our stores')}</Text>
        {SHOP.stores.map((st) => (
          <Card key={st.key}>
            <Text style={{ fontWeight: '800', color: colors.maroon }}>{t(st.ta, st.en)}</Text>
            <Text style={{ color: colors.text, marginTop: 4, lineHeight: 20 }}>{t(st.addrTa, st.addrEn)}</Text>
          </Card>
        ))}
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>
          {t('இந்த நிபந்தனைகள் கடையின் அதிகாரப்பூர்வ துண்டுப்பிரசுரத்தின்படி உள்ளவை.', 'These terms follow the shop’s official scheme flyer. The Tamil text is the original.')}
        </Text>
      </Screen>
    </View>
  );
}
