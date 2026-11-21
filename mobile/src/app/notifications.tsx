import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/api';
import { useApp } from '@/context';
import { colors } from '@/theme';
import { fmtStamp } from '@/utils';
import type { Notice } from '@/types';
import { Card, Centered, ErrorText, Header, Screen, type IconName } from '@/components/ui';

const ICON: Record<string, IconName> = { payments: 'card-outline', dues: 'alarm-outline', offers: 'pricetag-outline', delivery: 'cube-outline', general: 'notifications-outline' };

/** Notifications (opened from the bell on Home) */
export default function NotificationsScreen() {
  const { t, lang, refresh } = useApp();
  const router = useRouter();
  const [items, setItems] = useState<Notice[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api.notifications()).items);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const unread = items?.filter((n) => !n.read).length ?? 0;
  async function readAll() {
    try { await api.readAllNotifications(); } catch { return; }
    setItems((l) => l?.map((n) => ({ ...n, read: true })) ?? l);
    refresh();
  }
  async function open(n: Notice) {
    if (n.read) return;
    setItems((l) => l?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? l);
    api.readNotification(n.id).then(() => refresh()).catch(() => {});
  }

  if (!items && !error) return <Centered loading />;
  return (
    <View style={{ flex: 1 }}>
      <Header title={t('அறிவிப்புகள்', 'Notifications')} onBack={() => router.back()} />
      <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); await refresh(); setRefreshing(false); }}>
        <ErrorText>{error}</ErrorText>
        {unread > 0 && (
          <TouchableOpacity onPress={readAll} style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
            <Text style={{ color: colors.maroon, fontWeight: '700' }}>{t('அனைத்தையும் படித்ததாகக் குறி', 'Mark all as read')}</Text>
          </TouchableOpacity>
        )}
        {items && !items.length && (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.border} />
            <Text style={{ color: colors.muted, marginTop: 10 }}>{t('அறிவிப்புகள் எதுவும் இல்லை', 'No notifications yet')}</Text>
          </View>
        )}
        {items?.map((n) => (
          <TouchableOpacity key={n.id} activeOpacity={0.85} onPress={() => open(n)}>
            <Card style={[{ flexDirection: 'row' }, !n.read && { borderColor: colors.gold, backgroundColor: '#FFFBF1' }]}>
              <Ionicons name={ICON[n.kind] ?? ICON.general} size={24} color={colors.maroon} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontWeight: '800', color: colors.text }}>{t(n.titleTa, n.titleEn)}</Text>
                  {!n.read && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.maroon }} />}
                </View>
                <Text style={{ color: colors.text, marginTop: 3, lineHeight: 19 }}>{t(n.bodyTa, n.bodyEn)}</Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{fmtStamp(n.createdAt, lang)}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </Screen>
    </View>
  );
}
