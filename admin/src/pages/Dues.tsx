import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Page } from '../api';
import { useAuth } from '../auth';
import { customerNo, date, memberNo, money, monthName } from '../format';
import { Empty, ErrorBox, Loading, PageHead, Pager, Stat, Tabs, useAction, useDebounced, useFetch, useToast } from '../ui';

type Due = { id: string; no: number; month: string; dueDate: string; amount: number; enrolmentId: string; enrolNo: number; planN: number; customerId: string; customerNo: number; name: string; mobile: string; daysLate: number };
type Resp = Page<Due> & { summary: { overdueCount: number; overdueAmount: number; dueCount: number; dueAmount: number } };
type Tab = 'overdue' | 'due' | 'upcoming';

export default function Dues() {
  const { can } = useAuth();
  const manage = can('dues.manage');
  const [tab, setTab] = useState<Tab>('overdue'), [q, setQ] = useState(''), [plan, setPlan] = useState(''), [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useFetch<Resp>('/admin/dues', { tab, q: dq, plan, page, limit: 25 });
  const { busy, run } = useAction(), toast = useToast();
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const items = data?.items ?? [];
  const allOn = items.length > 0 && items.every((i) => sel.has(i.id));
  const remind = async (body: { instalmentIds?: string[]; allOverdue?: boolean }) => {
    const r = await run(() => api.post<{ reminded: number }>('/admin/dues/remind', body));
    if (r) { setSel(new Set()); toast('ok', `Reminder sent to ${r.reminded} member${r.reminded === 1 ? '' : 's'}`); }
  };
  return (
    <>
      <PageHead title="Dues" sub="Who still has to pay. Send an in-app reminder with one tap.">
        {manage && <button className="btn gold" disabled={busy || !data?.summary.overdueCount} onClick={() => { if (confirm(`Send a reminder to every member with an overdue instalment (${data?.summary.overdueCount} instalments)?`)) remind({ allOverdue: true }); }}>Remind all overdue</button>}
      </PageHead>
      {data && <div className="grid g3" style={{ marginBottom: 14 }}>
        <Stat label="Overdue" value={data.summary.overdueCount} sub={money(data.summary.overdueAmount)} tone={data.summary.overdueCount ? 'red' : undefined} />
        <Stat label="Due this month" value={data.summary.dueCount} sub={money(data.summary.dueAmount)} tone={data.summary.dueCount ? 'amber' : undefined} />
        <Stat label="Total pending now" value={data.summary.overdueCount + data.summary.dueCount} sub={money(data.summary.overdueAmount + data.summary.dueAmount)} />
      </div>}
      <div className="toolbar">
        <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); setSel(new Set()); }} items={[{ key: 'overdue', label: 'Overdue' }, { key: 'due', label: 'Due this month' }, { key: 'upcoming', label: 'Upcoming' }]} />
        <input className="search" placeholder="Search name or mobile…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }}><option value="">All plans</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Plan {n}</option>)}</select>
        {manage && sel.size > 0 && <button className="btn primary" disabled={busy} onClick={() => remind({ instalmentIds: [...sel] })}>Remind selected ({sel.size})</button>}
      </div>
      <div className="card flush">
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !items.length ? <Empty text="Nobody here. All clear." /> : (
          <div className="table-wrap"><table>
            <thead><tr>{manage && <th className="th-check"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(items.map((i) => i.id)))} aria-label="Select all" /></th>}<th>Customer</th><th>Member</th><th>Instalment</th><th>Due date</th><th className="right">Amount</th></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.id}>
                {manage && <td><input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} aria-label="Select" /></td>}
                <td><Link to={`/customers/${i.customerId}`}><b>{i.name}</b></Link><span className="sub">{customerNo(i.customerNo)} · <a href={`tel:${i.mobile}`}>{i.mobile}</a></span></td>
                <td><Link to={`/members/${i.enrolmentId}`}>{memberNo(i.enrolNo)}</Link><span className="sub">Plan {i.planN}</span></td>
                <td>#{i.no} · {monthName(i.month)}</td>
                <td>{date(i.dueDate)}{i.daysLate > 0 && <span className="sub tag-late">{i.daysLate} day{i.daysLate === 1 ? '' : 's'} late</span>}</td>
                <td className="right mono"><b>{money(i.amount)}</b></td>
              </tr>))}</tbody></table></div>
        )}
        <Pager p={data?.pagination} onPage={setPage} />
      </div>
    </>
  );
}
