import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useApp, usePullRefresh } from '@/context';
import { shareText } from '@/contact';
import { colors } from '@/theme';
import { confirm } from '@/confirm';
import { Card, Centered, ErrorText, Progress, Screen, type IconName } from '@/components/ui';

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
  const [copied, setCopied] = useState(false);
  if (!me) return <Centered loading />;

  const shareMsg = me.referralCode
    ? t(`கௌதம் பட்டாசு சிறுசேமிப்பு திட்டத்தில் இணையுங்கள்! என் குறியீடு: ${me.referralCode}`, `Join the Gowtham Crackers savings scheme! Use my referral code: ${me.referralCode}`)
    : '';
  const referralItems = me.referral.items;
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
        <Card>
          <Text style={{ color: colors.maroon, fontWeight: '800', fontSize: 16 }}>{t('பரிந்துரை', 'Referrals')}</Text>
          {!!me.referralCode && (
            <>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{t('உங்கள் குறியீட்டை நண்பர்களுடன் பகிருங்கள்', 'Share your referral code with friends')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  accessibilityLabel="Copy referral code"
                  onPress={async () => { await Clipboard.setStringAsync(me.referralCode ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  style={styles.referralCode}
                >
                  <Text style={{ color: colors.maroon, fontWeight: '800', letterSpacing: 1 }}>{me.referralCode}</Text>
                  <Text style={{ color: copied ? colors.green : colors.muted, fontSize: 11, marginLeft: 8 }}>{copied ? t('நகலெடுக்கப்பட்டது', 'Copied') : t('நகல்', 'Copy')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => shareText(shareMsg)} style={[styles.referralCode, { backgroundColor: colors.maroon, borderColor: colors.maroon }]}>
                  <Ionicons name="share-social-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 12 }}>{t('பகிர்', 'Share')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.text, marginTop: 12 }}>
                {t(`நண்பர் உங்கள் குறியீட்டைப் பயன்படுத்தி எந்தத் திட்டத்திலும் சேர்ந்தால் மட்டுமே பரிந்துரை கணக்கில் சேரும். ${me.referral.target} தகுதியான பரிந்துரைகள் கிடைத்தால் பரிசுக்குத் தகுதி பெறுவீர்கள்.`, `A referral counts when someone uses your code and joins any plan. Reach ${me.referral.target} qualifying referrals to become eligible for the reward.`)}
              </Text>
              {(me.referral.rewardTa || me.referral.rewardEn) && <Text style={{ color: colors.maroon, fontWeight: '700', marginTop: 6 }}>{t(me.referral.rewardTa, me.referral.rewardEn)}</Text>}
              <View style={{ marginTop: 12 }}>
                <Progress value={me.referral.target ? me.referral.joined / me.referral.target : 0} fill={colors.maroon} track={colors.goldLight} />
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{t(`${me.referral.joined} / ${me.referral.target} தகுதியான பரிந்துரைகள்`, `${me.referral.joined} / ${me.referral.target} qualifying referrals`)}</Text>
              </View>
            </>
          )}
          <Text style={{ fontWeight: '700', marginTop: 12 }}>{t('நீங்கள் பரிந்துரைத்தவர்கள்', 'People you referred')}</Text>
          {!referralItems ? (
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              {t('பரிந்துரை பட்டியல் தற்போது கிடைக்கவில்லை. சேவையகத்தைப் புதுப்பிக்கவும்.', 'Referral list is unavailable. Please update the server.')}
            </Text>
          ) : !referralItems.length ? <Text style={{ color: colors.muted, marginTop: 6 }}>{t('இதுவரை யாரும் இல்லை', 'No referrals yet')}</Text> : referralItems.map((r) => (
            <View key={r.id} style={styles.referralRow}>
              <Text style={{ flex: 1, fontWeight: '600' }}>{r.name ?? t('நீக்கப்பட்ட கணக்கு', 'Deleted account')}</Text>
              <Text style={{ color: r.joined ? colors.green : colors.muted, fontSize: 12, fontWeight: '600' }}>
                {r.joined ? t('திட்டத்தில் சேர்ந்தார்', 'Joined a plan') : t('திட்டத்தில் சேரவில்லை', 'Has not joined a plan')}
              </Text>
            </View>
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
  referralCode: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.goldLight, borderWidth: 1, borderColor: colors.gold, borderRadius: 10, paddingHorizontal: 12, height: 38 },
  referralRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border },
});
