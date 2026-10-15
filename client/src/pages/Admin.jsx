import { useEffect, useState } from 'react';
import { api } from '../api.js';

const blank = { name: '', region: '', difficulty: 1, days: 3, maxAltitude: 3000, pricePerPerson: 5000, season: 'spring', description: '' };
const num = ['difficulty', 'days', 'maxAltitude', 'pricePerPerson'];
const SEASONS = ['winter', 'spring', 'summer', 'monsoon', 'autumn'];

export default function Admin() {
  const [treks, setTreks] = useState([]);
  const [f, setF] = useState(blank);
  const [editId, setEditId] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [batch, setBatch] = useState({ trekId: '', startDate: '', capacity: 12 });

  const load = () => api('/treks').then(setTreks).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ok = (m) => { setMsg(m); setError(''); };
  const fail = (e) => { setError(e.message); setMsg(''); };

  async function saveTrek(e) {
    e.preventDefault();
    try {
      const body = { ...f, season: [f.season] };
      num.forEach(k => body[k] = Number(body[k]));
      await api(editId ? `/treks/${editId}` : '/treks', { method: editId ? 'PUT' : 'POST', body });
      ok(editId ? 'Trek updated.' : 'Trek added.');
      setF(blank); setEditId(''); load();
    } catch (err) { fail(err); }
  }
  function startEdit(t) {
    setEditId(t._id);
    setF({ name: t.name, region: t.region, difficulty: t.difficulty, days: t.days, maxAltitude: t.maxAltitude,
      pricePerPerson: t.pricePerPerson, season: t.season[0] || 'spring', description: t.description || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function removeTrek(t) {
    if (!confirm(`Delete "${t.name}" permanently?`)) return;
    try { await api(`/treks/${t._id}`, { method: 'DELETE' }); ok('Trek deleted.'); load(); } catch (err) { fail(err); }
  }
  async function addBatch(e) {
    e.preventDefault();
    try {
      await api(`/treks/${batch.trekId}/batches`, { method: 'POST', body: { startDate: batch.startDate, capacity: Number(batch.capacity) } });
      ok('Batch added.'); load();
    } catch (err) { fail(err); }
  }
  async function removeBatch(t, b) {
    if (!confirm('Delete this batch?')) return;
    try { await api(`/treks/${t._id}/batches/${b._id}`, { method: 'DELETE' }); ok('Batch deleted.'); load(); } catch (err) { fail(err); }
  }

  return (<>
    <h1>Manage treks</h1>
    {msg && <p className="ok" role="status">{msg}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="two">
      <form className="auth" onSubmit={saveTrek}>
        <h2>{editId ? 'Edit trek' : 'Add a trek'}</h2>
        <label>Name<input required value={f.name} onChange={set('name')} /></label>
        <label>Region<input required value={f.region} onChange={set('region')} /></label>
        <label>Difficulty<select value={f.difficulty} onChange={set('difficulty')}><option value="1">Easy</option><option value="2">Moderate</option><option value="3">Hard</option></select></label>
        <label>Days<input type="number" min="1" value={f.days} onChange={set('days')} /></label>
        <label>Max altitude (m)<input type="number" min="0" value={f.maxAltitude} onChange={set('maxAltitude')} /></label>
        <label>Price per person (₹)<input type="number" min="0" value={f.pricePerPerson} onChange={set('pricePerPerson')} /></label>
        <label>Best season<select value={f.season} onChange={set('season')}>{SEASONS.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Description<textarea value={f.description} onChange={set('description')} /></label>
        <button className="primary">{editId ? 'Save changes' : 'Add trek'}</button>
        {editId && <button type="button" onClick={() => { setEditId(''); setF(blank); }}>Cancel editing</button>}
      </form>

      <form className="auth" onSubmit={addBatch}>
        <h2>Add a batch</h2>
        <label>Trek<select required value={batch.trekId} onChange={e => setBatch({ ...batch, trekId: e.target.value })}><option value="">Choose…</option>{treks.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select></label>
        <label>Start date<input type="date" required value={batch.startDate} onChange={e => setBatch({ ...batch, startDate: e.target.value })} /></label>
        <label>Capacity<input type="number" min="1" max="60" value={batch.capacity} onChange={e => setBatch({ ...batch, capacity: e.target.value })} /></label>
        <button className="primary">Add batch</button>
      </form>
    </div>

    <h2 style={{ marginTop: 32 }}>All treks ({treks.length})</h2>
    {treks.length === 0 && <p className="state">No treks yet. Add your first trek above.</p>}
    <div className="list">{treks.map(t => (
      <div key={t._id} className="panel">
        <div className="row-card">
          <div><h3>{t.name}</h3><p className="muted">{t.region} · {t.days} days · ₹{t.pricePerPerson.toLocaleString()}</p></div>
          <div className="row">
            <button onClick={() => startEdit(t)}>Edit</button>
            <button style={{ color: 'var(--bad)' }} onClick={() => removeTrek(t)}>Delete trek</button>
          </div>
        </div>
        <div className="gear">
          {t.batches.length === 0 && <p className="muted">No batches yet.</p>}
          <div className="gearlist">{t.batches.map(b => (
            <div key={b._id} className="check">
              <span>{new Date(b.startDate).toLocaleDateString()} ({b.seatsLeft}/{b.capacity} left)</span>
              <button style={{ color: 'var(--bad)', padding: '2px 10px' }} onClick={() => removeBatch(t, b)}>Delete</button>
            </div>))}</div>
        </div>
      </div>))}</div>
  </>);
}