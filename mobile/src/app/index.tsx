import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useApp } from '@/context';
import { colors } from '@/theme';
import { AuthScroll } from '@/components/auth-scroll';
import { Btn, Centered, Logo } from '@/components/ui';

/** 1. Welcome (signed-in users go straight to Home) */
export default function WelcomeScreen() {
  const { t, ready, loggedIn, me, config, configError, reloadConfig, refresh } = useApp();
  const router = useRouter();
  const scheme = config?.scheme;
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.maroonDark }} />;
  if (loggedIn && !me) return <Centered loading={false} message={t('சர்வருடன் இணைக்க முடியவில்லை', 'Could not reach the server')} onRetry={refresh} />;
  if (loggedIn && me) return <Redirect href={me.name ? '/(tabs)' : '/name'} />;

  return (
    <AuthScroll safe={false} bg={colors.maroonDark}>
      <View style={{ flex: 1, backgroundColor: colors.maroonDark, justifyContent: 'space-between', padding: 24, gap: 24 }}>
        <SafeAreaView>
          <View style={{ alignItems: 'center', marginTop: 30 }}>
            <Logo size={60} light />
          </View>
        </SafeAreaView>
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="sparkles" size={84} color={colors.gold} />
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 16, lineHeight: 30 }}>
            {scheme ? t(scheme.nameTa, scheme.nameEn) : t('தீபாவளி பட்டாசு சிறுசேமிப்பு திட்டம்', 'Deepavali Crackers Savings Scheme')}
          </Text>
          {!!scheme && <Text style={{ color: colors.goldLight, marginTop: 8, textAlign: 'center' }}>{t(scheme.periodTa, scheme.periodEn)}</Text>}
          {!!configError && !config && (
            <TouchableOpacity onPress={reloadConfig} style={{ marginTop: 14 }}>
              <Text style={{ color: '#fff', textAlign: 'center', textDecorationLine: 'underline' }}>{t('சர்வருடன் இணைக்க முடியவில்லை — மீண்டும் முயற்சி', 'Could not reach the server — tap to retry')}</Text>
            </TouchableOpacity>
          )}
        </View>
        <SafeAreaView>
          <Btn variant="gold" ta="தொடங்கலாம்" en="Get Started" onPress={() => router.push('/login')} />
          <TouchableOpacity onPress={() => router.push('/login')} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff' }}>
              {t('ஏற்கனவே கணக்கு உள்ளவரா? ', 'Already have an account? ')}
              <Text style={{ color: colors.gold, fontWeight: '700', textDecorationLine: 'underline' }}>Login</Text>
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </AuthScroll>
  );
}
