import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { useAction } from '../ui';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const { busy, run } = useAction();
  const submit = (e: FormEvent) => { e.preventDefault(); run(() => login(email.trim(), password)); };
  return (
    <div className="login-wrap">
      <form className="login" onSubmit={submit}>
        <div className="logo">G</div>
        <div><h1>Admin sign in</h1><p className="muted" style={{ margin: '4px 0 0' }}>Gowtham Crackers chit fund</p></div>
        <label className="field"><span>Email</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        <label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
