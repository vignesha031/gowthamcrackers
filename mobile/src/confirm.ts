import { Alert, Platform } from 'react-native';

/** Yes/No dialog that also works on web (Alert.alert buttons are a no-op there). */
export function confirm(title: string, message: string, yes: string, no: string, onYes: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: no, style: 'cancel' },
    { text: yes, style: destructive ? 'destructive' : 'default', onPress: onYes },
  ]);
}
