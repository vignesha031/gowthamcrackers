import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin, requirePerm as P, requireUser } from './lib/auth';
import { HttpError } from './lib/http';
import * as auth from './controllers/auth.controller';
import * as cfg from './controllers/config.controller';
import * as me from './controllers/me.controller';
import * as enrol from './controllers/enrolment.controller';
import * as overview from './controllers/admin/overview.controller';
import * as customers from './controllers/admin/customer.controller';
import * as members from './controllers/admin/member.controller';
import * as pay from './controllers/admin/payment.controller';
import * as dues from './controllers/admin/dues.controller';
import * as scheme from './controllers/admin/scheme.controller';
import * as notify from './controllers/admin/notify.controller';
import * as staff from './controllers/admin/staff.controller';

const r = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
r.param('id', (_req, _res, next, v) => (UUID.test(v) ? next() : next(new HttpError(400, 'Invalid id'))));
const strict = rateLimit({ windowMs: 10 * 60_000, limit: process.env.NODE_ENV === 'test' ? 100_000 : 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please try again in a few minutes.' } });

// ───────── public ─────────
r.get('/config', cfg.config);
r.post('/auth/otp', strict, auth.sendOtp);
r.post('/auth/verify', strict, auth.verifyOtp);

// ───────── customer app ─────────
r.get('/me', requireUser, me.me);
r.patch('/me', requireUser, me.updateProfile);
r.delete('/me', requireUser, me.deleteAccount);
r.get('/me/notifications', requireUser, me.listNotifications);
r.post('/me/notifications/read-all', requireUser, me.markAllRead);
r.post('/me/notifications/:id/read', requireUser, me.markRead);
r.get('/enrolments', requireUser, enrol.myEnrolments);
r.post('/enrolments', requireUser, enrol.join);
r.get('/enrolments/:id', requireUser, enrol.enrolmentDetail);
r.post('/enrolments/:id/payments', requireUser, enrol.pay);
r.get('/payments', requireUser, enrol.history);

// ───────── admin panel — every route names the permission it needs; super admin passes all ─────────
r.post('/admin/auth/login', strict, auth.adminLogin);
r.post('/admin/auth/change-password', requireAdmin, staff.changePassword);
r.get('/admin/me', requireAdmin, staff.me);
r.get('/admin/permissions', requireAdmin, staff.catalog);
r.get('/admin/badges', requireAdmin, overview.badges);

r.get('/admin/dashboard', P('dashboard.view'), overview.dashboard);

r.get('/admin/payments', P('payments.view'), pay.listPayments);
r.post('/admin/payments/cash', P('payments.manage'), pay.cash);
r.post('/admin/payments/:id/confirm', P('payments.manage'), pay.confirm);
r.post('/admin/payments/:id/reject', P('payments.manage'), pay.reject);

r.get('/admin/dues', P('dues.view'), dues.dues);
r.post('/admin/dues/remind', P('dues.manage'), dues.remind);

r.get('/admin/customers', P('customers.view'), customers.listCustomers);
r.get('/admin/customers/:id', P('customers.view'), customers.customerDetail);
r.patch('/admin/customers/:id', P('customers.manage'), customers.updateCustomer);

r.get('/admin/members', P('enrolments.view'), members.listMembers);
r.get('/admin/members/:id', P('enrolments.view'), members.memberDetail);
r.patch('/admin/members/:id', P('enrolments.manage'), members.updateMember);

r.get('/admin/schemes', P('scheme.view'), scheme.listSchemes);
r.post('/admin/schemes', P('scheme.manage'), scheme.createScheme);
r.patch('/admin/schemes/:id', P('scheme.manage'), scheme.updateScheme);
r.post('/admin/schemes/:id/plans', P('scheme.manage'), scheme.addPlan);
r.patch('/admin/plans/:id', P('scheme.manage'), scheme.updatePlan);
r.get('/admin/settings/shop', P('scheme.view'), scheme.getShopSettings);
r.put('/admin/settings/shop', P('scheme.manage'), scheme.putShopSettings);
r.get('/admin/banners', P('scheme.view'), scheme.getBannersAdmin);
r.put('/admin/banners', P('scheme.manage'), scheme.putBannersAdmin);

r.post('/admin/notifications/audience', P('notifications.view'), notify.audienceCount);
r.post('/admin/notifications/broadcast', P('notifications.manage'), notify.broadcast);

r.get('/admin/reports/collections', P('reports.view'), overview.collections);
r.get('/admin/reports/payments.csv', P('reports.view'), overview.exportPayments);
r.get('/admin/reports/members.csv', P('reports.view'), overview.exportMembers);
r.get('/admin/activity', P('activity.view'), overview.activity);

r.get('/admin/staff', P('staff.view'), staff.listStaff);
r.post('/admin/staff', P('staff.manage'), staff.createStaff);
r.patch('/admin/staff/:id', P('staff.manage'), staff.updateStaff);
r.post('/admin/staff/:id/reset-password', P('staff.manage'), staff.resetPassword);
r.get('/admin/staff/:id/activity', P('staff.view'), staff.staffActivity);

export default r;
