import { useState } from 'react';
import { type Page } from '../api';
import { cap, dateTime } from '../format';
import { Empty, ErrorBox, Loading, PageHead, Pager, useFetch } from '../ui';

export type Log = { id: string; action: string; entity: string | null; entityId: string | null; meta: Record<string, unknown> | null; ip?: string | null; at: string; admin?: string | null };

export const metaText = (m: Log['meta']) => {
  if (!m) return '';
  const s = Object.entries(m).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ');
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
};

export function LogTable({ items, showAdmin }: { items: Log[]; showAdmin?: boolean }) {
  return (
    <div className="table-wrap"><table>
      <thead><tr><th>When</th>{showAdmin && <th>Who</th>}<th>Action</th><th>Details</th></tr></thead>
      <tbody>{items.map((l) => (
        <tr key={l.id}><td className="nowrap">{dateTime(l.at)}</td>{showAdmin && <td>{l.admin ?? 'System'}{l.ip && <span className="sub">{l.ip}</span>}</td>}
          <td><b>{cap(l.action.replace('.', ' · '))}</b>{l.entity && <span className="sub">{l.entity}</span>}</td><td className="muted" style={{ wordBreak: 'break-word' }}>{metaText(l.meta)}</td></tr>))}</tbody></table></div>
  );
}

export default function Activity() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch<Page<Log>>('/admin/activity', { page, limit: 30 });
  return (
    <>
      <PageHead title="Activity log" sub="Everything staff did in this panel, newest first." />
      <div className="card flush">
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data?.items.length ? <Empty text="No activity yet." /> : <LogTable items={data.items} showAdmin />}
        <Pager p={data?.pagination} onPage={setPage} />
      </div>
    </>
  );
}
