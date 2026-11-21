import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context';
import { openWhatsApp } from '@/contact';
import { colors } from '@/theme';
import { Btn, Card, Header, Screen, type IconName } from '@/components/ui';

/**
 * Online cracker shop — placeholder tab.
 * When the catalogue is ready, build it here (product list, cart, checkout).
 * Saved-up scheme balance can later be offered as a payment option at checkout.
 */
const CATEGORIES: { icon: IconName; ta: string; en: string }[] = [
  { icon: 'sparkles-outline', ta: 'கம்பி மத்தாப்பு', en: 'Sparklers' },
  { icon: 'flower-outline', ta: 'பூந்தொட்டி', en: 'Flower pots' },
  { icon: 'rocket-outline', ta: 'ராக்கெட்', en: 'Rockets' },
  { icon: 'gift-outline', ta: 'கிஃப்ட் பாக்ஸ்', en: 'Gift boxes' },
  { icon: 'volume-high-outline', ta: 'சத்த வெடிகள்', en: 'Sound crackers' },
  { icon: 'happy-outline', ta: 'சிறுவர் பட்டாசு', en: 'Kids’ crackers' },
];

export default function ShopScreen() {
  const { t, config } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <Header title={t('ஆன்லைன் கடை', 'Online Shop')} />
      <Screen>
        <View style={styles.hero}>
          <Ionicons name="bag-handle" size={56} color={colors.gold} />
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 8 }}>{t('விரைவில்...', 'Coming soon')}</Text>
          <Text style={{ color: colors.goldLight, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
            {t('பட்டாசுகளை ஆன்லைனில் வாங்கும் வசதி விரைவில் வருகிறது', 'Buy your crackers online — launching soon')}
          </Text>
        </View>

        <Text style={{ fontWeight: '800', color: colors.maroon, marginBottom: 10 }}>{t('வரவிருக்கும் வகைகள்', 'What to expect')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {CATEGORIES.map((c) => (
            <View key={c.en} style={styles.cat}>
              <Ionicons name={c.icon} size={26} color={colors.maroon} />
              <Text style={{ fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' }}>{t(c.ta, c.en)}</Text>
            </View>
          ))}
        </View>

        <Card>
          <Text style={{ fontWeight: '800', color: colors.maroon }}>{t('இப்போது ஆர்டர் செய்ய', 'Order right now')}</Text>
          <Text style={{ color: colors.muted, marginVertical: 8 }}>{t('தற்போது வாட்ஸ்அப் மூலம் ஆர்டர் செய்யலாம்', 'You can place orders on WhatsApp for now')}</Text>
          {!!config && <Btn variant="gold" ta="வாட்ஸ்அப்பில் ஆர்டர்" en="Order on WhatsApp" icon="logo-whatsapp" onPress={() => openWhatsApp(config.shop, 'வணக்கம், பட்டாசு ஆர்டர் செய்ய வேண்டும்.')} />}
        </Card>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.maroon, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 18 },
  cat: { width: '31%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, alignItems: 'center' },
});
