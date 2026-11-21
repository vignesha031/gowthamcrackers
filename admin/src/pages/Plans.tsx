import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { date, money } from '../format';
import { Badge, ErrorBox, Field, Loading, Modal, PageHead, Tabs, useAction, useFetch } from '../ui';

type Plan = { id: string; n: number; monthly: number; giftTa: string; giftEn: string; active: boolean; members: number; bonus: number; total: number; crackerValue: number };
type Term = { ta: string; en: string };
type Banner = { id: string; title: string; image: string; active: boolean };
type Scheme = {
  id: string; nameTa: string; nameEn: string; periodTa: string; periodEn: string; startDate: string; instalments: number; bonusInstalments: number; dueDay: number;
  chooseBy: string; parcelFrom: string; pickupBy: string; joinUntil: string | null; terms: Term[]; referralTarget: number; referralRewardTa: string; referralRewardEn: string; open: boolean; plans: Plan[];
};
type Shop = {
  nameTa: string; nameEn: string; subTa: string; since: number; legalName: string; phone: string; complaintsPhone: string; upiId: string;
  bank: { number: string; name: string; ifsc: string; type: string; bank: string; branch: string };
  stores: { key: string; ta: string; en: string; addrTa: string; addrEn: string; map: string }[];
};

// ───────── scheme form (create + edit) ─────────
function SchemeModal({ scheme, schemes, onClose, onDone }: { scheme?: Scheme; schemes: Scheme[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState(() => scheme ? { ...scheme, joinUntil: scheme.joinUntil ?? '' } : { nameTa: '', nameEn: '', periodTa: '', periodEn: '', startDate: '', instalments: 11, bonusInstalments: 1, dueDay: 10, chooseBy: '', parcelFrom: '', pickupBy: '', joinUntil: '', terms: [] as Term[], referralTarget: 5, referralRewardTa: '', referralRewardEn: '', open: true });
  const [copyFrom, setCopyFrom] = useState('');
  const { busy, run } = useAction();
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const num = (k: string) => (e: { target: { value: string } }) => set(k, e.target.value === '' ? '' : Number(e.target.value));
  const save = async () => {
    const body: Record<string, unknown> = { ...f, joinUntil: f.joinUntil || null };
    delete body.id; delete body.plans;
    if (!scheme && copyFrom) body.copyFrom = copyFrom;
    const r = await run(() => scheme ? api.patch(`/admin/schemes/${scheme.id}`, body) : api.post('/admin/schemes', body), scheme ? 'Scheme saved' : 'Scheme created');
    if (r) { onDone(); onClose(); }
  };
  const setTerm = (i: number, k: 'ta' | 'en', v: string) => set('terms', f.terms.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  return (
    <Modal title={scheme ? 'Edit scheme' : 'New scheme'} onClose={onClose} wide>
      {!scheme && schemes.length > 0 && <Field label="Copy plans and terms from" hint="Handy for next year: clones the plans, prices and terms of an earlier scheme."><select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}><option value="">Start empty</option>{schemes.map((s) => <option key={s.id} value={s.id}>{s.nameEn}</option>)}</select></Field>}
      {scheme && scheme.plans.some((p) => p.members > 0) && <div className="info">Members have joined, so the start date, number of instalments and due day are locked.</div>}
      <div className="form-grid">
        <Field label="Name (Tamil)"><input value={f.nameTa} onChange={(e) => set('nameTa', e.target.value)} /></Field>
        <Field label="Name (English)"><input value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} /></Field>
        <Field label="Period text (Tamil)"><input value={f.periodTa} onChange={(e) => set('periodTa', e.target.value)} /></Field>
        <Field label="Period text (English)"><input value={f.periodEn} onChange={(e) => set('periodEn', e.target.value)} placeholder="e.g. Dec 2026 – Oct 2027" /></Field>
        <Field label="Start date" hint="Must be the 1st of a month"><input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
        <Field label="Joining open until"><input type="date" value={f.joinUntil} onChange={(e) => set('joinUntil', e.target.value)} /></Field>
        <Field label="Instalments"><input type="number" min={1} max={36} value={f.instalments} onChange={num('instalments')} /></Field>
        <Field label="Bonus instalments"><input type="number" min={0} max={6} value={f.bonusInstalments} onChange={num('bonusInstalments')} /></Field>
        <Field label="Due day of month"><input type="number" min={1} max={28} value={f.dueDay} onChange={num('dueDay')} /></Field>
        <Field label="Choose crackers by"><input type="date" value={f.chooseBy} onChange={(e) => set('chooseBy', e.target.value)} /></Field>
        <Field label="Parcels sent from"><input type="date" value={f.parcelFrom} onChange={(e) => set('parcelFrom', e.target.value)} /></Field>
        <Field label="Store pick-up by"><input type="date" value={f.pickupBy} onChange={(e) => set('pickupBy', e.target.value)} /></Field>
        <Field label="Referrals needed for reward"><input type="number" min={1} max={100} value={f.referralTarget} onChange={num('referralTarget')} /></Field>
        <label className="field"><span>Open for new members</span><label className="row" style={{ fontWeight: 400 }}><input type="checkbox" checked={f.open} onChange={(e) => set('open', e.target.checked)} /> Yes (closes any other open scheme)</label></label>
        <Field label="Referral reward (Tamil)"><input value={f.referralRewardTa} onChange={(e) => set('referralRewardTa', e.target.value)} /></Field>
        <Field label="Referral reward (English)"><input value={f.referralRewardEn} onChange={(e) => set('referralRewardEn', e.target.value)} /></Field>
      </div>
      <div><b>Terms &amp; conditions</b>
        {f.terms.map((t, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-start', marginTop: 8 }}>
            <textarea className="grow" style={{ minHeight: 56 }} placeholder="Tamil" value={t.ta} onChange={(e) => setTerm(i, 'ta', e.target.value)} />
            <textarea className="grow" style={{ minHeight: 56 }} placeholder="English" value={t.en} onChange={(e) => setTerm(i, 'en', e.target.value)} />
            <button className="icon-btn" aria-label="Remove term" onClick={() => set('terms', f.terms.filter((_, j) => j !== i))}>✕</button>
          </div>))}
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => set('terms', [...f.terms, { ta: '', en: '' }])}>＋ Add term</button>
      </div>
      <div className="modal-foot"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save scheme'}</button></div>
    </Modal>
  );
}

// ───────── plan form ─────────
function PlanModal({ schemeId, plan, onClose, onDone }: { schemeId: string; plan?: Plan; onClose: () => void; onDone: () => void }) {
  const [n, setN] = useState(String(plan?.n ?? '')), [monthly, setMonthly] = useState(String(plan?.monthly ?? '')), [giftEn, setGiftEn] = useState(plan?.giftEn ?? ''), [giftTa, setGiftTa] = useState(plan?.giftTa ?? ''), [active, setActive] = useState(plan?.active ?? true);
  const { busy, run } = useAction();
  const save = async () => {
    const r = await run(() => plan ? api.patch(`/admin/plans/${plan.id}`, { monthly: Number(monthly), giftEn, giftTa, active }) : api.post(`/admin/schemes/${schemeId}/plans`, { n: Number(n), monthly: Number(monthly), giftEn, giftTa, active }), 'Plan saved');
    if (r) { onDone(); onClose(); }
  };
  return (
    <Modal title={plan ? `Edit Plan ${plan.n}` : 'Add plan'} onClose={onClose}>
      {plan && <div className="info">Price changes apply to new members only. Existing members keep what they signed up for.</div>}
      <div className="form-grid">
        {!plan && <Field label="Plan number"><input type="number" min={1} value={n} onChange={(e) => setN(e.target.value)} /></Field>}
        <Field label="Monthly amount (₹)"><input type="number" min={50} value={monthly} onChange={(e) => setMonthly(e.target.value)} /></Field>
        <Field label="Free gift (English)"><input value={giftEn} onChange={(e) => setGiftEn(e.target.value)} /></Field>
        <Field label="Free gift (Tamil)"><input value={giftTa} onChange={(e) => setGiftTa(e.target.value)} /></Field>
        <label className="field"><span>Available to join</span><label className="row" style={{ fontWeight: 400 }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label></label>
      </div>
      <div className="modal-foot"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !monthly || (!plan && !n)} onClick={save}>{busy ? 'Saving…' : 'Save plan'}</button></div>
    </Modal>
  );
}

function Schemes({ manage }: { manage: boolean }) {
  const { data, error, loading, reload } = useFetch<{ items: Scheme[] }>('/admin/schemes');
  const [editS, setEditS] = useState<Scheme | 'new' | null>(null), [planM, setPlanM] = useState<{ schemeId: string; plan?: Plan } | null>(null);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'No data'} retry={reload} />;
  return (
    <div className="stack">
      {manage && <div><button className="btn gold" onClick={() => setEditS('new')}>＋ New scheme</button></div>}
      {!data.items.length && <div className="card muted">No scheme yet. Create one to open joining in the app.</div>}
      {data.items.map((s) => (
        <div className="card" key={s.id}>
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 className="grow">{s.nameEn}</h2>{s.open ? <Badge tone="green">Open for joining</Badge> : <Badge tone="grey">Closed</Badge>}
            {manage && <button className="btn sm" onClick={() => setEditS(s)}>Edit</button>}
          </div>
          <p className="muted" style={{ margin: '0 0 12px' }}>{s.periodEn || '—'} · starts {date(s.startDate)} · {s.instalments} instalments + {s.bonusInstalments} bonus · due on day {s.dueDay} · join until {date(s.joinUntil)}<br />Choose crackers by {date(s.chooseBy)} · parcels from {date(s.parcelFrom)} · pick-up by {date(s.pickupBy)}</p>
          <div className="table-wrap"><table>
            <thead><tr><th>Plan</th><th className="right">Monthly</th><th className="right">Total</th><th className="right">Bonus</th><th className="right">Cracker value</th><th>Free gift</th><th className="right">Members</th><th /></tr></thead>
            <tbody>{s.plans.map((p) => (
              <tr key={p.id}><td><b>Plan {p.n}</b> {!p.active && <Badge tone="grey">Off</Badge>}</td><td className="right mono">{money(p.monthly)}</td><td className="right mono">{money(p.total)}</td><td className="right mono">{money(p.bonus)}</td><td className="right mono">{money(p.crackerValue)}</td><td>{p.giftEn || '—'}</td><td className="right">{p.members}</td>
                <td className="right">{manage && <button className="btn sm" onClick={() => setPlanM({ schemeId: s.id, plan: p })}>Edit</button>}</td></tr>))}
              {!s.plans.length && <tr><td colSpan={8} className="muted">No plans yet.</td></tr>}</tbody></table></div>
          {manage && <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setPlanM({ schemeId: s.id })}>＋ Add plan</button>}
        </div>))}
      {editS && <SchemeModal scheme={editS === 'new' ? undefined : editS} schemes={data.items} onClose={() => setEditS(null)} onDone={reload} />}
      {planM && <PlanModal schemeId={planM.schemeId} plan={planM.plan} onClose={() => setPlanM(null)} onDone={reload} />}
    </div>
  );
}

function ShopForm({ manage }: { manage: boolean }) {
  const { data, error, loading, reload } = useFetch<Shop>('/admin/settings/shop');
  const [f, setF] = useState<Shop | null>(null);
  const { busy, run } = useAction();
  useEffect(() => { if (data) setF(structuredClone(data)); }, [data]);
  if (loading && !data) return <Loading />;
  if (error || !f) return <ErrorBox message={error ?? 'No data'} retry={reload} />;
  const top = (k: keyof Shop) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === 'since' ? Number(e.target.value) : e.target.value });
  const bank = (k: keyof Shop['bank']) => (e: { target: { value: string } }) => setF({ ...f, bank: { ...f.bank, [k]: e.target.value } });
  const store = (i: number, k: keyof Shop['stores'][number], v: string) => setF({ ...f, stores: f.stores.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const save = async () => { const r = await run(() => api.put('/admin/settings/shop', f), 'Shop details saved'); if (r) reload(); };
  const dis = !manage;
  return (
    <div className="stack">
      <div className="card"><h2>Shop &amp; payment details</h2><p className="muted" style={{ marginTop: -6 }}>These are shown to customers in the app (UPI id, bank account, phone numbers).</p>
        <div className="form-grid">
          <Field label="Shop name (Tamil)"><input disabled={dis} value={f.nameTa} onChange={top('nameTa')} /></Field>
          <Field label="Shop name (English)"><input disabled={dis} value={f.nameEn} onChange={top('nameEn')} /></Field>
          <Field label="Tagline (Tamil)"><input disabled={dis} value={f.subTa} onChange={top('subTa')} /></Field>
          <Field label="Since (year)"><input disabled={dis} type="number" value={f.since} onChange={top('since')} /></Field>
          <Field label="Legal name"><input disabled={dis} value={f.legalName} onChange={top('legalName')} /></Field>
          <Field label="UPI id"><input disabled={dis} value={f.upiId} onChange={top('upiId')} /></Field>
          <Field label="Shop phone"><input disabled={dis} value={f.phone} maxLength={10} onChange={top('phone')} /></Field>
          <Field label="Complaints phone"><input disabled={dis} value={f.complaintsPhone} maxLength={10} onChange={top('complaintsPhone')} /></Field>
        </div></div>
      <div className="card"><h2>Bank account</h2>
        <div className="form-grid">
          <Field label="Account number"><input disabled={dis} value={f.bank.number} onChange={bank('number')} /></Field>
          <Field label="Account name"><input disabled={dis} value={f.bank.name} onChange={bank('name')} /></Field>
          <Field label="IFSC"><input disabled={dis} value={f.bank.ifsc} onChange={bank('ifsc')} /></Field>
          <Field label="Account type"><input disabled={dis} value={f.bank.type} onChange={bank('type')} /></Field>
          <Field label="Bank"><input disabled={dis} value={f.bank.bank} onChange={bank('bank')} /></Field>
          <Field label="Branch"><input disabled={dis} value={f.bank.branch} onChange={bank('branch')} /></Field>
        </div></div>
      <div className="card"><h2>Stores (pick-up points)</h2>
        {f.stores.map((s, i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--line)' : 0, paddingTop: i ? 14 : 0, marginTop: i ? 14 : 0 }}>
            <div className="form-grid">
              <Field label="Key" hint="Short id, e.g. main"><input disabled={dis} value={s.key} onChange={(e) => store(i, 'key', e.target.value)} /></Field>
              <Field label="Name (English)"><input disabled={dis} value={s.en} onChange={(e) => store(i, 'en', e.target.value)} /></Field>
              <Field label="Name (Tamil)"><input disabled={dis} value={s.ta} onChange={(e) => store(i, 'ta', e.target.value)} /></Field>
              <Field label="Map search text"><input disabled={dis} value={s.map} onChange={(e) => store(i, 'map', e.target.value)} /></Field>
              <Field label="Address (English)"><textarea disabled={dis} value={s.addrEn} onChange={(e) => store(i, 'addrEn', e.target.value)} /></Field>
              <Field label="Address (Tamil)"><textarea disabled={dis} value={s.addrTa} onChange={(e) => store(i, 'addrTa', e.target.value)} /></Field>
            </div>
            {manage && <button className="btn sm danger" style={{ marginTop: 8 }} onClick={() => setF({ ...f, stores: f.stores.filter((_, j) => j !== i) })}>Remove store</button>}
          </div>))}
        {manage && <button className="btn sm" style={{ marginTop: 12 }} onClick={() => setF({ ...f, stores: [...f.stores, { key: `store${f.stores.length + 1}`, ta: '', en: '', addrTa: '', addrEn: '', map: '' }] })}>＋ Add store</button>}
      </div>
      {manage && <div><button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save shop details'}</button></div>}
    </div>
  );
}

export default function Plans() {
  const { can } = useAuth();
  const manage = can('scheme.manage');
  const [tab, setTab] = useState<'schemes' | 'shop' | 'banners'>('schemes');
  return (
    <>
      <PageHead title="Plans & Scheme" sub="The yearly scheme, its plans and prices, and the shop details customers see." />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'schemes', label: 'Schemes & plans' }, { key: 'banners', label: 'Home banners' }, { key: 'shop', label: 'Shop settings' }]} />
      {tab === 'schemes' ? <Schemes manage={manage} /> : tab === 'shop' ? <ShopForm manage={manage} /> : <Banners manage={manage} />}
    </>
  );
}

function Banners({ manage }: { manage: boolean }) {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const { busy, run } = useAction();
  useEffect(() => { api.get<Banner[]>('/admin/banners').then(setItems).catch(() => {}).finally(() => setLoading(false)); }, []);
  const save = async (next: Banner[]) => { const result = await run(() => api.put<Banner[]>('/admin/banners', next), 'Banners saved'); if (result) setItems(result); };
  const add = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 400_000) {
      window.alert('Choose a JPG, PNG or WebP image under 400 KB.'); return;
    }
    const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    if (items.length >= 8) { window.alert('You can add up to 8 banners.'); return; }
    const next = [...items, { id: crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, '').slice(0, 100), image, active: true }];
    await save(next);
  };
  if (loading) return <Loading />;
  return <div className="stack">
    <div className="info">Upload up to 8 JPG, PNG or WebP banners (each under 400 KB). Active banners rotate automatically on the customer home screen.</div>
    {items.length === 0 && <div className="card muted">No banners uploaded yet.</div>}
    <div className="grid g2">{items.map((b) => <div className="card" key={b.id}>
      <img src={b.image} alt={b.title} style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 10, background: '#f4eee3' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <input aria-label="Banner title" disabled={!manage} value={b.title} onChange={(e) => setItems((old) => old.map((x) => x.id === b.id ? { ...x, title: e.target.value } : x))} />
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', whiteSpace: 'nowrap' }}><input type="checkbox" disabled={!manage} checked={b.active} onChange={(e) => save(items.map((x) => x.id === b.id ? { ...x, active: e.target.checked } : x))} /> Active</label>
        {manage && <button className="btn sm danger" disabled={busy} onClick={() => save(items.filter((x) => x.id !== b.id))}>Remove</button>}
      </div>
    </div>)}</div>
    {manage && items.length < 8 && <label className="btn primary" style={{ width: 'fit-content', cursor: busy ? 'wait' : 'pointer' }}>
      {busy ? 'Uploading…' : '＋ Upload banner'}
      <input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ''; void add(file); }} />
    </label>}
    {manage && items.some((b) => b.title !== '') && <button className="btn" disabled={busy} onClick={() => save(items)}>Save banner titles</button>}
  </div>;
}
