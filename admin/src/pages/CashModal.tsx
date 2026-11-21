import { useState } from 'react';
import { api, type Page } from '../api';
import { customerNo, memberNo, money, monthName, todayISO } from '../format';
import { Empty, Field, Modal, useAction, useDebounced, useFetch } from '../ui';

type Member = { id: string; enrolNo: number; planN: number; monthly: number; status: string; customer: { name: string; mobile: string; customerNo: number } };

/** Record cash taken at the counter. Pass `member` to skip the search step. */
export default function CashModal({ member, onClose, onDone }: { member?: { id: string; label: string; instalments?: { no: number; month: string; status: string; amount: number }[] }; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim());
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(member ?? null);
  const search = useFetch<Page<Member>>(!picked && dq.length >= 2 ? '/admin/members' : null, { q: dq, status: 'active', limit: 8 });
  const detail = useFetch<{ instalments: { no: number; month: string; status: string; amount: number }[] }>(picked ? `/admin/members/${picked.id}` : null);
  const [no, setNo] = useState(''), [paidOn, setPaidOn] = useState(todayISO()), [note, setNote] = useState('');
  const { busy, run } = useAction();
  const open = (detail.data?.instalments ?? member?.instalments ?? []).filter((i) => i.status === 'pending');
  const save = async () => {
    const r = await run(() => api.post('/admin/payments/cash', { enrolmentId: picked!.id, instalmentNo: no ? Number(no) : undefined, paidOn, note: note || undefined }));
    if (r) { onDone(); onClose(); }
  };
  return (
    <Modal title="Record cash payment" onClose={onClose}>
      {!picked ? (
        <>
          <Field label="Find member" hint="Type name, mobile number or member number (GC-0001)"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" /></Field>
          {search.loading && dq.length >= 2 && <div className="muted">Searching…</div>}
          {search.error && <div className="warn">{search.error}</div>}
          {search.data && !search.data.items.length && <Empty text="No active member found" />}
          {search.data?.items.map((m) => (
            <button key={m.id} className="btn" style={{ justifyContent: 'space-between' }} onClick={() => setPicked({ id: m.id, label: `${m.customer.name} · ${memberNo(m.enrolNo)} · Plan ${m.planN}` })}>
              <span>{m.customer.name} <span className="muted">{customerNo(m.customer.customerNo)} · {m.customer.mobile}</span></span><span>{memberNo(m.enrolNo)} · {money(m.monthly)}/mo</span>
            </button>
          ))}
        </>
      ) : (
        <>
          <div className="info"><b>{picked.label}</b>{!member && <> · <a href="#" onClick={(e) => { e.preventDefault(); setPicked(null); }}>change</a></>}</div>
          {detail.loading && <div className="muted">Loading instalments…</div>}
          <div className="form-grid">
            <Field label="Instalment" hint="Leave on 'Next due' to pay the earliest pending one">
              <select value={no} onChange={(e) => setNo(e.target.value)}><option value="">Next due</option>{open.map((i) => <option key={i.no} value={i.no}>#{i.no} · {monthName(i.month)} · {money(i.amount)}</option>)}</select>
            </Field>
            <Field label="Paid on"><input type="date" value={paidOn} max={todayISO()} onChange={(e) => setPaidOn(e.target.value)} /></Field>
            <div className="full"><Field label="Note (optional)"><input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid at Theni Road counter" /></Field></div>
          </div>
          <div className="modal-foot"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !paidOn} onClick={save}>{busy ? 'Saving…' : 'Record cash'}</button></div>
        </>
      )}
    </Modal>
  );
}
