import { useState } from 'react';
import { api } from '../api';
import { cap, date, FULFIL, money, todayISO } from '../format';
import { ErrorBox, Field, Loading, PageHead, Stat, useAction, useFetch } from '../ui';

type R = { from: string; to: string; total: number; byMethod: { method: string; count: number; total: number }[]; daily: { day: string; count: number; total: number }[]; byPlan: { n: number; count: number; total: number }[] };

export default function Reports() {
  const [from, setFrom] = useState(`${todayISO().slice(0, 7)}-01`), [to, setTo] = useState(todayISO());
  const { data, error, loading, reload } = useFetch<R>('/admin/reports/collections', { from, to });
  const [status, setStatus] = useState(''), [fulfilment, setFulfilment] = useState('');
  const { busy, run } = useAction();
  const max = Math.max(1, ...(data?.daily.map((d) => d.total) ?? []));
  return (
    <>
      <PageHead title="Reports" sub="Money collected and spreadsheet downloads." />
      <div className="toolbar">
        <Field label="From"><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        <div style={{ alignSelf: 'flex-end' }}><button className="btn gold" disabled={busy} onClick={() => run(() => api.download('/admin/reports/payments.csv', { from, to }, 'payments.csv'))}>⬇ Payments CSV</button></div>
      </div>
      {loading && !data ? <Loading /> : error || !data ? <ErrorBox message={error ?? 'No data'} retry={reload} /> : (
        <>
          <div className="grid g3" style={{ marginBottom: 14 }}>
            <Stat label="Collected (confirmed)" value={money(data.total)} sub={`${date(data.from)} – ${date(data.to)}`} tone="green" />
            <Stat label="Payments" value={data.byMethod.reduce((s, m) => s + m.count, 0)} />
            <Stat label="Days with collections" value={data.daily.length} />
          </div>
          <div className="grid g2" style={{ marginBottom: 14 }}>
            <div className="card flush"><div style={{ padding: '18px 18px 0' }}><h2>By method</h2></div><div className="table-wrap"><table><thead><tr><th>Method</th><th className="right">Payments</th><th className="right">Amount</th></tr></thead>
              <tbody>{data.byMethod.map((m) => <tr key={m.method}><td>{m.method.toUpperCase()}</td><td className="right">{m.count}</td><td className="right mono">{money(m.total)}</td></tr>)}{!data.byMethod.length && <tr><td colSpan={3} className="muted">Nothing in this period</td></tr>}</tbody></table></div></div>
            <div className="card flush"><div style={{ padding: '18px 18px 0' }}><h2>By plan</h2></div><div className="table-wrap"><table><thead><tr><th>Plan</th><th className="right">Payments</th><th className="right">Amount</th></tr></thead>
              <tbody>{data.byPlan.map((m) => <tr key={m.n}><td>Plan {m.n}</td><td className="right">{m.count}</td><td className="right mono">{money(m.total)}</td></tr>)}{!data.byPlan.length && <tr><td colSpan={3} className="muted">Nothing in this period</td></tr>}</tbody></table></div></div>
          </div>
          <div className="card flush" style={{ marginBottom: 14 }}><div style={{ padding: '18px 18px 0' }}><h2>Day by day</h2></div><div className="table-wrap"><table><thead><tr><th>Date</th><th className="right">Payments</th><th className="right">Amount</th><th style={{ width: '40%' }} /></tr></thead>
            <tbody>{data.daily.map((d) => <tr key={d.day}><td>{date(d.day)}</td><td className="right">{d.count}</td><td className="right mono">{money(d.total)}</td><td><div style={{ background: 'var(--maroon)', height: 8, borderRadius: 4, width: `${Math.max(2, (d.total / max) * 100)}%` }} /></td></tr>)}{!data.daily.length && <tr><td colSpan={4} className="muted">Nothing in this period</td></tr>}</tbody></table></div></div>
        </>
      )}
      <div className="card"><h2>Members / packing list</h2><p className="muted" style={{ marginTop: -6 }}>One row per plan with delivery address, bonus and cracker value. Opens in Excel with Tamil text intact.</p>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option><option value="active">Active</option><option value="completed">Completed</option><option value="stopped">Stopped</option></select>
          <select value={fulfilment} onChange={(e) => setFulfilment(e.target.value)}><option value="">Any delivery stage</option>{FULFIL.map((f) => <option key={f} value={f}>{cap(f)}</option>)}</select>
          <button className="btn gold" disabled={busy} onClick={() => run(() => api.download('/admin/reports/members.csv', { status, fulfilment }, 'members.csv'))}>⬇ Members CSV</button>
        </div></div>
    </>
  );
}
