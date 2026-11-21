import type { ViewStyle } from 'react-native';

export const colors = {
  maroon: '#7A1020',
  maroonDark: '#5A0A16',
  gold: '#C8962E',
  goldLight: '#F6E6BC',
  cream: '#FBF3E4',
  card: '#FFFFFF',
  text: '#2B1A14',
  muted: '#8A7A6E',
  border: '#E8D9BE',
  green: '#2E9E5B',
  red: '#C0392B',
} as const;

export const radius = 14;

export const shadow: ViewStyle = {
  shadowColor: '#5A0A16',
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};
