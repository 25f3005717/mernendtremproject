import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/admin/stats').then(setS).catch(e => setError(e.message)); }, []);
  if (error) return <p className="error" role="alert">{error}</p>;
  if (!s) return <p className="state">Loading dashboard…</p>;
  const top = Math.max(1, ...s.treks.map(t => t.revenue));
  return (<>
    <h1>Dashboard</h1>
    <div className="tiles">
      <div className="tile"><span>Revenue</span><b>₹{s.totals.revenue.toLocaleString()}</b></div>
      <div className="tile"><span>Bookings</span><b>{s.totals.bookings}</b></div>
      <div className="tile"><span>Seats sold</span><b>{s.totals.seats}</b></div>
    </div>
    {s.alerts.length > 0 && <div className="alert-box"><h3>Batches almost full</h3>
      {s.alerts.map((a, i) => <p key={i}>{a.trek} on {new Date(a.startDate).toLocaleDateString()}: {a.seatsLeft} seat(s) left</p>)}</div>}
    <h2>Treks by revenue and occupancy</h2>
    <div className="bars">{s.treks.map(t => (<div key={t.id} className="barrow">
      <span>{t.name}</span>
      <div className="track" title={`Revenue ₹${t.revenue.toLocaleString()}`}><i style={{ width: (t.revenue / top * 100) + '%' }} /></div>
      <small>₹{t.revenue.toLocaleString()} · {t.occupancy}% full</small></div>))}</div>
  </>);
}
