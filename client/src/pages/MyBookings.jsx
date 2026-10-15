import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Countdown from '../Countdown.jsx';

const LABEL = { held: 'Awaiting payment', confirmed: 'Confirmed', cancelled: 'Cancelled', expired: 'Hold expired' };

export default function MyBookings() {
  const [list, setList] = useState(null);
  const [wait, setWait] = useState([]);
  const [error, setError] = useState('');
  const load = () => Promise.all([api('/bookings/mine'), api('/bookings/waitlist/mine')])
    .then(([a, w]) => { setList(a); setWait(w); }).catch(e => setError(e.message));
  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // picks up waitlist promotions without a manual refresh
    return () => clearInterval(t);
  }, []);

  const act = async (fn) => { setError(''); try { await fn(); await load(); } catch (e) { setError(e.message); load(); } };
  const cancel = (id) => confirm('Cancel this booking? Your seats will be released.') && act(() => api(`/bookings/${id}/cancel`, { method: 'POST' }));
  const pay = (id) => act(() => api(`/bookings/${id}/pay`, { method: 'POST' }));
  const leave = (id) => act(() => api(`/bookings/waitlist/${id}`, { method: 'DELETE' }));
  async function tick(b, item, checked) {
    setList(l => l.map(x => x._id !== b._id ? x : { ...x, gearChecked: checked ? [...x.gearChecked, item] : x.gearChecked.filter(i => i !== item) }));
    try { await api(`/bookings/${b._id}/gear`, { method: 'PATCH', body: { item, checked } }); }
    catch (e) { setError(e.message); load(); }
  }

  return (<>
    <h1>My bookings</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {!list && !error && <p className="state">Loading…</p>}
    {list?.length === 0 && wait.length === 0 && <p className="state">You have no bookings yet. <Link to="/">Browse treks</Link></p>}

    {wait.length > 0 && <><h2>Waitlist</h2><div className="list">{wait.map(w => (
      <div key={w._id} className="panel"><div className="row-card">
        <div><h3>{w.trekName}</h3>
          <p className="muted">{w.startDate && new Date(w.startDate).toLocaleDateString()} · {w.seats} seat(s) · you are number {w.position} in line</p></div>
        <button onClick={() => leave(w._id)}>Leave waitlist</button></div></div>))}</div></>}

    <div className="list" style={{ marginTop: 16 }}>{list?.map(b => {
      const pct = b.gear.length ? Math.round(b.gearChecked.length / b.gear.length * 100) : 0;
      return (<div key={b._id} className={`panel ${b.status}`}>
        <div className="row-card">
          <div><h3>{b.trek?.name} <span className="pill">{LABEL[b.status]}</span></h3>
            <p className="muted">{new Date(b.startDate).toLocaleDateString()} · {b.seats} seat(s) · ₹{b.totalPrice.toLocaleString()}
              {b.paymentRef && ` · Ref ${b.paymentRef}`}{b.fromWaitlist && b.status === 'held' && ' · seats freed from the waitlist for you'}</p>
            {b.status === 'held' && <p>Pay within <Countdown until={b.holdExpiresAt} onEnd={load} /></p>}</div>
          <div className="row">
            {b.status === 'held' && <button className="primary" onClick={() => pay(b._id)}>Pay ₹{b.totalPrice.toLocaleString()} (test)</button>}
            {b.canCancel && <button onClick={() => cancel(b._id)}>Cancel</button>}
            {b.status === 'confirmed' && !b.canCancel && <span className="muted">Locked (starts within 48 hours)</span>}
          </div>
        </div>
        {b.status === 'confirmed' && <div className="gear">
          <p><b>Trek readiness: {pct}%</b> <span className="muted">({b.gearChecked.length} of {b.gear.length} packed)</span></p>
          <div className="prog"><i style={{ width: pct + '%' }} /></div>
          <div className="gearlist">{b.gear.map(g => (<label key={g} className="check">
            <input type="checkbox" checked={b.gearChecked.includes(g)} onChange={e => tick(b, g, e.target.checked)} /> {g}</label>))}</div>
        </div>}
      </div>);
    })}</div>
  </>);
}