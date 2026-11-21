import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp, usePullRefresh } from '@/context';
import { callNumber, openMap, openWhatsApp } from '@/contact';
import { phoneDisplay } from '@/utils';
import { colors } from '@/theme';
import { Card, Centered, Header, Screen, type IconName } from '@/components/ui';

/** Help & Stores */
export default function HelpScreen() {
  const { t, config, configError, reloadConfig } = useApp();
  const router = useRouter();
  const pull = usePullRefresh();
  if (!config) return <Centered loading={!configError} message={configError} onRetry={reloadConfig} />;
  const SHOP = config.shop;
  const actions: { icon: IconName; ta: string; en: string; color: string; go: () => void }[] = [
    { icon: 'call', ta: 'அழைக்க', en: 'Call Us', color: colors.maroon, go: () => callNumber(SHOP.phone) },
    { icon: 'logo-whatsapp', ta: 'வாட்ஸ்அப்', en: 'WhatsApp', color: '#25D366', go: () => openWhatsApp(SHOP) },
    { icon: 'chatbox-ellipses', ta: 'புகார் / ஆலோசனை', en: 'Suggestions', color: colors.gold, go: () => callNumber(SHOP.complaintsPhone) },
  ];
  return (
    <View style={{ flex: 1 }}>
      <Header title={t('உதவி & கடைகள்', 'Help & Stores')} onBack={() => router.back()} />
      <Screen {...pull}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 18 }}>
          {actions.map((a) => (
            <TouchableOpacity key={a.en} onPress={a.go} style={{ alignItems: 'center', width: 100 }}>
              <View style={[styles.actionIcon, { borderColor: a.color }]}>
                <Ionicons name={a.icon} size={24} color={a.color} />
              </View>
              <Text style={{ fontSize: 11, marginTop: 4, textAlign: 'center' }}>{t(a.ta, a.en)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card>
          <Text style={styles.h}>{t('வாடிக்கையாளர் சேவை / பணம் செலுத்த', 'Customer care / payments')}</Text>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>{phoneDisplay(SHOP.phone)}</Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>{t('ஆலோசனை / புகார்', 'Suggestions / complaints')}: <Text style={{ color: colors.text, fontWeight: '700' }}>{phoneDisplay(SHOP.complaintsPhone)}</Text></Text>
        </Card>

        <Text style={[styles.h, { marginTop: 4 }]}>{t('எங்கள் கடைகள்', 'Our stores')}</Text>
        {SHOP.stores.map((s) => (
          <Card key={s.key}>
            <Text style={{ fontWeight: '800', color: colors.maroon }}>{t(s.ta, s.en)}</Text>
            <Text style={{ color: colors.text, marginTop: 4, lineHeight: 20 }}>{t(s.addrTa, s.addrEn)}</Text>
            <TouchableOpacity onPress={() => openMap(s.map)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <Ionicons name="location" size={18} color={colors.red} />
              <Text style={{ marginLeft: 6, color: colors.maroon, fontWeight: '700' }}>{t('வரைபடத்தில் பார்', 'View on map')}</Text>
            </TouchableOpacity>
          </Card>
        ))}
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{SHOP.nameEn} · {t('1987 முதல்', `Since ${SHOP.since}`)}</Text>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  actionIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  h: { fontWeight: '800', color: colors.maroon, marginBottom: 6 },
});
