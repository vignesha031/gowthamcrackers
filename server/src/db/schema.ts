import { type AnyPgColumn, boolean, date, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const pk = () => uuid('id').primaryKey().defaultRandom();
const ts = (n: string) => timestamp(n, { withTimezone: true });
const created = () => ts('created_at').notNull().defaultNow();

// ───────────── enums ─────────────
export const adminRole = pgEnum('admin_role', ['super_admin', 'admin', 'staff']);
export const enrolmentStatus = pgEnum('enrolment_status', ['active', 'completed', 'stopped']);
/** pending = not paid yet · submitted = customer says paid, shop has not verified · paid = verified */
export const instalmentStatus = pgEnum('instalment_status', ['pending', 'submitted', 'paid']);
export const payMethod = pgEnum('pay_method', ['upi', 'bank', 'cash']);
export const payStatus = pgEnum('pay_status', ['submitted', 'confirmed', 'rejected']);
export const fulfilmentStatus = pgEnum('fulfilment_status', ['not_started', 'list_received', 'packing', 'dispatched', 'ready_for_pickup', 'delivered']);
export const deliveryMode = pgEnum('delivery_mode', ['parcel', 'pickup']);
export const notifKind = pgEnum('notif_kind', ['payments', 'dues', 'offers', 'delivery', 'general']);

// ───────────── staff ─────────────
export const admins = pgTable('admins', {
  id: pk(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 160 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: adminRole('role').notNull().default('staff'),
  permissions: text('permissions').array().notNull().default(sql`'{}'::text[]`), // e.g. {customers.view,payments.manage}; super_admin always has everything
  phone: varchar('phone', { length: 15 }),
  createdBy: uuid('created_by').references((): AnyPgColumn => admins.id),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  active: boolean('active').notNull().default(true),
  lastLoginAt: ts('last_login_at'),
  createdAt: created(),
}, (t) => [uniqueIndex('admins_email_uq').on(t.email)]);

// ───────────── customers ─────────────
export const users = pgTable('users', {
  id: pk(),
  customerNo: serial('customer_no').notNull(), // shown as C1001, C1002…
  mobile: varchar('mobile', { length: 15 }).notNull(),
  name: varchar('name', { length: 120 }),
  lang: varchar('lang', { length: 2 }).notNull().default('ta'),
  deliveryMode: deliveryMode('delivery_mode').notNull().default('parcel'),
  pickupStore: varchar('pickup_store', { length: 20 }).notNull().default('main'),
  address: varchar('address', { length: 250 }),
  city: varchar('city', { length: 80 }),
  pincode: varchar('pincode', { length: 6 }),
  referralCode: varchar('referral_code', { length: 12 }),
  referredBy: uuid('referred_by').references((): AnyPgColumn => users.id),
  blocked: boolean('blocked').notNull().default(false),
  deletedAt: ts('deleted_at'),
  lastLoginAt: ts('last_login_at'),
  createdAt: created(),
}, (t) => [
  uniqueIndex('users_mobile_uq').on(t.mobile),
  uniqueIndex('users_customer_no_uq').on(t.customerNo),
  uniqueIndex('users_referral_uq').on(t.referralCode),
  index('users_referred_by_idx').on(t.referredBy),
  index('users_created_idx').on(t.createdAt),
]);

export const otps = pgTable('otps', {
  id: pk(),
  mobile: varchar('mobile', { length: 15 }).notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: ts('expires_at').notNull(),
  consumedAt: ts('consumed_at'),
  createdAt: created(),
}, (t) => [index('otps_mobile_idx').on(t.mobile, t.createdAt)]);

// ───────────── the scheme (one per year) and its plans ─────────────
export const schemes = pgTable('schemes', {
  id: pk(),
  nameTa: text('name_ta').notNull(),
  nameEn: text('name_en').notNull(),
  periodTa: text('period_ta').notNull(),
  periodEn: text('period_en').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(), // first instalment month (1st of the month)
  instalments: integer('instalments').notNull().default(9),
  bonusInstalments: integer('bonus_instalments').notNull().default(1), // shop adds this many instalments on completion
  dueDay: integer('due_day').notNull().default(10), // pay on/before this day each month to keep bonus + gift
  chooseBy: date('choose_by', { mode: 'string' }).notNull(),
  parcelFrom: date('parcel_from', { mode: 'string' }).notNull(),
  pickupBy: date('pickup_by', { mode: 'string' }).notNull(),
  joinUntil: date('join_until', { mode: 'string' }), // null = anyone can join while the scheme is open
  terms: jsonb('terms').notNull().default(sql`'[]'::jsonb`), // [{ ta, en }]
  referralTarget: integer('referral_target').notNull().default(5),
  referralRewardTa: text('referral_reward_ta').notNull().default(''),
  referralRewardEn: text('referral_reward_en').notNull().default(''),
  open: boolean('open').notNull().default(true), // shown to customers; only one scheme is open at a time
  createdAt: created(),
}, (t) => [index('schemes_open_idx').on(t.open)]);

export const plans = pgTable('plans', {
  id: pk(),
  schemeId: uuid('scheme_id').notNull().references(() => schemes.id),
  n: integer('n').notNull(), // Plan 1, Plan 2 …
  monthly: integer('monthly').notNull(),
  giftTa: text('gift_ta').notNull().default(''),
  giftEn: text('gift_en').notNull().default(''),
  active: boolean('active').notNull().default(true),
}, (t) => [uniqueIndex('plans_scheme_n_uq').on(t.schemeId, t.n)]);

// ───────────── a customer's membership in a plan ─────────────
export const enrolments = pgTable('enrolments', {
  id: pk(),
  enrolNo: serial('enrol_no').notNull(), // shown as GC-0001
  userId: uuid('user_id').notNull().references(() => users.id),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  schemeId: uuid('scheme_id').notNull().references(() => schemes.id),
  // snapshot, so editing a plan next year never changes what an existing member was promised
  monthly: integer('monthly').notNull(),
  totalInstalments: integer('total_instalments').notNull(),
  bonusAmount: integer('bonus_amount').notNull(),
  status: enrolmentStatus('status').notNull().default('active'),
  bonusOverride: varchar('bonus_override', { length: 8 }), // null = automatic · 'grant' | 'forfeit' = the owner's decision
  fulfilmentStatus: fulfilmentStatus('fulfilment_status').notNull().default('not_started'),
  fulfilmentNote: text('fulfilment_note'), // cracker list summary, parcel notes…
  trackingRef: varchar('tracking_ref', { length: 80 }),
  createdAt: created(),
}, (t) => [
  uniqueIndex('enrol_no_uq').on(t.enrolNo),
  index('enrol_user_idx').on(t.userId),
  index('enrol_status_idx').on(t.status, t.fulfilmentStatus),
  index('enrol_plan_idx').on(t.planId),
]);

export const instalments = pgTable('instalments', {
  id: pk(),
  enrolmentId: uuid('enrolment_id').notNull().references(() => enrolments.id, { onDelete: 'cascade' }),
  no: integer('no').notNull(), // 1…9
  month: date('month', { mode: 'string' }).notNull(), // 1st of the month this instalment is for
  dueDate: date('due_date', { mode: 'string' }).notNull(), // the 10th — on-time cut-off
  amount: integer('amount').notNull(),
  status: instalmentStatus('status').notNull().default('pending'),
  paidOn: date('paid_on', { mode: 'string' }),
  onTime: boolean('on_time'),
}, (t) => [uniqueIndex('inst_enrol_no_uq').on(t.enrolmentId, t.no), index('inst_due_idx').on(t.status, t.dueDate)]);

// ───────────── money ─────────────
export const payments = pgTable('payments', {
  id: pk(),
  ref: varchar('ref', { length: 24 }).notNull(), // GC260112-7K3F
  userId: uuid('user_id').notNull().references(() => users.id),
  enrolmentId: uuid('enrolment_id').notNull().references(() => enrolments.id),
  instalmentId: uuid('instalment_id').notNull().references(() => instalments.id),
  amount: integer('amount').notNull(),
  method: payMethod('method').notNull(),
  utr: varchar('utr', { length: 40 }), // UPI / bank reference typed by the customer
  status: payStatus('status').notNull().default('submitted'),
  paidOn: date('paid_on', { mode: 'string' }).notNull(), // the date the money was sent (IST) — decides "on time"
  rejectReason: text('reject_reason'),
  reviewedBy: uuid('reviewed_by').references(() => admins.id),
  reviewedAt: ts('reviewed_at'),
  receivedBy: uuid('received_by').references(() => admins.id), // set for cash taken at the shop
  note: text('note'),
  idempotencyKey: varchar('idempotency_key', { length: 64 }),
  createdAt: created(),
}, (t) => [
  uniqueIndex('pay_ref_uq').on(t.ref),
  uniqueIndex('pay_idem_uq').on(t.userId, t.idempotencyKey),
  index('pay_status_idx').on(t.status, t.createdAt),
  index('pay_enrol_idx').on(t.enrolmentId),
  index('pay_inst_idx').on(t.instalmentId),
  index('pay_user_idx').on(t.userId, t.createdAt),
]);

// ───────────── communication ─────────────
export const notifications = pgTable('notifications', {
  id: pk(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: notifKind('kind').notNull(),
  titleTa: text('title_ta').notNull(),
  titleEn: text('title_en').notNull(),
  bodyTa: text('body_ta').notNull(),
  bodyEn: text('body_en').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: created(),
}, (t) => [index('notif_user_idx').on(t.userId, t.createdAt)]);

export const activityLogs = pgTable('activity_logs', {
  id: pk(),
  adminId: uuid('admin_id').references(() => admins.id),
  action: varchar('action', { length: 60 }).notNull(),
  entity: varchar('entity', { length: 40 }).notNull(),
  entityId: varchar('entity_id', { length: 64 }),
  meta: jsonb('meta'),
  ip: varchar('ip', { length: 45 }),
  createdAt: created(),
}, (t) => [index('activity_created_idx').on(t.createdAt), index('activity_admin_idx').on(t.adminId, t.createdAt)]);

/** Shop details shown in the app (phone, UPI id, bank, stores). Editable from the admin panel. */
export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 60 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => admins.id),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});
