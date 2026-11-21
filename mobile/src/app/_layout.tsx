import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, AuthGuard } from '@/context';

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="dark" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="success" options={{ gestureEnabled: false }} />
      </Stack>
    </AppProvider>
  );
}
