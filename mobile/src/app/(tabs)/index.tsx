import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useApp, useFocusRefresh, usePullRefresh } from '@/context';
import { shareText } from '@/contact';
import { colors, radius, shadow } from '@/theme';
import { fmtDay, inr, monthYear } from '@/utils';
import { Btn, Card, Centered, ErrorText, Logo, Progress, Screen, type IconName } from '@/components/ui';

/** 5. Home */
export default function HomeScreen() {
  const { t, lang, setLang, me, config, enrolments, loadError, ready } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pull = usePullRefresh();
  useFocusRefresh();
  const SCHEME = config?.scheme;
  const [copied, setCopied] = useState(false);
  const bannerScroll = useRef<ScrollViewInstance>(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const banners = config?.banners?.filter((banner) => banner.active) ?? [];
  const bannerWidth = useWindowDimensions().width - 32;
  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      const next = (bannerIndex + 1) % banners.length;
      bannerScroll.current?.scrollTo({ x: next * bannerWidth, animated: true });
      setBannerIndex(next);
    }, 4500);
    return () => clearInterval(timer);
  }, [bannerIndex, bannerWidth, banners.length]);
  if (!me || !config) return <Centered loading message={t('ஏற்றுகிறது…', 'Loading…')} />;

  // The unpaid instalment that is due soonest, across my active plans
  const upcoming = enrolments
    .filter((e) => e.status === 'active')
    .map((e) => ({ e, row: e.instalments.find((i) => i.status === 'pending') }))
    .filter((x): x is { e: typeof x.e; row: NonNullable<typeof x.row> } => !!x.row)
    .sort((a, b) => a.row.dueDate.localeCompare(b.row.dueDate))[0];
  const waiting = enrolments.reduce((n, e) => n + e.verifyingCount, 0);
  const ref = me.referral;

  const quick: { icon: IconName; ta: string; en: string; go: () => void }[] = [
    { icon: 'layers-outline', ta: 'என் திட்டங்கள்', en: 'My Plans', go: () => router.navigate('/savings') },
    { icon: 'pricetags-outline', ta: 'திட்டங்கள்', en: 'All Plans', go: () => router.push('/plans') },
    { icon: 'receipt-outline', ta: 'பணம் செலுத்தியவை', en: 'Payments', go: () => router.push('/payments') },
    { icon: 'storefront-outline', ta: 'எங்கள் கடை', en: 'Our Stores', go: () => router.push('/help') },
  ];
  const shareMsg = me.referralCode
    ? t(`கௌதம் பட்டாசு சிறுசேமிப்பு திட்டத்தில் இணையுங்கள்! என் குறியீடு: ${me.referralCode}`, `Join the Gowtham Crackers savings scheme! Use my referral code: ${me.referralCode}`)
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Logo size={28} light />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={() => setLang(lang === 'ta' ? 'en' : 'ta')} style={styles.langBtn} accessibilityLabel="Change language">
            <Text style={{ color: '#fff', fontWeight: '600' }}>{lang === 'ta' ? 'தமிழ் ⇄ EN' : 'EN ⇄ தமிழ்'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" style={{ padding: 4 }}>
            <Ionicons name="notifications-outline" size={26} color="#fff" />
            {me.unreadNotifications > 0 && (
              <View style={styles.badge}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{me.unreadNotifications > 9 ? '9+' : me.unreadNotifications}</Text></View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Screen {...pull}>
       
        <ErrorText>{loadError && ready ? t('புதுப்பிக்க முடியவில்லை. இழுத்து மீண்டும் முயற்சிக்கவும்.', 'Could not refresh. Pull down to try again.') : undefined}</ErrorText>

        {banners.length > 0 && <View style={{ marginBottom: 14 }}>
          <ScrollView ref={bannerScroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setBannerIndex(Math.round(event.nativeEvent.contentOffset.x / bannerWidth))}>
            {banners.map((banner) => <View key={banner.id} style={[styles.banner, { width: bannerWidth }]}>
              <Image source={{ uri: banner.image }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityLabel={banner.title || 'Promotional banner'} />
            </View>)}
          </ScrollView>
          {banners.length > 1 && <View style={styles.dots}>{banners.map((banner, index) => <View key={banner.id} style={[styles.dot, index === bannerIndex && styles.dotActive]} />)}</View>}
        </View>}

        {upcoming ? (
          <Card>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{t('அடுத்த தவணை', 'Next instalment')}</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.maroon, marginTop: 2 }}>₹{inr(upcoming.row.amount)}</Text>
            <Text style={{ color: colors.text, marginTop: 2 }}>
              Plan {upcoming.e.planN} · {monthYear(upcoming.row.month, lang)}
              {' · '}
              {t(`${fmtDay(upcoming.row.dueDate, 'ta')}-க்குள்`, `by ${fmtDay(upcoming.row.dueDate, 'en')}`)}
            </Text>
            {waiting > 0 && <Text style={{ color: '#8A6410', fontSize: 12, marginTop: 4 }}>{t(`${waiting} தவணை சரிபார்ப்பில் உள்ளது`, `${waiting} payment(s) waiting for the shop to verify`)}</Text>}
            {upcoming.row.state === 'overdue' && (
              <Text style={{ color: colors.red, fontSize: 12, marginTop: 4 }}>{t('தாமதமானால் போனஸ் & பரிசு கிடைக்காது', 'Late payment puts your bonus & gift at risk')}</Text>
            )}
            <View style={{ height: 12 }} />
            <Btn ta="இப்போது செலுத்து" en="Pay Now" icon="arrow-forward" onPress={() => router.push({ pathname: '/pay', params: { id: upcoming.e.id } })} />
          </Card>
        ) : (
          <Card>
            <Text style={{ fontWeight: '800', color: colors.maroon, fontSize: 16 }}>{t('இன்றே இணையுங்கள்', 'Join today')}</Text>
            <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 12 }}>
              {SCHEME && SCHEME.plans.length > 0
                ? t(`மாதம் ₹${inr(SCHEME.plans[0].monthly)} முதல் ₹${inr(SCHEME.plans[SCHEME.plans.length - 1].monthly)} வரை · ${SCHEME.instalments} மாதங்கள்`, `₹${inr(SCHEME.plans[0].monthly)} to ₹${inr(SCHEME.plans[SCHEME.plans.length - 1].monthly)} a month · ${SCHEME.instalments} months`)
                : t('விரைவில் புதிய திட்டம்', 'A new scheme is coming soon')}
            </Text>
            <Btn variant="gold" ta="திட்டங்களைப் பார்" en="View Plans" icon="arrow-forward" disabled={!SCHEME} onPress={() => router.push('/plans')} />
          </Card>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 }}>
          {quick.map((q) => (
            <TouchableOpacity key={q.en} onPress={q.go} style={{ alignItems: 'center', width: '24%' }}>
              <View style={styles.quickIcon}>
                <Ionicons name={q.icon} size={24} color={colors.maroon} />
              </View>
              <Text style={{ fontSize: 11, textAlign: 'center', marginTop: 5, fontWeight: '600' }}>{t(q.ta, q.en)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!me.referralCode && (
          <View style={styles.referral}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="people" size={26} color={colors.maroon} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.maroon, fontWeight: '800' }}>{t('நண்பர்களை அழைத்து வாருங்கள்', 'Refer friends')}</Text>
                <Text style={{ color: colors.maroon, lineHeight: 19, marginTop: 2 }}>{t(ref.rewardTa, ref.rewardEn)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
              <TouchableOpacity
                accessibilityLabel="Copy referral code"
                onPress={async () => { await Clipboard.setStringAsync(me.referralCode ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                style={styles.code}
              >
                <Text style={{ fontWeight: '800', color: colors.maroon, letterSpacing: 1 }}>{me.referralCode}</Text>
                <Text style={{ fontSize: 11, color: copied ? colors.green : colors.muted, marginLeft: 8 }}>{copied ? t('நகலெடுக்கப்பட்டது', 'Copied') : t('நகல்', 'Copy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shareText(shareMsg)} style={[styles.code, { backgroundColor: colors.maroon, borderColor: colors.maroon }]}>
                <Ionicons name="share-social-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 12 }}>{t('பகிர்', 'Share')}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 10 }}>
              <Progress value={ref.target ? ref.joined / ref.target : 0} fill={colors.maroon} track="#fff" />
              <Text style={{ color: colors.maroon, fontSize: 11, marginTop: 4 }}>{t(`${ref.joined} / ${ref.target} நண்பர்கள் இணைந்தனர்`, `${ref.joined} / ${ref.target} friends joined`)}</Text>
            </View>
          </View>
        )}

        {SCHEME && (
          <Card style={{ marginTop: 14 }}>
            <Text style={{ fontWeight: '800', color: colors.maroon, marginBottom: 6 }}>{t('முக்கிய தேதிகள்', 'Key dates')}</Text>
            <Date_ ta="ஒவ்வொரு மாதமும்" en="Every month" ta2={`${SCHEME.dueDay} தேதிக்குள் தவணை`} en2={`Pay by the ${SCHEME.dueDay}th`} />
            <Date_ ta={fmtDay(SCHEME.chooseBy, 'ta')} en={fmtDay(SCHEME.chooseBy, 'en')} ta2="பட்டாசு தேர்வு செய்ய கடைசி நாள்" en2="Last day to choose crackers" />
            <Date_ ta={fmtDay(SCHEME.parcelFrom, 'ta')} en={fmtDay(SCHEME.parcelFrom, 'en')} ta2="பார்சல் அனுப்பப்படும்" en2="Parcels dispatched from" />
            <Date_ ta={fmtDay(SCHEME.pickupBy, 'ta')} en={fmtDay(SCHEME.pickupBy, 'en')} ta2="மதுரை கடையில் நேரில் பெற" en2="Madurai store pick-up by" />
          </Card>
        )}
      </Screen>
    </View>
  );
}

function Date_({ ta, en, ta2, en2 }: { ta: string; en: string; ta2: string; en2: string }) {
  const { t } = useApp();
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
      <Ionicons name="ellipse" size={8} color={colors.gold} style={{ marginTop: 6 }} />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>{t(ta, en)}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{t(ta2, en2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: colors.maroon, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  langBtn: { borderWidth: 1, borderColor: colors.gold, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4 },
  banner: { height: 168, borderRadius: radius + 2, overflow: 'hidden', backgroundColor: colors.goldLight, ...shadow },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d9c9b0' },
  dotActive: { width: 18, backgroundColor: colors.maroon },
  quickIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  referral: { backgroundColor: colors.goldLight, borderRadius: radius, padding: 14, marginTop: 8 },
  code: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.gold, borderRadius: 10, paddingHorizontal: 12, height: 38 },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
});
