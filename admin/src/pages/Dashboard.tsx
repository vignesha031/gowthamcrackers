import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { cap, FULFIL, money, monthName } from '../format';
import { ErrorBox, Loading, PageHead, Stat, useFetch } from '../ui';

type D = {
  today: string; customers: number; members: number; completed: number; newCustomers7d: number;
  collected: { total: number; thisMonth: number; today: number; paidInstalments: number; totalInstalments: number };
  waitingVerification: { count: number; amount: number; oldest: string | null }; overdue: { count: number; amount: number; members: number }; dueNow: { count: number; amount: number };
  byPlan: { n: number; monthly: number; members: number; collected: number }[]; byMonth: { month: string; total: number }[];
  pipeline: { status: string; fulfilment: string; n: number }[]; referralEligible: number;
};

function Bars({ data }: { data: { month: string; total: number }[] }) {
  if (!data.length) return <div className="muted">No collections yet.</div>;
  const max = Math.max(...data.map((d) => d.total), 1), W = 64, H = 150;
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg role="img" aria-label="Collections by month" width={Math.max(data.length * W, 300)} height={H + 44} style={{ display: 'block' }}>
        {[0.5, 1].map((f) => <line key={f} x1="0" x2="100%" y1={H - H * f + 18} y2={H - H * f + 18} stroke="#eadfce" strokeDasharray="3 4" />)}
        {data.map((d, i) => {
          const h = Math.max(3, (d.total / max) * H);
          return <g key={d.month} transform={`translate(${i * W + 10},0)`}>
            <rect x="0" y={H - h + 18} width={W - 20} height={h} rx="6" fill="#7a1020" />
            <text x={(W - 20) / 2} y={H - h + 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#4a0a14">{d.total >= 100000 ? `${(d.total / 100000).toFixed(1)}L` : d.total >= 1000 ? `${Math.round(d.total / 1000)}k` : d.total}</text>
            <text x={(W - 20) / 2} y={H + 36} textAnchor="middle" fontSize="11" fill="#7d6a6c">{monthName(d.month)}</text>
          </g>;
        })}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { can } = useAuth();
  const { data: d, error, loading, reload } = useFetch<D>('/admin/dashboard');
  if (loading && !d) return <Loading />;
  if (error || !d) return <ErrorBox message={error ?? 'No data'} retry={reload} />;
  const pipe = FULFIL.map((f) => ({ f, n: d.pipeline.filter((p) => p.fulfilment === f && p.status !== 'stopped').reduce((s, p) => s + p.n, 0) }));
  const pct = d.collected.totalInstalments ? Math.round((d.collected.paidInstalments / d.collected.totalInstalments) * 100) : 0;
  return (
    <>
      <PageHead title="Dashboard" sub={`Overview as of today · ${d.newCustomers7d} new customer${d.newCustomers7d === 1 ? '' : 's'} this week`} />
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Stat label="Collected this month" value={money(d.collected.thisMonth)} sub={`Today ${money(d.collected.today)}`} tone="green" />
        <Stat label="Total collected" value={money(d.collected.total)} sub={`${d.collected.paidInstalments} of ${d.collected.totalInstalments} instalments (${pct}%)`} />
        <Stat label="Waiting to verify" value={d.waitingVerification.count} sub={money(d.waitingVerification.amount)} tone={d.waitingVerification.count ? 'amber' : undefined} />
        <Stat label="Overdue" value={d.overdue.count} sub={`${money(d.overdue.amount)} · ${d.overdue.members} member${d.overdue.members === 1 ? '' : 's'}`} tone={d.overdue.count ? 'red' : undefined} />
      </div>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Stat label="Customers" value={d.customers} />
        <Stat label="Members (plans joined)" value={d.members} sub={`${d.completed} completed`} />
        <Stat label="Due now" value={d.dueNow.count} sub={money(d.dueNow.amount)} />
        <Stat label="Referral reward eligible" value={d.referralEligible} sub="customers" />
      </div>
      <div className="grid g2" style={{ marginBottom: 14 }}>
        <div className="card"><h2>Collections by month</h2><Bars data={d.byMonth} /></div>
        <div className="card flush"><div style={{ padding: '18px 18px 0' }}><h2>By plan</h2></div>
          <div className="table-wrap"><table><thead><tr><th>Plan</th><th className="right">Monthly</th><th className="right">Members</th><th className="right">Collected</th></tr></thead>
            <tbody>{d.byPlan.length ? d.byPlan.map((p) => <tr key={p.n}><td><b>Plan {p.n}</b></td><td className="right mono">{money(p.monthly)}</td><td className="right">{p.members}</td><td className="right mono">{money(p.collected)}</td></tr>) : <tr><td colSpan={4} className="muted">No plans yet</td></tr>}</tbody></table></div></div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}><h2>Cracker fulfilment pipeline</h2>
        <div className="pipe">{pipe.map((p) => <div key={p.f}><b>{p.n}</b><span className="muted">{cap(p.f)}</span></div>)}</div></div>
      <div className="card"><h2>Quick links</h2><div className="row">
        {can('payments.view') && <Link className="btn" to="/payments">Verify payments</Link>}
        {can('dues.view') && <Link className="btn" to="/dues">See overdue</Link>}
        {can('enrolments.view') && <Link className="btn" to="/members">Members</Link>}
        {can('notifications.view') && <Link className="btn" to="/notifications">Send a message</Link>}
        {can('reports.view') && <Link className="btn" to="/reports">Reports</Link>}
      </div></div>
    </>
  );
}
