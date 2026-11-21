import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Page } from '../api';
import { useAuth } from '../auth';
import { cap, customerNo, date, FULFIL, memberNo, money } from '../format';
import { Badge, Empty, ErrorBox, Loading, PageHead, Pager, payTone, useAction, useDebounced, useFetch } from '../ui';

export type MemberRow = {
  id: string; enrolNo: number; status: string; planN: number; monthly: number; totalInstalments: number; fulfilmentStatus: string; trackingRef: string | null;
  paidCount: number; overdueCount: number; paidAmount: number; bonusEarned: boolean; bonusSafe: boolean; bonusOverride: string | null; crackerValue: number;
  customer: { id: string; customerNo: number; name: string; mobile: string; deliveryMode: string; city: string | null };
};

export default function Members() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState(''), [status, setStatus] = useState(''), [fulfilment, setFulfilment] = useState(''), [plan, setPlan] = useState(''), [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useFetch<Page<MemberRow>>('/admin/members', { q: dq, status, fulfilment, plan, page, limit: 20 });
  const { busy, run } = useAction();
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  return (
    <>
      <PageHead title="Members" sub="Every plan a customer has joined, with cracker delivery progress.">
        {can('reports.view') && <button className="btn gold" disabled={busy} onClick={() => run(() => api.download('/admin/reports/members.csv', { q: dq, status, fulfilment, plan }, 'members.csv'))}>⬇ Packing list (CSV)</button>}
      </PageHead>
      <div className="toolbar">
        <input className="search" placeholder="Search name, mobile, GC-0001…" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        <select value={status} onChange={(e) => reset(setStatus)(e.target.value)}><option value="">Any status</option><option value="active">Active</option><option value="completed">Completed</option><option value="stopped">Stopped</option></select>
        <select value={fulfilment} onChange={(e) => reset(setFulfilment)(e.target.value)}><option value="">Any delivery stage</option>{FULFIL.map((f) => <option key={f} value={f}>{cap(f)}</option>)}</select>
        <select value={plan} onChange={(e) => reset(setPlan)(e.target.value)}><option value="">All plans</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Plan {n}</option>)}</select>
      </div>
      <div className="card flush">
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data?.items.length ? <Empty text="No members match." /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Member</th><th>Customer</th><th>Progress</th><th className="right">Paid</th><th>Bonus</th><th>Cracker delivery</th></tr></thead>
            <tbody>{data.items.map((m) => (
              <tr key={m.id} className="click" onClick={() => nav(`/members/${m.id}`)}>
                <td><b>{memberNo(m.enrolNo)}</b><span className="sub">Plan {m.planN} · {money(m.monthly)}/mo</span></td>
                <td><Link to={`/customers/${m.customer.id}`} onClick={(e) => e.stopPropagation()}>{m.customer.name}</Link><span className="sub">{customerNo(m.customer.customerNo)} · {m.customer.mobile}</span></td>
                <td>{m.paidCount}/{m.totalInstalments} <Badge tone={payTone(m.status)}>{m.status}</Badge>{m.overdueCount > 0 && <span className="sub tag-late">{m.overdueCount} overdue</span>}</td>
                <td className="right mono">{money(m.paidAmount)}</td>
                <td>{m.bonusEarned ? <Badge tone="green">Earned</Badge> : m.bonusSafe ? <Badge tone="blue">On track</Badge> : <Badge tone="red">Lost</Badge>}{m.bonusOverride && <span className="sub">override: {m.bonusOverride}</span>}</td>
                <td><Badge tone={payTone(m.fulfilmentStatus)}>{cap(m.fulfilmentStatus)}</Badge><span className="sub">{m.customer.deliveryMode === 'pickup' ? 'Pick-up' : 'Parcel'}{m.trackingRef ? ` · ${m.trackingRef}` : ''}</span></td>
              </tr>))}</tbody></table></div>
        )}
        <Pager p={data?.pagination} onPage={setPage} />
      </div>
    </>
  );
}
