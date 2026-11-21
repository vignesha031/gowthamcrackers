import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context';
import type { Draft } from '@/types';
import { colors } from '@/theme';
import { Field } from '@/components/ui';

/** How the customer wants to receive crackers: parcel to address, or pick-up in Madurai. */
export function validDelivery(d: Draft) {
  return d.deliveryMode === 'pickup' || (d.address.trim().length > 4 && d.city.trim().length > 1 && /^\d{6}$/.test(d.pincode));
}

export function DeliveryForm({ draft, onChange }: { draft: Draft; onChange: (patch: Partial<Draft>) => void }) {
  const { t, config } = useApp();
  const stores = config?.shop.stores ?? [];
  const opt = (key: 'parcel' | 'pickup', icon: React.ComponentProps<typeof Ionicons>['name'], ta: string, en: string) => {
    const on = draft.deliveryMode === key;
    return (
      <TouchableOpacity
        key={key}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        onPress={() => onChange({ deliveryMode: key })}
        style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: on ? colors.maroon : colors.border, backgroundColor: on ? colors.goldLight : '#fff', alignItems: 'center' }}
      >
        <Ionicons name={icon} size={24} color={colors.maroon} />
        <Text style={{ fontWeight: '700', marginTop: 4, textAlign: 'center', fontSize: 12 }}>{t(ta, en)}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>{t('பட்டாசு எப்படி பெறுவீர்கள்?', 'How will you receive crackers?')}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        {opt('parcel', 'cube-outline', 'பார்சல் (முகவரிக்கு)', 'Parcel to address')}
        {opt('pickup', 'storefront-outline', 'மதுரை கடையில் நேரில்', 'Pick up in Madurai')}
      </View>
      {draft.deliveryMode === 'pickup' ? (
        <View style={{ marginBottom: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>{t('எந்த கடை?', 'Which store?')}</Text>
          {stores.map((s) => {
            const on = draft.pickupStore === s.key;
            return (
              <TouchableOpacity key={s.key} onPress={() => onChange({ pickupStore: s.key })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.maroon : colors.border} />
                <Text style={{ marginLeft: 10, flex: 1 }}>{t(s.ta, s.en)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <>
          <Field label={t('முகவரி', 'Address')} value={draft.address} onChangeText={(address) => onChange({ address })} autoComplete="street-address" />
          <Field label={t('ஊர் / நகரம்', 'City / Town')} value={draft.city} onChangeText={(city) => onChange({ city })} />
          <Field label={t('பின்கோடு', 'Pincode')} value={draft.pincode} onChangeText={(v) => onChange({ pincode: v.replace(/\D/g, '').slice(0, 6) })} keyboardType="number-pad" />
        </>
      )}
    </View>
  );
}
