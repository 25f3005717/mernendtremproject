import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { LEVEL } from './Treks.jsx';
import Elevation from '../Elevation.jsx';
import Countdown from '../Countdown.jsx';

export default function TrekDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [trek, setTrek] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [batchId, setBatchId] = useState('');
  const [seats, setSeats] = useState(1);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState(null);
  const [paid, setPaid] = useState(null);
  const load = () => api('/treks/' + id).then(setTrek).catch(e => setError(e.message));
  useEffect(() => { load(); }, [id]);

  if (error && !trek) return <p className="error">{error}</p>;
  if (!trek) return <p className="state">Loading…</p>;
  const batch = trek.batches.find(b => b._id === batchId);
  const full = batch && batch.seatsLeft === 0;
  const seatOptions = full ? 6 : batch ? Math.min(6, batch.seatsLeft) : 1;
  const body = { trekId: id, batchId, seats: Number(seats) };

  async function run(fn) {
    if (!user) return nav('/login');
    setError(''); setInfo(''); setBusy(true);
    try { await fn(); }
    catch (e) { if (e.status === 401) return nav('/login'); setError(e.message); load(); }
    finally { setBusy(false); }
  }
  const reserve = () => run(async () => { setHeld(await api('/bookings', { method: 'POST', body })); await load(); });
  const joinWaitlist = () => run(async () => {
    await api('/bookings/waitlist', { method: 'POST', body });
    setInfo('You are on the waitlist. If seats free up, they are held for you for 30 minutes. Check My bookings.');
  });
  const pay = () => run(async () => { setPaid(await api(`/bookings/${held._id}/pay`, { method: 'POST' })); setHeld(null); await load(); });
  const holdEnded = () => { setHeld(null); setError('Your payment window ended and the seats were released. Please book again.'); load(); };

  return (<article className="detail">
    <Link to="/" className="back">Back to treks</Link>
    <h1>{trek.name}</h1>
    <p className="muted">{trek.region} · {LEVEL[trek.difficulty]} · {trek.days} days · up to {trek.maxAltitude.toLocaleString()} m</p>
    <p>{trek.description}</p>
    <Elevation itinerary={trek.itinerary} />
    <ol className="itin">{trek.itinerary?.map(d => <li key={d.day}><b>Day {d.day}</b> {d.title} <span className="muted">{d.altitude} m</span></li>)}</ol>
    <p className="muted">Best season: {trek.season.join(', ') || 'year-round'}</p>

    {paid ? <div className="success" role="status"><h3>Payment received. Booking confirmed.</h3>
      <p>{paid.seats} seat(s) on {new Date(paid.startDate).toLocaleDateString()}, paid ₹{paid.totalPrice.toLocaleString()}. Reference: {paid.paymentRef}</p>
      <Link to="/bookings">View my bookings and packing list</Link></div>
    : held ? <div className="hold" role="status"><h3>Seats held for you</h3>
      <p>Pay within <Countdown until={held.holdExpiresAt} onEnd={holdEnded} /> or the seats go back to other trekkers.</p>
      <p className="price">Total ₹{held.totalPrice.toLocaleString()}</p>
      <button className="primary" disabled={busy} onClick={pay}>{busy ? 'Processing…' : `Pay ₹${held.totalPrice.toLocaleString()} (test mode)`}</button>
      <p className="muted">Test payment: no real money is charged.</p>
      {error && <p className="error" role="alert">{error}</p>}</div>
    : <section className="booking"><h2>Choose a batch</h2>
      {trek.batches.length === 0 && <p className="state">No upcoming batches yet. Check back soon.</p>}
      <div className="batches">{trek.batches.map(b => (
        <button key={b._id} className={`batch ${b._id === batchId ? 'sel' : ''}`} onClick={() => { setBatchId(b._id); setSeats(1); setError(''); setInfo(''); }}>
          <strong>{new Date(b.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
          <span>{b.seatsLeft === 0 ? 'Full · waitlist open' : `${b.seatsLeft} of ${b.capacity} seats left`}</span></button>))}</div>
      {batch && <div className="row">
        <label>Seats <select value={seats} onChange={e => setSeats(e.target.value)}>{Array.from({ length: seatOptions }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></label>
        <p className="price">Total ₹{(seats * trek.pricePerPerson).toLocaleString()}</p>
        {full
          ? <button className="primary" disabled={busy} onClick={joinWaitlist}>{busy ? 'Joining…' : user ? 'Join waitlist' : 'Log in to join waitlist'}</button>
          : <button className="primary" disabled={busy} onClick={reserve}>{busy ? 'Reserving…' : user ? 'Reserve seats and pay' : 'Log in to book'}</button>}</div>}
      {info && <p className="ok" role="status">{info}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>}
  </article>);
}