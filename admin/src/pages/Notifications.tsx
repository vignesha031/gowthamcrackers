import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Field, PageHead, useAction, useToast } from '../ui';

const AUD = [
  { key: 'all', label: 'All customers' }, { key: 'members', label: 'Members (joined any plan)' }, { key: 'overdue', label: 'Members with overdue instalments' },
  { key: 'completed', label: 'Members who completed a plan' }, { key: 'plan', label: 'Members of one plan' },
];

export default function Notifications() {
  const { can } = useAuth();
  const manage = can('notifications.manage');
  const [audience, setAudience] = useState('all'), [planN, setPlanN] = useState('1'), [kind, setKind] = useState('general');
  const [titleEn, setTitleEn] = useState(''), [bodyEn, setBodyEn] = useState(''), [titleTa, setTitleTa] = useState(''), [bodyTa, setBodyTa] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const { busy, run } = useAction();
  const toast = useToast();
  const aud = { audience, ...(audience === 'plan' ? { planN: Number(planN) } : {}) };
  useEffect(() => {
    setCount(null);
    if (audience === 'plan' && !planN) return;
    let live = true;
    api.post<{ count: number }>('/admin/notifications/audience', aud).then((r) => live && setCount(r.count)).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, planN]);
  const ready = titleEn.trim() && bodyEn.trim() && titleTa.trim() && bodyTa.trim();
  const send = async () => {
    if (!confirm(`Send this message to ${count ?? 'the selected'} customer(s)? This cannot be undone.`)) return;
    const r = await run(() => api.post<{ sent: number }>('/admin/notifications/broadcast', { ...aud, kind, titleEn, bodyEn, titleTa, bodyTa }));
    if (r) { toast('ok', `Sent to ${r.sent} customer${r.sent === 1 ? '' : 's'}`); setTitleEn(''); setBodyEn(''); setTitleTa(''); setBodyTa(''); }
  };
  return (
    <>
      <PageHead title="Notifications" sub="Send a message to the in-app inbox of your customers. Write it in both Tamil and English; each customer sees their own language." />
      <div className="card stack" style={{ maxWidth: 760 }}>
        <div className="form-grid">
          <Field label="Send to"><select value={audience} onChange={(e) => setAudience(e.target.value)}>{AUD.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select></Field>
          {audience === 'plan' ? <Field label="Plan number"><input type="number" min={1} value={planN} onChange={(e) => setPlanN(e.target.value)} /></Field>
            : <Field label="Type"><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="general">General</option><option value="offers">Offer</option></select></Field>}
          {audience === 'plan' && <Field label="Type"><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="general">General</option><option value="offers">Offer</option></select></Field>}
        </div>
        <div className="info">{count === null ? 'Counting recipients…' : <><b>{count}</b> customer{count === 1 ? '' : 's'} will receive this message.</>}</div>
        <div className="form-grid">
          <Field label="Title (English)"><input value={titleEn} maxLength={100} onChange={(e) => setTitleEn(e.target.value)} /></Field>
          <Field label="Title (Tamil)"><input value={titleTa} maxLength={100} onChange={(e) => setTitleTa(e.target.value)} /></Field>
          <Field label="Message (English)"><textarea value={bodyEn} maxLength={500} onChange={(e) => setBodyEn(e.target.value)} /></Field>
          <Field label="Message (Tamil)"><textarea value={bodyTa} maxLength={500} onChange={(e) => setBodyTa(e.target.value)} /></Field>
        </div>
        {manage ? <div className="row"><button className="btn primary" disabled={busy || !ready || count === 0} onClick={send}>{busy ? 'Sending…' : 'Send message'}</button>{!ready && <span className="muted">Fill all four fields.</span>}</div> : <div className="warn">You can see audience sizes but cannot send messages.</div>}
      </div>
    </>
  );
}
