import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export const LEVEL = { 1: 'Easy', 2: 'Moderate', 3: 'Hard' };
const FIT = { good: 'Good fit for you', stretch: 'A stretch for you', 'too-hard': 'Too hard for your level' };

export default function Treks() {
  const { user } = useAuth();
  const [f, setF] = useState({ q: '', difficulty: '', season: '', maxDays: '', onlyAvailable: false });
  const [treks, setTreks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => v !== '' && v !== false && p.set(k, v));
      if (user) p.set('experience', user.experience);
      setError('');
      api('/treks?' + p).then(setTreks).catch(e => setError(e.message));
    }, 250); // debounce typing
    return () => clearTimeout(t);
  }, [f, user]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (<>
    <section className="hero"><h1>Find a trek that fits you, then book your batch.</h1>
      <p>{user ? 'Treks are matched to your experience level.' : 'Log in to see which treks match your experience.'}</p></section>
    <div className="filters">
      <input placeholder="Search name, region…" value={f.q} onChange={set('q')} aria-label="Search treks" />
      <select value={f.difficulty} onChange={set('difficulty')} aria-label="Difficulty"><option value="">Any difficulty</option><option value="1">Easy</option><option value="2">Moderate</option><option value="3">Hard</option></select>
      <select value={f.season} onChange={set('season')} aria-label="Season"><option value="">Any season</option>{['winter', 'spring', 'summer', 'monsoon', 'autumn'].map(s => <option key={s}>{s}</option>)}</select>
      <input type="number" min="1" placeholder="Max days" value={f.maxDays} onChange={set('maxDays')} aria-label="Maximum days" />
      <label className="check"><input type="checkbox" checked={f.onlyAvailable} onChange={set('onlyAvailable')} /> Has open batches</label>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {!treks && !error && <p className="state">Loading treks…</p>}
    {treks?.length === 0 && <p className="state">No treks match these filters. Try removing one.</p>}
    <div className="grid">{treks?.map(t => (
      <Link key={t._id} to={`/treks/${t._id}`} className={`card d${t.difficulty}`}>
        <div className="meta"><span className="pill">{LEVEL[t.difficulty]}</span>{t.fit && <span className={`fit ${t.fit}`}>{FIT[t.fit]}</span>}</div>
        <h3>{t.name}</h3><p className="muted">{t.region}</p>
        <p className="facts">{t.days} days, up to {t.maxAltitude.toLocaleString()} m</p>
        <div className="alt" title="Altitude"><i style={{ width: Math.round(t.maxAltitude / 62) + '%' }} /></div>
        <p className="price">₹{t.pricePerPerson.toLocaleString()} <small>per person</small></p>
        <p className={t.openBatches ? 'ok' : 'muted'}>{t.openBatches ? `${t.openBatches} open batch${t.openBatches > 1 ? 'es' : ''}` : 'No open batches'}</p>
      </Link>))}</div>
  </>);
}
