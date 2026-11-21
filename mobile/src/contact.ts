import { Alert, Linking, Share } from 'react-native';
import type { Shop } from '@/types';

async function open(url: string, fail: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(fail);
  }
}

export const openWhatsApp = (shop: Shop, text?: string) =>
  open(`https://wa.me/91${shop.phone}${text ? `?text=${encodeURIComponent(text)}` : ''}`, 'Could not open WhatsApp');

export const callNumber = (num: string) => open(`tel:+91${num}`, 'Could not start the call');

export const openMap = (query: string) => open(`https://maps.google.com/?q=${encodeURIComponent(query)}`, 'Could not open maps');

/** UPI deep link — opens GPay / PhonePe / Paytm with the amount filled in. */
export const openUpi = (shop: Shop, amount: number, note: string) =>
  open(
    `upi://pay?pa=${encodeURIComponent(shop.upiId)}&pn=${encodeURIComponent(shop.legalName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`,
    'No UPI app found. Use the UPI ID or bank details below.',
  );

export const shareText = async (message: string) => {
  try { await Share.share({ message }); } catch { /* cancelled */ }
};
