/**
 * End-to-end test of the whole backend against a real Postgres.
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/gowtham_test npm test
 * The database named in TEST_DATABASE_URL is WIPED on every run, so it must have "test" in its name.
 */
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;
if (!url || !/test/i.test(new URL(url).pathname)) throw new Error('Set TEST_DATABASE_URL to a database with "test" in its name (it will be wiped)');
process.env.DATABASE_URL = url;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.ADMIN_EMAIL = 'owner@test.in';
process.env.ADMIN_PASSWORD = 'OwnerPass123';
process.env.TEST_MOBILE = '9000000000';
process.env.TEST_OTP = '4321';

let base = '', server: Server, pool: import('pg').Pool;
type R = { status: number; body: any; text: string; headers: Headers };
async function call(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}): Promise<R> {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json: any; try { json = JSON.parse(text); } catch { json = null; }
  return { status: r.status, body: json, text, headers: r.headers };
}
const get = (p: string, t?: string) => call('GET', p, undefined, t);
const post = (p: string, b?: unknown, t?: string, h?: Record<string, string>) => call('POST', p, b ?? {}, t, h);
const patch = (p: string, b: unknown, t?: string) => call('PATCH', p, b, t);

async function login(mobile: string, name?: string) {
  const o = await post('/api/auth/otp', { mobile });
  assert.equal(o.status, 200, o.text);
  const code = o.body.devOtp ?? process.env.TEST_OTP;
  const v = await post('/api/auth/verify', { mobile, code });
  assert.equal(v.status, 200, v.text);
  if (name) assert.equal((await patch('/api/me', { name }, v.body.token)).status, 200);
  return v.body.token as string;
}

describe('Gowtham Crackers API', () => {
  let admin = '', planId = '', planIds: Record<number, string> = {};
  before(async () => {
    const { pool: p } = await import('../src/db');
    pool = p;
    await pool.query('drop schema public cascade; drop schema if exists drizzle cascade; create schema public');
    const { runMigrations } = await import('../src/db/migrate');
    const { seed } = await import('../src/db/seed');
    await runMigrations(); await seed();
    const { createApp } = await import('../src/app');
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  after(async () => { server?.close(); await pool?.end(); });

  it('serves the open scheme and shop details without login', async () => {
    const r = await get('/api/config');
    assert.equal(r.status, 200);
    assert.equal(r.body.scheme.plans.length, 6);
    assert.deepEqual(r.body.scheme.plans.map((p: any) => p.monthly), [300, 500, 700, 1000, 1500, 2000]);
    const p4 = r.body.scheme.plans[3];
    assert.equal(p4.crackerValue, 10_000); assert.equal(p4.total, 9_000); assert.equal(p4.bonus, 1_000);
    assert.equal(r.body.scheme.terms.length, 10);
    assert.equal(r.body.shop.upiId, '335289536383490@cnrb');
    for (const p of r.body.scheme.plans) planIds[p.n] = p.id;
    planId = planIds[4];
  });

  describe('customer OTP login', () => {
    it('rejects a bad mobile number and a wrong OTP, accepts the right one', async () => {
      assert.equal((await post('/api/auth/otp', { mobile: '12345' })).status, 400);
      const o = await post('/api/auth/otp', { mobile: '9876500001' });
      assert.equal(o.body.length, 4); assert.match(o.body.devOtp, /^\d{4}$/);
      const wrong = o.body.devOtp === '1111' ? '2222' : '1111';
      assert.equal((await post('/api/auth/verify', { mobile: '9876500001', code: wrong })).status, 400);
      const ok = await post('/api/auth/verify', { mobile: '9876500001', code: o.body.devOtp });
      assert.equal(ok.status, 200); assert.equal(ok.body.isNew, true);
      assert.equal((await post('/api/auth/verify', { mobile: '9876500001', code: o.body.devOtp })).status, 400, 'an OTP works only once');
    });
    it('rate-limits repeated OTP requests', async () => {
      assert.equal((await post('/api/auth/otp', { mobile: '9876500002' })).status, 200);
      assert.equal((await post('/api/auth/otp', { mobile: '9876500002' })).status, 429);
    });
    it('needs a token for customer routes and lets the reviewer test number in', async () => {
      assert.equal((await get('/api/me')).status, 401);
      const t = await login('9000000000');
      assert.equal((await get('/api/me', t)).body.mobile, '9000000000');
    });
  });

  describe('joining and paying (customer + shop verification)', () => {
    let cust = '', enrolId = '';
    it('creates a profile with a referral code and saves delivery details', async () => {
      cust = await login('9876543210', 'Vignesh');
      const me = (await get('/api/me', cust)).body;
      assert.equal(me.name, 'Vignesh'); assert.match(me.referralCode, /^GC\d{4}$/);
      assert.equal((await patch('/api/me', { pincode: '12' }, cust)).status, 400);
      const r = await patch('/api/me', { deliveryMode: 'parcel', address: '12 Test Street', city: 'Madurai', pincode: '625019' }, cust);
      assert.equal(r.body.city, 'Madurai');
    });
    it('joins Plan 4 and gets 9 instalments Dec 2026 – Aug 2027, due on the 10th', async () => {
      const j = await post('/api/enrolments', { planId }, cust);
      assert.equal(j.status, 201, j.text);
      enrolId = j.body.id;
      const e = j.body;
      assert.equal(e.monthly, 1000); assert.equal(e.instalments.length, 9); assert.equal(e.bonusAmount, 1000);
      assert.equal(e.instalments[0].month, '2026-12-01'); assert.equal(e.instalments[0].dueDate, '2026-12-10');
      assert.equal(e.instalments[8].month, '2027-08-01'); assert.equal(e.instalments[8].dueDate, '2027-08-10');
      assert.equal(e.crackerValueIfOnTrack, 10_000); assert.equal(e.nextNo, 1);
      assert.equal(e.instalments[0].state, 'upcoming', 'today is before Dec 2026');
      assert.equal((await post('/api/enrolments', { planId }, cust)).body.id, enrolId, 'double-tap returns the same plan');
    });
    it('"I have paid" waits for the shop, one instalment at a time, max two unverified', async () => {
      const key = { 'idempotency-key': 'tap-0001-aaaa' };
      const a = await post(`/api/enrolments/${enrolId}/payments`, { method: 'upi', utr: '1234567890' }, cust, key);
      assert.equal(a.status, 201, a.text);
      assert.equal(a.body.payment.amount, 1000); assert.match(a.body.payment.ref, /^GC\d{6}-[A-Z0-9]{4}$/);
      assert.equal(a.body.enrolment.instalments[0].state, 'verifying'); assert.equal(a.body.enrolment.nextNo, 2);
      const again = await post(`/api/enrolments/${enrolId}/payments`, { method: 'upi' }, cust, key);
      assert.equal(again.status, 200); assert.equal(again.body.payment.id, a.body.payment.id, 'retry with the same key does not double-pay');
      assert.equal((await post(`/api/enrolments/${enrolId}/payments`, { method: 'bank' }, cust)).status, 201);
      const third = await post(`/api/enrolments/${enrolId}/payments`, { method: 'upi' }, cust);
      assert.equal(third.status, 409); assert.equal(third.body.code, 'AWAITING_VERIFICATION');
      assert.equal((await post(`/api/enrolments/${enrolId}/payments`, { method: 'cash' }, cust)).status, 400, 'customers cannot self-report cash');
    });
    it("won't let someone else touch my plan", async () => {
      const other = await login('9876543211', 'Other');
      assert.equal((await get(`/api/enrolments/${enrolId}`, other)).status, 404);
      assert.equal((await post(`/api/enrolments/${enrolId}/payments`, { method: 'upi' }, other)).status, 404);
      assert.equal((await get('/api/enrolments', other)).body.items.length, 0);
    });

    it('admin logs in and sees the verification queue', async () => {
      assert.equal((await post('/api/admin/auth/login', { email: 'owner@test.in', password: 'wrong' })).status, 401);
      const l = await post('/api/admin/auth/login', { email: 'owner@test.in', password: 'OwnerPass123' });
      assert.equal(l.status, 200); admin = l.body.token;
      assert.equal((await get('/api/admin/dashboard', cust)).status, 403, 'a customer token is not an admin token');
      const q = await get('/api/admin/payments?status=submitted', admin);
      assert.equal(q.body.items.length, 2); assert.equal(q.body.items[0].name, 'Vignesh'); assert.equal(q.body.items[0].no, 1);
      assert.equal((await get('/api/admin/badges', admin)).body.waiting, 2);
    });
    it('confirming marks the instalment paid, on time, and notifies the customer', async () => {
      const q = (await get('/api/admin/payments?status=submitted', admin)).body.items;
      const c = await post(`/api/admin/payments/${q[0].id}/confirm`, {}, admin);
      assert.equal(c.status, 200, c.text); assert.equal(c.body.onTime, true);
      assert.equal((await post(`/api/admin/payments/${q[0].id}/confirm`, {}, admin)).status, 409, 'cannot confirm twice');
      const e = (await get(`/api/enrolments/${enrolId}`, cust)).body;
      assert.equal(e.paidCount, 1); assert.equal(e.paidAmount, 1000); assert.equal(e.instalments[0].state, 'paid'); assert.equal(e.bonusSafe, true);
      const n = (await get('/api/me/notifications', cust)).body.items;
      assert.ok(n.some((x: any) => x.kind === 'payments' && /confirmed/.test(x.titleEn)));
      assert.equal((await get('/api/me', cust)).body.unreadNotifications >= 2, true);
    });
    it('a payment confirmed with a date after the 10th puts the bonus at risk', async () => {
      const q = (await get('/api/admin/payments?status=submitted', admin)).body.items;
      assert.equal(q[0].no, 2);
      const c = await post(`/api/admin/payments/${q[0].id}/confirm`, { paidOn: '2027-02-01' }, admin); // Jan instalment, due 10 Jan
      assert.equal(c.body.onTime, false);
      const e = (await get(`/api/enrolments/${enrolId}`, cust)).body;
      assert.equal(e.bonusSafe, false); assert.equal(e.lateCount, 1);
      assert.equal(e.instalments[1].onTime, false);
    });
    it('rejecting sends the instalment back to "pay" with the reason', async () => {
      const p = await post(`/api/enrolments/${enrolId}/payments`, { method: 'upi', utr: 'bad' }, cust);
      assert.equal(p.status, 201); assert.equal(p.body.enrolment.instalments[2].state, 'verifying');
      const id = (await get('/api/admin/payments?status=submitted', admin)).body.items[0].id;
      assert.equal((await post(`/api/admin/payments/${id}/reject`, {}, admin)).status, 400, 'a reason is required');
      assert.equal((await post(`/api/admin/payments/${id}/reject`, { reason: 'Amount not received' }, admin)).status, 200);
      const e = (await get(`/api/enrolments/${enrolId}`, cust)).body;
      assert.equal(e.instalments[2].status, 'pending'); assert.equal(e.instalments[2].rejectedReason, 'Amount not received'); assert.equal(e.nextNo, 3);
    });
    it('shop records cash at the counter (verified immediately) and cannot double-pay', async () => {
      const c = await post('/api/admin/payments/cash', { enrolmentId: enrolId, note: 'Receipt book 12' }, admin);
      assert.equal(c.status, 201, c.text); assert.equal(c.body.amount, 1000);
      assert.equal((await get(`/api/enrolments/${enrolId}`, cust)).body.paidCount, 3);
      assert.equal((await post('/api/admin/payments/cash', { enrolmentId: enrolId, instalmentNo: 1 }, admin)).status, 409);
    });
    it('a member who pays everything on time completes and earns the bonus', async () => {
      const t = await login('9876500100', 'Happy Member');
      const e0 = (await post('/api/enrolments', { planId: planIds[1] }, t)).body;
      for (let i = 0; i < 9; i++) assert.equal((await post('/api/admin/payments/cash', { enrolmentId: e0.id }, admin)).status, 201);
      const e = (await get(`/api/enrolments/${e0.id}`, t)).body;
      assert.equal(e.status, 'completed'); assert.equal(e.paidAmount, 2700); assert.equal(e.bonusEarned, true); assert.equal(e.crackerValue, 3000);
      assert.equal((await post('/api/admin/payments/cash', { enrolmentId: e0.id }, admin)).status, 404, 'nothing left to pay');
      assert.ok((await get('/api/me/notifications', t)).body.items.some((n: any) => /All instalments complete/.test(n.titleEn)));
      // cracker delivery moves forward and tells the customer
      assert.equal((await patch(`/api/admin/members/${e0.id}`, { fulfilmentStatus: 'dispatched', trackingRef: 'DTDC123' }, admin)).status, 200);
      assert.ok((await get('/api/me/notifications', t)).body.items.some((n: any) => /dispatched/.test(n.bodyEn) && /DTDC123/.test(n.bodyEn)));
      assert.equal((await get(`/api/enrolments/${e0.id}`, t)).body.fulfilment.status, 'dispatched');
    });
    it('owner can grant or forfeit the bonus by hand', async () => {
      assert.equal((await patch(`/api/admin/members/${enrolId}`, { bonusOverride: 'grant' }, admin)).status, 200);
      assert.equal((await get(`/api/enrolments/${enrolId}`, cust)).body.bonusSafe, true);
      assert.equal((await patch(`/api/admin/members/${enrolId}`, { bonusOverride: null }, admin)).status, 200);
      assert.equal((await get(`/api/enrolments/${enrolId}`, cust)).body.bonusSafe, false);
    });
    it('a stopped plan cannot take more payments', async () => {
      assert.equal((await patch(`/api/admin/members/${enrolId}`, { status: 'stopped' }, admin)).status, 200);
      assert.equal((await post(`/api/enrolments/${enrolId}/payments`, { method: 'upi' }, cust)).status, 409);
      assert.equal((await post('/api/admin/payments/cash', { enrolmentId: enrolId }, admin)).status, 409);
      assert.equal((await patch(`/api/admin/members/${enrolId}`, { status: 'active' }, admin)).status, 200);
    });
  });

  describe('referrals', () => {
    it('counts friends who joined a plan using my code', async () => {
      const a = await login('9876500200', 'Referrer');
      const code = (await get('/api/me', a)).body.referralCode;
      for (let i = 0; i < 5; i++) {
        const f = await login(`98765003${String(i).padStart(2, '0')}`, `Friend ${i}`);
        assert.equal((await patch('/api/me', { referralCode: code }, f)).status, 200);
        if (i < 4) await post('/api/enrolments', { planId: planIds[2] }, f); // the 5th has not joined a plan yet
      }
      assert.equal((await patch('/api/me', { referralCode: code }, a)).status, 400, 'own code');
      assert.equal((await patch('/api/me', { referralCode: 'GC9999' }, a)).status, 400, 'unknown code');
      const me = (await get('/api/me', a)).body;
      assert.equal(me.referral.joined, 4); assert.equal(me.referral.target, 5);
      assert.equal(me.referral.items.length, 5);
      assert.equal(me.referral.items.filter((item: any) => item.joined).length, 4);
      assert.ok(me.referral.items.some((item: any) => item.name === 'Friend 4' && !item.joined));
      const adminRows = await get('/api/admin/referrals?q=Referrer', admin);
      assert.equal(adminRows.status, 200);
      assert.equal(adminRows.body.pagination.total, 5);
      assert.equal(adminRows.body.items.filter((item: any) => item.joined).length, 4);
      assert.ok(adminRows.body.items.every((item: any) => item.referrerName === 'Referrer'));
    });
  });

  describe('admin panel', () => {
    it('dashboard, dues, members, customers and reports respond with real numbers', async () => {
      const d = (await get('/api/admin/dashboard', admin)).body;
      assert.ok(d.customers >= 10); assert.equal(d.byPlan.length, 6); assert.ok(d.collected.total >= 5_700);
      assert.equal(d.waitingVerification.count, 0); assert.ok(d.completed >= 1);
      const m = (await get('/api/admin/members?plan=1&status=completed', admin)).body;
      assert.equal(m.items.length, 1); assert.equal(m.items[0].crackerValue, 3000); assert.equal(m.pagination.total, 1);
      const cs = await get('/api/admin/customers?q=Vignesh', admin);
      assert.equal(cs.body.items[0].plans, 1); assert.equal(cs.body.items[0].paid, 3000);
      const detail = (await get(`/api/admin/customers/${cs.body.items[0].id}`, admin)).body;
      assert.equal(detail.members.length, 1); assert.equal(detail.payments.length >= 3, true);
      assert.equal((await get('/api/admin/dues?tab=upcoming', admin)).status, 200);
      const rem = await post('/api/admin/dues/remind', { allOverdue: true }, admin);
      assert.equal(rem.status, 200);
    });
    it('exports CSV files (payments and the packing list)', async () => {
      const p = await get('/api/admin/reports/payments.csv?from=2020-01-01&to=2030-01-01', admin);
      assert.match(p.headers.get('content-type')!, /text\/csv/); assert.ok(p.text.split('\n').length > 10); assert.match(p.text, /Receipt/);
      const m = await get('/api/admin/reports/members.csv', admin);
      assert.match(m.text, /Cracker value/); assert.match(m.text, /Vignesh/);
      const c = (await get('/api/admin/reports/collections?from=2020-01-01&to=2030-01-01', admin)).body;
      assert.ok(c.total >= 5_700); assert.ok(c.byMethod.some((x: any) => x.method === 'cash'));
    });
    it('broadcast reaches the chosen audience', async () => {
      const n = (await post('/api/admin/notifications/audience', { audience: 'plan', planN: 2 }, admin)).body.count;
      assert.equal(n, 4, '4 friends are on Plan 2');
      const b = await post('/api/admin/notifications/broadcast', { audience: 'plan', planN: 2, titleTa: 'சலுகை', titleEn: 'Offer', bodyTa: 'வணக்கம்', bodyEn: 'Hello Plan 2 members' }, admin);
      assert.equal(b.body.sent, 4);
      assert.equal((await post('/api/admin/notifications/broadcast', { audience: 'plan', titleTa: 'a', titleEn: 'b', bodyTa: 'c', bodyEn: 'd' }, admin)).status, 400);
    });
    it('owner can set up next year\'s scheme by copying this one; only one scheme is open', async () => {
      const cur = (await get('/api/admin/schemes', admin)).body.items[0];
      assert.equal((await patch(`/api/admin/schemes/${cur.id}`, { startDate: '2027-01-01' }, admin)).status, 409, 'locked once members joined');
      assert.equal((await patch(`/api/admin/schemes/${cur.id}`, { terms: [...cur.terms, { ta: 'புதிய நிபந்தனை', en: 'New term' }] }, admin)).status, 200);
      const n = await post('/api/admin/schemes', { copyFrom: cur.id, nameTa: 'தீபாவளி 2028', nameEn: 'Deepavali 2028', startDate: '2027-12-01', chooseBy: '2028-08-30', parcelFrom: '2028-09-20', pickupBy: '2028-09-25' }, admin);
      assert.equal(n.status, 201, n.text); assert.equal(n.body.plans.length, 6); assert.equal(n.body.open, true);
      const cfg = (await get('/api/config')).body;
      assert.equal(cfg.scheme.nameEn, 'Deepavali 2028');
      assert.equal((await get('/api/admin/schemes', admin)).body.items.filter((s: any) => s.open).length, 1);
      // existing members are untouched, and the old scheme's plans are no longer joinable
      const t = await login('9876500400', 'Late');
      assert.equal((await post('/api/enrolments', { planId }, t)).status, 404);
      const p1 = cfg.scheme.plans[0];
      assert.equal((await patch(`/api/admin/plans/${p1.id}`, { monthly: 400 }, admin)).status, 200);
      assert.equal((await get('/api/config')).body.scheme.plans[0].monthly, 400);
      // reopen the 2027 scheme so later tests are unaffected
      assert.equal((await patch(`/api/admin/schemes/${cur.id}`, { open: true }, admin)).status, 200);
    });
    it('shop details can be edited and reach the app', async () => {
      const s = (await get('/api/admin/settings/shop', admin)).body;
      assert.equal((await call('PUT', '/api/admin/settings/shop', { ...s, phone: '123' }, admin)).status, 400);
      assert.equal((await call('PUT', '/api/admin/settings/shop', { ...s, upiId: 'new@upi' }, admin)).status, 200);
      assert.equal((await get('/api/config')).body.shop.upiId, 'new@upi');
    });
  });

  describe('staff and permissions', () => {
    let cashier = '', staffId = '';
    it('owner adds a cashier who can only record payments', async () => {
      const grantable = (await get('/api/admin/permissions', admin)).body;
      assert.ok(grantable.presets.cashier.includes('payments.manage'));
      const c = await post('/api/admin/staff', { name: 'Cashier', email: 'cash@test.in', password: 'Temp12345', role: 'staff', permissions: grantable.presets.cashier }, admin);
      assert.equal(c.status, 201, c.text); staffId = c.body.id;
      const l = await post('/api/admin/auth/login', { email: 'cash@test.in', password: 'Temp12345' });
      cashier = l.body.token;
      assert.equal((await get('/api/admin/payments', cashier)).status, 403, 'must change the temporary password first');
      assert.equal((await post('/api/admin/auth/change-password', { currentPassword: 'Temp12345', newPassword: 'Better12345' }, cashier)).status, 200);
    });
    it('the cashier can work in their sections only', async () => {
      assert.equal((await get('/api/admin/payments?status=submitted', cashier)).status, 200);
      assert.equal((await get('/api/admin/customers', cashier)).status, 200);
      assert.equal((await get('/api/admin/staff', cashier)).status, 403);
      assert.equal((await post('/api/admin/notifications/broadcast', { audience: 'all', titleTa: 'a', titleEn: 'b', bodyTa: 'c', bodyEn: 'd' }, cashier)).status, 403);
      assert.equal((await call('PUT', '/api/admin/settings/shop', {}, cashier)).status, 403);
      assert.equal((await get('/api/admin/activity', cashier)).status, 403);
    });
    it('switching a staff member off blocks them straight away', async () => {
      assert.equal((await patch(`/api/admin/staff/${staffId}`, { active: false }, admin)).status, 200);
      assert.equal((await get('/api/admin/customers', cashier)).status, 403);
      assert.equal((await post('/api/admin/auth/login', { email: 'cash@test.in', password: 'Better12345' })).status, 401);
    });
    it('the activity log records what staff did', async () => {
      const a = (await get('/api/admin/activity?limit=100', admin)).body.items;
      assert.ok(a.some((x: any) => x.action === 'payment.confirm') && a.some((x: any) => x.action === 'payment.cash') && a.some((x: any) => x.action === 'staff.create'));
    });
  });

  describe('account safety', () => {
    it('a blocked customer is locked out; deleting an account keeps the money records', async () => {
      const t = await login('9876500500', 'Blocked Person');
      const id = (await get('/api/me', t)).body.id;
      assert.equal((await patch(`/api/admin/customers/${id}`, { blocked: true }, admin)).status, 200);
      assert.equal((await get('/api/me', t)).status, 403);
      const tid = (await get('/api/me', await login('9000000000'))).body.id;
      assert.equal((await patch(`/api/admin/customers/${tid}`, { blocked: true }, admin)).status, 200);
      assert.equal((await post('/api/auth/verify', { mobile: '9000000000', code: '4321' })).status, 403, 'blocked customers cannot log in again');
      const g = await login('9876500600', 'Goner');
      const e = (await post('/api/enrolments', { planId }, g)).body;
      await post('/api/admin/payments/cash', { enrolmentId: e.id }, admin);
      assert.equal((await call('DELETE', '/api/me', undefined, g)).status, 200);
      assert.equal((await get('/api/me', g)).status, 403);
      const pay = (await get('/api/admin/payments?status=confirmed&q=del', admin)).body;
      assert.ok(pay.items.length >= 1, 'the shop still has the receipt');
      assert.notEqual(pay.items[0].name, 'Goner');
      // the same number can sign up again as a brand-new customer
      await pool.query("delete from otps where mobile = '9876500600'"); // skip the 30 s resend wait
      const again = await login('9876500600');
      assert.equal((await get('/api/enrolments', again)).body.items.length, 0);
    });
    it('returns clean errors for bad ids and unknown routes', async () => {
      assert.equal((await get('/api/admin/members/not-a-uuid', admin)).status, 400);
      assert.equal((await get('/api/nope')).status, 404);
      const bad = await call('POST', '/api/auth/otp', undefined, undefined, {});
      assert.equal(bad.status, 400);
    });
  });
});
