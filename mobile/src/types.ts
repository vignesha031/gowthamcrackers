/** Shapes returned by the backend (server/src/controllers + services/chit.ts). Dates are 'YYYY-MM-DD' (IST). */

export interface Store { key: string; ta: string; en: string; addrTa: string; addrEn: string; map: string }

export interface Shop {
  nameTa: string; nameEn: string; subTa: string; since: number; legalName: string;
  phone: string; complaintsPhone: string; upiId: string;
  bank: { number: string; name: string; ifsc: string; type: string; bank: string; branch: string };
  stores: Store[];
}

export interface PlanInfo {
  id: string; n: number; monthly: number; giftTa: string; giftEn: string;
  /** one month's instalment, given free */
  bonus: number;
  /** what the customer pays in total */
  total: number;
  /** total + bonus = what they can order */
  crackerValue: number;
}

export interface Scheme {
  id: string; nameTa: string; nameEn: string; periodTa: string; periodEn: string;
  startDate: string; instalments: number; bonusInstalments: number; dueDay: number;
  chooseBy: string; parcelFrom: string; pickupBy: string; joinUntil: string | null; joinOpen: boolean;
  terms: { ta: string; en: string }[];
  referralTarget: number; referralRewardTa: string; referralRewardEn: string;
  plans: PlanInfo[];
}

export interface Banner { id: string; title: string; image: string; active: boolean }
export interface AppConfig { today: string; otpLength: number; shop: Shop; scheme: Scheme | null; banners: Banner[] }

export interface Referral { joined: number; target: number; rewardTa: string; rewardEn: string }

export interface Me {
  id: string; customerNo: number; mobile: string; name: string | null; lang: 'ta' | 'en';
  deliveryMode: 'parcel' | 'pickup'; pickupStore: string | null;
  address: string | null; city: string | null; pincode: string | null;
  referralCode: string | null; referredBy: boolean; referral: Referral; unreadNotifications: number;
}

export type InstalmentState = 'paid' | 'verifying' | 'overdue' | 'due' | 'upcoming';

export interface Instalment {
  id: string; no: number; month: string; dueDate: string; amount: number;
  status: 'pending' | 'submitted' | 'paid'; state: InstalmentState;
  paidOn: string | null; onTime: boolean | null; paymentRef: string | null; rejectedReason: string | null;
}

export interface Enrolment {
  id: string; enrolNo: number; status: 'active' | 'completed' | 'cancelled' | string; joinedAt: string;
  planN: number; monthly: number; totalInstalments: number; bonusAmount: number; giftTa: string; giftEn: string;
  schemeId: string; schemeNameTa: string; schemeNameEn: string;
  chooseBy: string; parcelFrom: string; pickupBy: string; dueDay: number;
  fulfilment: { status: string; note: string | null; trackingRef: string | null };
  paidCount: number; paidAmount: number; verifyingCount: number; verifyingAmount: number; overdueCount: number; lateCount: number; totalCount: number;
  bonusSafe: boolean; bonusEarned: boolean; crackerValue: number; crackerValueIfOnTrack: number;
  nextNo: number | null; instalments: Instalment[];
}

export interface PaymentResult { payment: { id: string; ref: string; amount: number; paidOn: string; status: string }; enrolment: Enrolment }

export interface PaymentRow {
  id: string; ref: string; amount: number; method: 'upi' | 'bank' | 'cash'; status: 'submitted' | 'confirmed' | 'rejected';
  paidOn: string; rejectReason: string | null; createdAt: string; planN: number; no: number; month: string; dueDate: string;
}

export interface Notice {
  id: string; kind: string; titleTa: string; titleEn: string; bodyTa: string; bodyEn: string; read: boolean; createdAt: string;
}

export interface Draft {
  name: string; deliveryMode: 'parcel' | 'pickup'; pickupStore: string; address: string; city: string; pincode: string;
}
