import { useState } from 'react';
import { api, type Page } from '../api';
import { useAuth } from '../auth';
import { cap, dateTime } from '../format';
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHead, Pager, useAction, useDebounced, useFetch } from '../ui';
import { LogTable, type Log } from './Activity';

type Member = { id: string; name: string; email: string; phone: string | null; role: string; permissions: string[]; active: boolean; mustChangePassword: boolean; lastLoginAt: string | null; addedBy: string | null };
type Catalog = { sections: { key: string; label: string }[]; grantable: string[]; creatableRoles: string[]; presets: Record<string, string[]> };

function PermGrid({ cat, value, onChange }: { cat: Catalog; value: string[]; onChange: (v: string[]) => void }) {
  const has = (p: string) => value.includes(p) || (p.endsWith('.view') && value.includes(p.replace('.view', '.manage')));
  const toggle = (sec: string, kind: 'view' | 'manage', on: boolean) => {
    const v = `${sec}.view`, m = `${sec}.manage`;
    let next = value.filter((p) => p !== v && p !== m);
    if (kind === 'manage' && on) next = [...next, v, m]; else if (kind === 'manage') next = [...next, v]; else if (on) next = [...next, v];
    onChange(next.filter((p) => cat.grantable.includes(p)));
  };
  return (
    <div className="table-wrap"><table className="perm-table">
      <thead><tr><th>Section</th><th>Can view</th><th>Can change</th></tr></thead>
      <tbody>{cat.sections.map((s) => (
        <tr key={s.key}><td>{s.label}</td>
          <td><input type="checkbox" aria-label={`View ${s.label}`} disabled={!cat.grantable.includes(`${s.key}.view`)} checked={has(`${s.key}.view`)} onChange={(e) => toggle(s.key, 'view', e.target.checked)} /></td>
          <td><input type="checkbox" aria-label={`Change ${s.label}`} disabled={!cat.grantable.includes(`${s.key}.manage`)} checked={value.includes(`${s.key}.manage`)} onChange={(e) => toggle(s.key, 'manage', e.target.checked)} /></td></tr>))}</tbody></table></div>
  );
}

function StaffModal({ cat, staff, onClose, onDone }: { cat: Catalog; staff?: Member; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: staff?.name ?? '', email: staff?.email ?? '', phone: staff?.phone ?? '', password: '', role: staff?.role ?? cat.creatableRoles[cat.creatableRoles.length - 1] ?? 'staff' });
  const [perms, setPerms] = useState<string[]>(staff?.permissions ?? cat.presets.cashier ?? []);
  const [active, setActive] = useState(staff?.active ?? true);
  const { busy, run } = useAction();
  const save = async () => {
    const r = await run(() => staff
      ? api.patch(`/admin/staff/${staff.id}`, { name: f.name, ...(f.phone ? { phone: f.phone } : {}), role: f.role, permissions: perms, active })
      : api.post('/admin/staff', { name: f.name, email: f.email, ...(f.phone ? { phone: f.phone } : {}), password: f.password, role: f.role, permissions: perms }), staff ? 'Staff updated' : 'Staff added');
    if (r) { onDone(); onClose(); }
  };
  return (
    <Modal title={staff ? `Edit ${staff.name}` : 'Add staff'} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email (login)"><input type="email" disabled={!!staff} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Mobile (optional)"><input value={f.phone} maxLength={10} inputMode="numeric" onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Role"><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{[...new Set([...cat.creatableRoles, f.role])].map((r) => <option key={r} value={r}>{cap(r)}</option>)}</select></Field>
        {!staff && <div className="full"><Field label="Temporary password" hint="At least 8 characters with a letter and a number. They must change it at first login."><input type="text" autoComplete="off" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field></div>}
        {staff && <label className="field"><span>Account</span><label className="row" style={{ fontWeight: 400 }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (can sign in)</label></label>}
      </div>
      <div><b>Access</b>
        <div className="row" style={{ margin: '8px 0' }}><span className="muted">Quick presets:</span>{Object.keys(cat.presets).map((k) => <button key={k} type="button" className="btn sm" onClick={() => setPerms(cat.presets[k])}>{cap(k)}</button>)}<button type="button" className="btn sm" onClick={() => setPerms([])}>None</button></div>
        <PermGrid cat={cat} value={perms} onChange={setPerms} />
      </div>
      <div className="modal-foot"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || f.name.trim().length < 2 || (!staff && (!f.email || f.password.length < 8))} onClick={save}>{busy ? 'Saving…' : staff ? 'Save changes' : 'Add staff'}</button></div>
    </Modal>
  );
}

function ResetModal({ staff, onClose }: { staff: Member; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const { busy, run } = useAction();
  const save = async () => { const r = await run(() => api.post(`/admin/staff/${staff.id}/reset-password`, { password: pw }), 'Password reset'); if (r) onClose(); };
  return (
    <Modal title={`Reset password · ${staff.name}`} onClose={onClose}>
      <Field label="New temporary password" hint="At least 8 characters with a letter and a number. They must change it when they sign in."><input autoFocus autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      <div className="modal-foot"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || pw.length < 8} onClick={save}>{busy ? 'Saving…' : 'Reset password'}</button></div>
    </Modal>
  );
}

function ActivityModal({ staff, onClose }: { staff: Member; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch<Page<Log>>(`/admin/staff/${staff.id}/activity`, { page, limit: 15 });
  return (
    <Modal title={`Activity · ${staff.name}`} onClose={onClose} wide>
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data?.items.length ? <Empty text="No activity yet." /> : <LogTable items={data.items} />}
      <Pager p={data?.pagination} onPage={setPage} />
    </Modal>
  );
}

export default function Staff() {
  const { can } = useAuth();
  const manage = can('staff.manage');
  const [q, setQ] = useState(''), [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useFetch<Page<Member>>('/admin/staff', { q: dq, page, limit: 20 });
  const catF = useFetch<Catalog>('/admin/permissions');
  const [modal, setModal] = useState<{ kind: 'new' } | { kind: 'edit' | 'reset' | 'log'; s: Member } | null>(null);
  const cat = catF.data;
  return (
    <>
      <PageHead title="Staff" sub="People who can sign in to this panel, and exactly what each can open.">
        {manage && cat && cat.creatableRoles.length > 0 && <button className="btn gold" onClick={() => setModal({ kind: 'new' })}>＋ Add staff</button>}
      </PageHead>
      <div className="toolbar"><input className="search" placeholder="Search name or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      <div className="card flush">
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data?.items.length ? <Empty text="No staff yet. Add your first team member." /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Role</th><th>Access</th><th>Last sign-in</th><th /></tr></thead>
            <tbody>{data.items.map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b> {!s.active && <Badge tone="red">Off</Badge>}{s.mustChangePassword && <Badge tone="amber">Temp password</Badge>}<span className="sub">{s.email}{s.phone ? ` · ${s.phone}` : ''}</span></td>
                <td><Badge tone="maroon">{cap(s.role)}</Badge>{s.addedBy && <span className="sub">added by {s.addedBy}</span>}</td>
                <td className="muted">{s.permissions.filter((p) => p.endsWith('.manage')).length} change · {s.permissions.filter((p) => p.endsWith('.view')).length} view</td>
                <td>{dateTime(s.lastLoginAt)}</td>
                <td className="nowrap right"><button className="btn sm" onClick={() => setModal({ kind: 'log', s })}>Activity</button>{manage && <> <button className="btn sm" onClick={() => setModal({ kind: 'edit', s })}>Edit</button> <button className="btn sm" onClick={() => setModal({ kind: 'reset', s })}>Reset password</button></>}</td>
              </tr>))}</tbody></table></div>
        )}
        <Pager p={data?.pagination} onPage={setPage} />
      </div>
      {modal && cat && modal.kind === 'new' && <StaffModal cat={cat} onClose={() => setModal(null)} onDone={reload} />}
      {modal && cat && modal.kind === 'edit' && <StaffModal cat={cat} staff={modal.s} onClose={() => setModal(null)} onDone={reload} />}
      {modal && modal.kind === 'reset' && <ResetModal staff={modal.s} onClose={() => setModal(null)} />}
      {modal && modal.kind === 'log' && <ActivityModal staff={modal.s} onClose={() => setModal(null)} />}
    </>
  );
}
