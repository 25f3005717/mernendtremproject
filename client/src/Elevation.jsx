export default function Elevation({ itinerary = [] }) {
  if (itinerary.length < 2) return null;
  const W = 640, H = 210, P = 30, alts = itinerary.map(d => d.altitude);
  const max = Math.max(...alts), min = Math.min(...alts) * 0.8, n = itinerary.length;
  const x = (i) => P + i * (W - 2 * P) / (n - 1), y = (a) => H - P - (a - min) / (max - min || 1) * (H - 2 * P - 14);
  const pts = itinerary.map((d, i) => `${x(i)},${y(d.altitude)}`).join(' ');
  return (<figure className="elev"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Elevation profile by day">
    <polygon className="area" points={`${x(0)},${H - P} ${pts} ${x(n - 1)},${H - P}`} />
    <polyline className="line" points={pts} />
    {itinerary.map((d, i) => (<g key={d.day}><circle cx={x(i)} cy={y(d.altitude)} r="5" />
      <text x={x(i)} y={y(d.altitude) - 11} textAnchor="middle">{d.altitude} m</text>
      <text x={x(i)} y={H - 8} textAnchor="middle">Day {d.day}</text></g>))}
  </svg></figure>);
}
