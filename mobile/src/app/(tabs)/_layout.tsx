import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { t, ready, loggedIn } = useApp();
  if (ready && !loggedIn) return <Redirect href="/" />;
  const icon = (name: React.ComponentProps<typeof Ionicons>['name']) =>
    ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} size={size} color={color as string} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.maroon,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10 },
        tabBarStyle: { height: 62, paddingBottom: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarLabel: t('முகப்பு', 'Home'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="savings" options={{ tabBarLabel: t('என் திட்டங்கள்', 'My Plans'), tabBarIcon: icon('layers-outline') }} />
      <Tabs.Screen name="shop" options={{ tabBarLabel: t('கடை', 'Shop'), tabBarIcon: icon('bag-handle-outline') }} />
      <Tabs.Screen name="profile" options={{ tabBarLabel: t('சுயவிவரம்', 'Profile'), tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
