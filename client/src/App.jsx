import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Treks from './pages/Treks.jsx';
import TrekDetail from './pages/TrekDetail.jsx';
import Login from './pages/Login.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Admin from './pages/Admin.jsx';
import Dashboard from './pages/Dashboard.jsx';

function Guard({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="state">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <p className="state">This page is for admins only.</p>;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  // Dark is the default; the choice is remembered after the user toggles it
  const [theme, setTheme] = useState(localStorage.getItem('trailmate-theme') || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('trailmate-theme', theme);
  }, [theme]);

  return (<>
    <header className="top"><Link to="/" className="logo">TrailMate</Link>
      <nav>
        <NavLink to="/">Treks</NavLink>
        {user && <NavLink to="/bookings">My bookings</NavLink>}
        {user?.role === 'admin' && <NavLink to="/dashboard">Dashboard</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin">Manage treks</NavLink>}
        <button className="link" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {user ? <button className="link" onClick={logout}>Log out ({user.name})</button> : <NavLink to="/login">Log in</NavLink>}
      </nav></header>
    <main>
      <Routes>
        <Route path="/" element={<Treks />} />
        <Route path="/treks/:id" element={<TrekDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/bookings" element={<Guard><MyBookings /></Guard>} />
        <Route path="/dashboard" element={<Guard admin><Dashboard /></Guard>} />
        <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
        <Route path="*" element={<p className="state">Page not found.</p>} />
      </Routes>
    </main>
  </>);
}