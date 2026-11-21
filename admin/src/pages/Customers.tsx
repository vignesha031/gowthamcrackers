import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Page } from '../api';
import { useAuth } from '../auth';
import { customerNo, date, dateTime, memberNo, money } from '../format';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead, Pager, payTone, useAction, useDebounced, useFetch } from '../ui';
import CashModal from './CashModal';

type Row = { id: string; customerNo: number; name: string; mobile: string; city: string | null; blocked: boolean; joinedAt: string; lastLoginAt: string | null; plans: number; paid: number };
type Detail = {
  id: string; customerNo: number; name: string; mobile: string; lang: string; deliveryMode: 'parcel' | 'pickup'; pickupStore: string; address: string | null; city: string | null; pincode: string | null;
  referralCode: string | null; blocked: boolean; joinedAt: string; lastLoginAt: string | null; referredBy: { id: string; customerNo: number; name: string } | null;
  referrals: { joined: number; items: { id: string; customerNo: number; name: string; mobile: string; joined: boolean }[] };
  members: { id: string; enrolNo: number; planN: number; status: string; monthly: number; paidCount: number; totalCount: number; paidAmount: number; overdueCount: number; instalments: { no: number; month: string; status: string; amount: number }[] }[];
  payments: { id: string; ref: string; amount: number; method: string; status: string; paidOn: string; createdAt: string; planN: number; no: number }[];
};

function Drawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const manage = can('customers.manage'), cash = can('payments.manage');
  const { data: d, error, loading, reload } = useFetch<Detail>(`/admin/customers/${id}`);
  const [edit, setEdit] = useState(false), [f, setF] = useState({ name: '', deliveryMode: 'parcel', address: '', city: '', pincode: '' });
  const [cashFor, setCashFor] = useState<Detail['members'][number] | null>(null);
  const { busy, run } = useAction();
  useEffect(() => { if (d) setF({ name: d.name, deliveryMode: d.deliveryMode, address: d.address ?? '', city: d.city ?? '', pincode: d.pincode ?? '' }); }, [d]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  const save = async () => { const r = await run(() => api.patch(`/admin/customers/${id}`, f), 'Customer updated'); if (r) { setEdit(false); reload(); onChanged(); } };
  const block = async () => {
    if (!d) return;
    if (!confirm(d.blocked ? `Unblock ${d.name}?` : `Block ${d.name}? They will not be able to use the app.`)) return;
    const r = await run(() => api.patch(`/admin/customers/${id}`, { blocked: !d.blocked }), d.blocked ? 'Unblocked' : 'Blocked');
    if (r) { reload(); onChanged(); }
  };
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Customer details">
        <div className="row"><h2 className="grow">{d ? d.name : 'Customer'}</h2><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        {loading && !d ? <Loading /> : error || !d ? <ErrorBox message={error ?? 'Not found'} retry={reload} /> : (
          <>
            <div className="card">
              <div className="row" style={{ marginBottom: 10 }}><Badge tone="maroon">{customerNo(d.customerNo)}</Badge>{d.blocked && <Badge tone="red">Blocked</Badge>}<span className="grow" />
                {manage && !edit && <><button className="btn sm" onClick={() => setEdit(true)}>Edit</button><button className={`btn sm ${d.blocked ? '' : 'danger'}`} disabled={busy} onClick={block}>{d.blocked ? 'Unblock' : 'Block'}</button></>}</div>
              {!edit ? (
                <dl className="kv" style={{ margin: 0 }}>
                  <dt>Mobile</dt><dd><a href={`tel:${d.mobile}`}>{d.mobile}</a></dd>
                  <dt>Language</dt><dd>{d.lang === 'ta' ? 'Tamil' : 'English'}</dd>
                  <dt>Delivery</dt><dd>{d.deliveryMode === 'pickup' ? `Store pick-up (${d.pickupStore})` : 'Parcel'}</dd>
                  <dt>Address</dt><dd>{[d.address, d.city, d.pincode].filter(Boolean).join(', ') || '—'}</dd>
                  <dt>Joined</dt><dd>{date(d.joinedAt)} · last login {dateTime(d.lastLoginAt)}</dd>
                  <dt>Referral code</dt><dd>{d.referralCode ?? '—'}{d.referredBy && <> · referred by <b>{d.referredBy.name}</b></>}</dd>
                </dl>
              ) : (
                <div className="form-grid">
                  <div className="full"><Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
                  <Field label="Delivery"><select value={f.deliveryMode} onChange={(e) => setF({ ...f, deliveryMode: e.target.value })}><option value="parcel">Parcel</option><option value="pickup">Store pick-up</option></select></Field>
                  <Field label="Pincode"><input value={f.pincode} maxLength={6} inputMode="numeric" onChange={(e) => setF({ ...f, pincode: e.target.value })} /></Field>
                  <div className="full"><Field label="Address"><textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field></div>
                  <Field label="City"><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
                  <div className="full row"><button className="btn primary" disabled={busy} onClick={save}>Save</button><button className="btn" onClick={() => setEdit(false)}>Cancel</button></div>
                </div>
              )}
            </div>
            <div className="card"><h2>Plans ({d.members.length})</h2>
              {!d.members.length ? <div className="muted">Has not joined any plan yet.</div> : d.members.map((m) => (
                <div key={m.id} className="row" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                  <div className="grow"><Link to={`/members/${m.id}`}><b>{memberNo(m.enrolNo)}</b></Link> · Plan {m.planN} · {money(m.monthly)}/mo<span className="muted" style={{ display: 'block', fontSize: 13 }}>{m.paidCount}/{m.totalCount} paid · {money(m.paidAmount)}{m.overdueCount > 0 && <span className="tag-late"> · {m.overdueCount} overdue</span>}</span></div>
                  <Badge tone={payTone(m.status)}>{m.status}</Badge>
                  {cash && m.status === 'active' && <button className="btn sm" onClick={() => setCashFor(m)}>Record cash</button>}
                </div>))}
            </div>
            <div className="card"><h2>Recent payments</h2>
              {!d.payments.length ? <div className="muted">No payments yet.</div> : <div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Plan</th><th className="right">Amount</th><th>Status</th></tr></thead>
                <tbody>{d.payments.map((p) => <tr key={p.id}><td className="mono">{p.ref}<span className="sub">{date(p.paidOn)} · {p.method.toUpperCase()}</span></td><td>Plan {p.planN} #{p.no}</td><td className="right mono">{money(p.amount)}</td><td><Badge tone={payTone(p.status)}>{p.status}</Badge></td></tr>)}</tbody></table></div>}
            </div>
            <div className="card"><h2>Referrals ({d.referrals.joined} joined of {d.referrals.items.length})</h2>
              {!d.referrals.items.length ? <div className="muted">Has not referred anyone yet.</div> : d.referrals.items.map((r) => <div key={r.id} className="row" style={{ padding: '4px 0' }}><span className="grow">{r.name} <span className="muted">{r.mobile}</span></span><Badge tone={r.joined ? 'green' : 'grey'}>{r.joined ? 'Joined a plan' : 'Signed up'}</Badge></div>)}
            </div>
          </>
        )}
      </aside>
      {cashFor && <CashModal member={{ id: cashFor.id, label: `${d?.name} · ${memberNo(cashFor.enrolNo)} · Plan ${cashFor.planN}`, instalments: cashFor.instalments }} onClose={() => setCashFor(null)} onDone={() => { reload(); onChanged(); }} />}
    </>
  );
}

export default function Customers() {
  const { id } = useParams();
  const nav = useNavigate();
  const [q, setQ] = useState(''), [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useFetch<Page<Row>>('/admin/customers', { q: dq, page, limit: 20 });
  return (
    <>
      <PageHead title="Customers" sub="Everyone who has signed up in the app. Tap a row for details." />
      <div className="toolbar"><input className="search" placeholder="Search name, mobile, city, C1001…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      <div className="card flush">
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data?.items.length ? <Empty text="No customers found." /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Customer</th><th>Mobile</th><th>City</th><th className="right">Plans</th><th className="right">Paid so far</th><th>Joined</th></tr></thead>
            <tbody>{data.items.map((c) => (
              <tr key={c.id} className="click" onClick={() => nav(`/customers/${c.id}`)}>
                <td><b>{c.name}</b> {c.blocked && <Badge tone="red">Blocked</Badge>}<span className="sub">{customerNo(c.customerNo)}</span></td>
                <td>{c.mobile}</td><td>{c.city ?? '—'}</td><td className="right">{c.plans}</td><td className="right mono">{money(c.paid)}</td>
                <td>{date(c.joinedAt)}<span className="sub">last login {date(c.lastLoginAt)}</span></td>
              </tr>))}</tbody></table></div>
        )}
        <Pager p={data?.pagination} onPage={setPage} />
      </div>
      {id && <Drawer id={id} onClose={() => nav('/customers')} onChanged={reload} />}
    </>
  );
}
