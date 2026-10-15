import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const svg = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const EyeOpen = () => (<svg {...svg}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>);
const EyeOff = () => (<svg {...svg}><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>);

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', experience: 1 });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'login') await login({ email: f.email, password: f.password });
      else await register({ ...f, experience: Number(f.experience) });
      nav('/');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (<form className="auth" onSubmit={submit}>
    <h1>{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
    {mode === 'register' && <label>Name<input required minLength={2} value={f.name} onChange={set('name')} /></label>}
    <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
    <label>Password
      <div className="pw">
        <input type={show ? 'text' : 'password'} required minLength={mode === 'register' ? 8 : 1}
          value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        <button type="button" className="eye" onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? <EyeOff /> : <EyeOpen />}
        </button>
      </div>
    </label>
    {mode === 'register' && <label>Trekking experience
      <select value={f.experience} onChange={set('experience')}>
        <option value="1">Beginner: first treks</option>
        <option value="2">Intermediate: a few multi-day treks</option>
        <option value="3">Experienced: comfortable above 4,500 m</option>
      </select></label>}
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
    <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
      {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}</button>
  </form>);
}