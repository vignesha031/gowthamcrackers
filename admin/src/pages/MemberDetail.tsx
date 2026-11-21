import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { cap, customerNo, date, FULFIL, memberNo, money, monthName } from '../format';
import { Badge, ErrorBox, Field, Loading, PageHead, payTone, useAction, useFetch } from '../ui';
import CashModal from './CashModal';

type Inst = { id: string; no: number; month: string; dueDate: string; amount: number; status: string; state: string; paidOn: string | null; onTime: boolean | null; paymentRef: string | null; rejectedReason: string | null };
type D = {
  id: string; enrolNo: number; status: string; joinedAt: string; planN: number; monthly: number; totalInstalments: number; bonusAmount: number; giftEn: string; schemeNameEn: string;
  bonusOverride: 'grant' | 'forfeit' | null; bonusSafe: boolean; bonusEarned: boolean; crackerValue: number; crackerValueIfOnTrack: number; paidCount: number; paidAmount: number; overdueCount: number; lateCount: number;
  fulfilment: { status: string; note: string | null; trackingRef: string | null }; instalments: Inst[];
  customer: { id: string; customerNo: number; name: string; mobile: string; deliveryMode: string; pickupStore: string; address: string | null; city: string | null; pincode: string | null };
  payments: { id: string; ref: string; amount: number; method: string; status: string; paidOn: string }[];
};

export default function MemberDetail() {
  const { id } = useParams();
  const { can, refreshBadges } = useAuth();
  const manage = can('enrolments.manage'), cash = can('payments.manage');
  const { data: d, error, loading, reload } = useFetch<D>(`/admin/members/${id}`);
  const [status, setStatus] = useState(''), [note, setNote] = useState(''), [track, setTrack] = useState('');
  const [cashOpen, setCashOpen] = useState(false);
  const { busy, run } = useAction();
  useEffect(() => { if (d) { setStatus(d.fulfilment.status); setNote(d.fulfilment.note ?? ''); setTrack(d.fulfilment.trackingRef ?? ''); } }, [d]);
  if (loading && !d) return <Loading />;
  if (error || !d) return <ErrorBox message={error ?? 'Not found'} retry={reload} />;
  const patch = async (body: Record<string, unknown>, ok: string) => { const r = await run(() => api.patch(`/admin/members/${d.id}`, body), ok); if (r) { reload(); refreshBadges(); } };
  const c = d.customer;
  const changed = status !== d.fulfilment.status || note !== (d.fulfilment.note ?? '') || track !== (d.fulfilment.trackingRef ?? '');
  return (
    <>
      <Link className="back" to="/members">‹ All members</Link>
      <PageHead title={`${memberNo(d.enrolNo)} · Plan ${d.planN}`} sub={`${d.schemeNameEn} · joined ${date(d.joinedAt)}`}>
        <Badge tone={payTone(d.status)}>{d.status}</Badge>
        {cash && d.status === 'active' && <button className="btn gold" onClick={() => setCashOpen(true)}>＋ Record cash</button>}
        {manage && d.status !== 'completed' && <button className={`btn ${d.status === 'active' ? 'danger' : ''}`} disabled={busy} onClick={() => { if (confirm(d.status === 'active' ? 'Stop this plan? The customer will no longer be asked to pay.' : 'Resume this plan?')) patch({ status: d.status === 'active' ? 'stopped' : 'active' }, d.status === 'active' ? 'Plan stopped' : 'Plan resumed'); }}>{d.status === 'active' ? 'Stop plan' : 'Resume plan'}</button>}
      </PageHead>
      <div className="grid g2" style={{ marginBottom: 14 }}>
        <div className="card"><h2>Customer</h2>
          <dl className="kv" style={{ margin: 0 }}>
            <dt>Name</dt><dd><Link to={`/customers/${c.id}`}>{c.name}</Link> · {customerNo(c.customerNo)}</dd>
            <dt>Mobile</dt><dd><a href={`tel:${c.mobile}`}>{c.mobile}</a></dd>
            <dt>Delivery</dt><dd>{c.deliveryMode === 'pickup' ? `Store pick-up (${c.pickupStore})` : [c.address, c.city, c.pincode].filter(Boolean).join(', ') || 'Parcel — no address'}</dd>
            <dt>Monthly</dt><dd>{money(d.monthly)} × {d.totalInstalments}</dd>
            <dt>Paid</dt><dd>{d.paidCount}/{d.totalInstalments} · {money(d.paidAmount)}{d.overdueCount > 0 && <span className="tag-late"> · {d.overdueCount} overdue</span>}</dd>
            <dt>Free gift</dt><dd>{d.giftEn || '—'}</dd>
          </dl></div>
        <div className="card"><h2>Bonus</h2>
          <p style={{ marginTop: 0 }}>{d.bonusEarned ? <Badge tone="green">Bonus earned</Badge> : d.bonusSafe ? <Badge tone="blue">On track</Badge> : <Badge tone="red">Bonus lost (late payment)</Badge>} <span className="muted">Bonus {money(d.bonusAmount)} · cracker value now <b>{money(d.crackerValue)}</b>, if on track {money(d.crackerValueIfOnTrack)}</span></p>
          <p className="muted" style={{ margin: '0 0 10px' }}>Manual decision: {d.bonusOverride ? <b>{d.bonusOverride === 'grant' ? 'Always grant' : 'Forfeit'}</b> : 'none (automatic rule applies)'}. {d.lateCount > 0 && `${d.lateCount} late payment(s).`}</p>
          {manage && <div className="row">
            <button className="btn sm good" disabled={busy || d.bonusOverride === 'grant'} onClick={() => patch({ bonusOverride: 'grant' }, 'Bonus granted')}>Grant bonus</button>
            <button className="btn sm danger" disabled={busy || d.bonusOverride === 'forfeit'} onClick={() => patch({ bonusOverride: 'forfeit' }, 'Bonus forfeited')}>Forfeit bonus</button>
            {d.bonusOverride && <button className="btn sm" disabled={busy} onClick={() => patch({ bonusOverride: null }, 'Back to automatic')}>Use automatic rule</button>}
          </div>}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}><h2>Cracker delivery</h2>
        <div className="form-grid">
          <Field label="Stage"><select value={status} disabled={!manage} onChange={(e) => setStatus(e.target.value)}>{FULFIL.map((f) => <option key={f} value={f}>{cap(f)}</option>)}</select></Field>
          <Field label="Tracking / courier reference"><input value={track} disabled={!manage} maxLength={80} onChange={(e) => setTrack(e.target.value)} placeholder="e.g. courier name + number" /></Field>
          <div className="full"><Field label="Internal note" hint="Not shown to the customer."><textarea value={note} disabled={!manage} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></Field></div>
        </div>
        {manage && <div className="row" style={{ marginTop: 12 }}><button className="btn primary" disabled={busy || !changed} onClick={() => patch({ fulfilmentStatus: status, fulfilmentNote: note.trim() || null, trackingRef: track.trim() || null }, 'Delivery updated — customer notified if the stage changed')}>Save delivery</button><span className="muted">The customer gets an app message when the stage changes.</span></div>}
      </div>
      <div className="card flush" style={{ marginBottom: 14 }}><div style={{ padding: '18px 18px 0' }}><h2>Instalments</h2></div>
        <div className="table-wrap"><table><thead><tr><th>#</th><th>Month</th><th>Due</th><th className="right">Amount</th><th>Status</th><th>Paid on</th><th>Receipt</th></tr></thead>
          <tbody>{d.instalments.map((i) => <tr key={i.id}><td>{i.no}</td><td>{monthName(i.month)}</td><td>{date(i.dueDate)}</td><td className="right mono">{money(i.amount)}</td>
            <td><Badge tone={payTone(i.state)}>{cap(i.state)}</Badge>{i.onTime === false && <span className="sub tag-late">Late</span>}{i.rejectedReason && <span className="sub">Rejected: {i.rejectedReason}</span>}</td><td>{date(i.paidOn)}</td><td className="mono">{i.paymentRef ?? '—'}</td></tr>)}</tbody></table></div></div>
      {cashOpen && <CashModal member={{ id: d.id, label: `${c.name} · ${memberNo(d.enrolNo)} · Plan ${d.planN}`, instalments: d.instalments }} onClose={() => setCashOpen(false)} onDone={() => { reload(); refreshBadges(); }} />}
    </>
  );
}
