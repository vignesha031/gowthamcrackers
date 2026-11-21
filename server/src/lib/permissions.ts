import type { Auth } from './auth';

/** Every screen of the admin panel is a "section"; each has a `view` and a `manage` permission. manage implies view. */
export const SECTIONS = {
  dashboard: 'Dashboard',
  payments: 'Payments & verification',
  dues: 'Dues & reminders',
  customers: 'Customers',
  enrolments: 'Members & cracker delivery',
  notifications: 'Send notifications',
  reports: 'Reports & exports',
  scheme: 'Scheme, plans, banners & shop details',
  staff: 'Staff management',
  activity: 'Activity log',
} as const;
export const ALL_PERMISSIONS = Object.keys(SECTIONS).flatMap((s) => [`${s}.view`, `${s}.manage`]);

/** Ready-made starting points for the "add staff" screen — the owner can still tick/untick anything. */
export const PRESETS: Record<string, string[]> = {
  admin: ALL_PERMISSIONS.filter((p) => !p.startsWith('activity.') && !p.startsWith('scheme.manage')),
  cashier: ['dashboard.view', 'customers.view', 'dues.view', 'payments.manage'],
  caller: ['customers.view', 'dues.manage', 'notifications.view'],
  packer: ['customers.view', 'enrolments.manage', 'reports.view'],
};

export function can(a: Pick<Auth, 'role' | 'perms'> | undefined, perm: string) {
  if (!a) return false;
  if (a.role === 'super_admin') return true;
  const p = a.perms ?? [];
  return p.includes(perm) || (perm.endsWith('.view') && p.includes(perm.replace('.view', '.manage')));
}
/** All permissions a person effectively has (manage → also view). */
export const effective = (role: string, perms: string[]) => role === 'super_admin' ? ALL_PERMISSIONS : [...new Set(perms.flatMap((p) => p.endsWith('.manage') ? [p, p.replace('.manage', '.view')] : [p]))];
