import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useAction, useToast } from '../ui';

export default function ChangePassword({ forced }: { forced?: boolean }) {
  const { refreshMe, logout } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState(''), [next, setNext] = useState(''), [again, setAgain] = useState('');
  const { busy, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== again) return toast('err', 'The new passwords do not match');
    const r = await run(() => api.post('/admin/auth/change-password', { currentPassword: cur, newPassword: next }), 'Password changed');
    if (r) await refreshMe();
  };
  return (
    <div className="login-wrap">
      <form className="login" onSubmit={submit}>
        <div className="logo">G</div>
        <div><h1>{forced ? 'Choose a new password' : 'Change password'}</h1><p className="muted" style={{ margin: '4px 0 0' }}>{forced ? 'For safety, set your own password before you continue.' : ''}</p></div>
        <label className="field"><span>Current password</span><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
        <label className="field"><span>New password</span><input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} /><small className="muted">At least 8 characters, with a letter and a number.</small></label>
        <label className="field"><span>Repeat new password</span><input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        {forced && <button type="button" className="btn" onClick={logout}>Sign out</button>}
      </form>
    </div>
  );
}
