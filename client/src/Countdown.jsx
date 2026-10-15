import { useEffect, useState } from 'react';

export default function Countdown({ until, onEnd }) {
  const left = () => Math.max(0, Math.floor((new Date(until) - Date.now()) / 1000));
  const [s, setS] = useState(left);
  useEffect(() => {
    const t = setInterval(() => {
      const v = left(); setS(v);
      if (v === 0) { clearInterval(t); onEnd && onEnd(); }
    }, 1000);
    return () => clearInterval(t);
  }, [until]);
  return <b className="timer">{String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</b>;
}