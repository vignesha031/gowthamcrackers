import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp, usePullRefresh } from '@/context';
import { colors } from '@/theme';
import { confirm } from '@/confirm';
import { Card, Centered, ErrorText, Screen, type IconName } from '@/components/ui';

interface Item {
  icon: IconName;
  ta: string;
  en: string;
  badge?: string;
  onPress: () => void;
}

/** 7. Profile */
export default function ProfileScreen() {
  const { t, lang, setLang, me, logout, deleteAccount } = useApp();
  const router = useRouter();
  const pull = usePullRefresh();
  const [error, setError] = useState('');
  if (!me) return <Centered loading />;

  const items: Item[] = [
    { icon: 'person-outline', ta: 'என் விவரம்', en: 'My Profile & Delivery', onPress: () => router.push('/my-profile') },
    { icon: 'receipt-outline', ta: 'பணம் செலுத்தியவை', en: 'Payment History', onPress: () => router.push('/payments') },
    { icon: 'notifications-outline', ta: 'அறிவிப்புகள்', en: 'Notifications', badge: me.unreadNotifications ? String(me.unreadNotifications) : undefined, onPress: () => router.push('/notifications') },
    { icon: 'language-outline', ta: 'மொழி', en: 'Language', badge: lang === 'ta' ? 'தமிழ்' : 'English', onPress: () => setLang(lang === 'ta' ? 'en' : 'ta') },
    { icon: 'storefront-outline', ta: 'உதவி & கடைகள்', en: 'Help & Stores', onPress: () => router.push('/help') },
    { icon: 'document-text-outline', ta: 'நிபந்தனைகள்', en: 'Terms & Conditions', onPress: () => router.push('/terms') },
  ];

  const confirmLogout = () =>
    confirm(t('வெளியேறு', 'Logout'), t('நிச்சயமாக வெளியேற வேண்டுமா?', 'Are you sure you want to logout?'), t('வெளியேறு', 'Logout'), t('இல்லை', 'Cancel'), () => {
      logout();
      router.replace('/');
    }, true);

  const confirmDelete = () =>
    confirm(
      t('கணக்கை நீக்கு', 'Delete Account'),
      t('உங்கள் கணக்கும் தனிப்பட்ட விவரங்களும் நீக்கப்படும். கடையின் பணப் பதிவுகள் மட்டும் கணக்கிற்காக இருக்கும். உறுதியா?', 'Your account and personal details will be deleted. Only the shop’s payment records are kept for its accounts. Are you sure?'),
      t('ஆம்', 'Yes'),
      t('இல்லை', 'Cancel'),
      async () => {
        try {
          await deleteAccount();
          router.replace('/');
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      },
      true,
    );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={colors.maroon} />
        </View>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 8 }}>{me.name}</Text>
        <Text style={{ color: colors.goldLight }}>+91 {me.mobile}</Text>
      </View>
      <Screen {...pull}>
        <ErrorText>{error}</ErrorText>
        <Card style={{ padding: 0 }}>
          {items.map((it, i) => (
            <TouchableOpacity key={it.en} onPress={it.onPress} style={[styles.item, i < items.length - 1 && styles.border]}>
              <Ionicons name={it.icon} size={22} color={colors.maroon} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '600' }}>{t(it.ta, it.en)}</Text>
              </View>
              {!!it.badge && <Text style={{ color: colors.muted, fontWeight: '600', marginRight: 6 }}>{it.badge}</Text>}
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </Card>
        <TouchableOpacity onPress={confirmLogout} style={[styles.item, { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.maroon }]}>
          <Ionicons name="log-out-outline" size={22} color={colors.maroon} />
          <Text style={{ color: colors.maroon, fontWeight: '700', marginLeft: 12 }}>{t('வெளியேறு', 'Logout')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={[styles.item, { backgroundColor: '#fff', borderRadius: 14 }]}>
          <Ionicons name="trash-outline" size={22} color={colors.red} />
          <Text style={{ color: colors.red, fontWeight: '600', marginLeft: 12 }}>{t('கணக்கை நீக்கு', 'Delete Account')}</Text>
        </TouchableOpacity>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.maroon, alignItems: 'center', paddingTop: 60, paddingBottom: 18 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.gold },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
