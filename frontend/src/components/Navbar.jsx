import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function getStoredUser() {
  const rawUser = localStorage.getItem('user');

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    return null;
  }
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());

    window.addEventListener('storage', syncUser);
    window.addEventListener('user-auth-changed', syncUser);

    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('user-auth-changed', syncUser);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('latestFeedback');
    window.dispatchEvent(new Event('user-auth-changed'));
    navigate('/login');
  };

  const links = [
    ['/', 'Home'],
    ['/features', 'Features'],
    ['/practice', 'Practice'],
    ['/feedback', 'Feedback'],
    ['/dashboard', 'Dashboard'],
    ['/about', 'About']
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 2rem', height: '68px',
      background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(148,163,184,0.18)',
      boxShadow: '0 10px 30px rgba(15,23,42,0.06)'
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #5eead4, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: '0.85rem'
        }}>AI</div>
        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>AI Interview Coach</span>
      </Link>

      <ul style={{ display: 'flex', gap: '4px', listStyle: 'none', padding: 0, margin: 0 }}>
        {links.map(([path, label]) => (
          <li key={path}>
            <Link to={path} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: '0.875rem',
              fontWeight: 500, textDecoration: 'none', display: 'block',
              color: location.pathname === path ? '#0f766e' : '#475569',
              background: location.pathname === path ? 'rgba(20,184,166,0.12)' : 'transparent',
              transition: 'all 0.2s'
            }}>{label}</Link>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {user ? (
          <>
            <span style={{ color: '#475569', fontSize: '0.85rem' }}>{user.email}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: '7px 18px', borderRadius: 9, fontSize: '0.85rem',
                background: '#ffffff', color: '#0f766e', fontWeight: 600,
                border: '1px solid rgba(20,184,166,0.28)', cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              style={{
                padding: '7px 18px', borderRadius: 9, fontSize: '0.85rem',
                background: '#ffffff', color: '#0f766e', fontWeight: 600,
                border: '1px solid rgba(20,184,166,0.28)', cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              Login
            </Link>
            <Link
              to="/register"
              style={{
                padding: '7px 18px', borderRadius: 9, fontSize: '0.85rem',
                background: 'linear-gradient(135deg, #5eead4, #3b82f6)',
                color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
