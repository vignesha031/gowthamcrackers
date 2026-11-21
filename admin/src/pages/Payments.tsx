import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Page } from '../api';
import { useAuth } from '../auth';
import { customerNo, date, dateTime, memberNo, money, monthName, todayISO } from '../format';
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHead, Pager, Tabs, payTone, useAction, useDebounced, useFetch, useToast } from '../ui';
import CashModal from './CashModal';

type Pay = { id: string; ref: string; amount: number; method: string; utr: string | null; status: string; paidOn: string; rejectReason: string | null; note: string | null; createdAt: string; late: boolean; customerId: string; customerNo: number; name: string; mobile: string; enrolNo: number; planN: number; no: number; month: string; dueDate: string; receivedBy: string | null; reviewedBy: string | null };
type Tab = 'submitted' | 'confirmed' | 'rejected';

function ConfirmModal({ p, onClose, onDone }: { p: Pay; onClose: () => void; onDone: () => void }) {
  const [paidOn, setPaidOn] = useState(p.paidOn);
  const { busy, run } = useAction();
  const toast = useToast();
  const late = paidOn > p.dueDate;
  const save = async () => {
    const r = await run(() => api.post<{ onTime: boolean; completed: boolean }>(`/admin/payments/${p.id}/confirm`, { paidOn: paidOn !== p.paidOn ? paidOn : undefined }));
    if (r) { toast('ok', r.onTime ? 'Payment confirmed' : 'Confirmed — paid late, so the bonus is at risk'); onDone(); onClose(); }
  };
  return (
    <Modal title={`Confirm ${money(p.amount)}`} onClose={onClose}>
      <div className="info">{p.name} · {memberNo(p.enrolNo)} · Instalment #{p.no} ({monthName(p.month)}) · {p.method.toUpperCase()}{p.utr ? ` · Ref ${p.utr}` : ''}</div>
      <Field label="Date the money was paid" hint={`Due date was ${date(p.dueDate)}. Change this only if the customer really paid on another day.`}>
        <input type="date" value={paidOn} max={todayISO()} onChange={(e) => setPaidOn(e.target.value)} />
      </Field>
      {late && <div className="warn">⚠ This is after the due date ({date(p.dueDate)}). The member will lose the bonus and free gift.</div>}
      <div className="modal-foot"><button className="btn" onClick={onClose}>Cancel</button><button className="btn good" disabled={busy || !paidOn} onClick={save}>{busy ? 'Confirming…' : 'Confirm payment'}</button></div>
    </Modal>
  );
}

function RejectModal({ p, onClose, onDone }: { p: Pay; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const { busy, run } = useAction();
  const save = async () => { const r = await run(() => api.post(`/admin/payments/${p.id}/reject`, { reason }), 'Payment rejected'); if (r) { onDone(); onClose(); } };
  return (
    <Modal title="Reject payment" onClose={onClose}>
      <div className="info">{p.name} · {money(p.amount)} · {p.ref}</div>
      <Field label="Reason (the customer will see this)"><textarea autoFocus value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Amount not received in our account" /></Field>
      <div className="modal-foot"><button className="btn" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy || reason.trim().length < 3} onClick={save}>{busy ? 'Rejecting…' : 'Reject'}</button></div>
    </Modal>
  );
}

export default function Payments() {
  const { can, badges, refreshBadges } = useAuth();
  const manage = can('payments.manage');
  const [tab, setTab] = useState<Tab>('submitted');
  const [q, setQ] = useState(''), [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useFetch<Page<Pay>>('/admin/payments', { status: tab, q: dq, page, limit: 20 });
  const [confirm, setConfirm] = useState<Pay | null>(null), [reject, setReject] = useState<Pay | null>(null), [cash, setCash] = useState(false);
  const done = () => { reload(); refreshBadges(); };
  return (
    <>
      <PageHead title="Payments" sub="Check the money in the shop account, then confirm. Customers see the result in the app.">
        {manage && <button className="btn gold" onClick={() => setCash(true)}>＋ Record cash</button>}
      </PageHead>
      <div className="toolbar">
        <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} items={[{ key: 'submitted', label: 'Waiting', count: badges.waiting }, { key: 'confirmed', label: 'Confirmed' }, { key: 'rejected', label: 'Rejected' }]} />
        <input className="search" placeholder="Search name, mobile, receipt, UTR…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      <div className="card flush">
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data?.items.length ? <Empty text={tab === 'submitted' ? 'Nothing waiting 🎉 All payments are checked.' : 'No payments here yet.'} /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Customer</th><th>Member / instalment</th><th className="right">Amount</th><th>Method</th><th>Paid on</th><th>{tab === 'rejected' ? 'Reason' : 'Receipt'}</th>{manage && tab === 'submitted' && <th />}</tr></thead>
            <tbody>{data.items.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/customers/${p.customerId}`}><b>{p.name}</b></Link><span className="sub">{customerNo(p.customerNo)} · {p.mobile}</span></td>
                <td>{memberNo(p.enrolNo)} · Plan {p.planN}<span className="sub">#{p.no} · {monthName(p.month)} (due {date(p.dueDate)})</span></td>
                <td className="right mono"><b>{money(p.amount)}</b></td>
                <td><Badge tone="grey">{p.method.toUpperCase()}</Badge>{p.utr && <span className="sub">{p.utr}</span>}{p.receivedBy && <span className="sub">by {p.receivedBy}</span>}</td>
                <td>{date(p.paidOn)}{p.late && <span className="sub tag-late">Late</span>}</td>
                <td>{tab === 'rejected' ? <span>{p.rejectReason}</span> : <><span className="mono">{p.ref}</span><span className="sub">{dateTime(p.createdAt)}</span></>}{tab !== 'submitted' && <Badge tone={payTone(p.status)}>{p.status}</Badge>}</td>
                {manage && tab === 'submitted' && <td className="nowrap right"><button className="btn sm good" onClick={() => setConfirm(p)}>Confirm</button> <button className="btn sm danger" onClick={() => setReject(p)}>Reject</button></td>}
              </tr>))}
            </tbody></table></div>
        )}
        <Pager p={data?.pagination} onPage={setPage} />
      </div>
      {confirm && <ConfirmModal p={confirm} onClose={() => setConfirm(null)} onDone={done} />}
      {reject && <RejectModal p={reject} onClose={() => setReject(null)} onDone={done} />}
      {cash && <CashModal onClose={() => setCash(false)} onDone={done} />}
    </>
  );
}
