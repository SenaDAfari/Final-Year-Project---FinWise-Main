import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import {
  MdDashboard, MdAccountBalanceWallet, MdSmartToy, MdHistory,
  MdSavings, MdLock, MdLogout, MdSettings, MdMenu, MdClose, MdPaid
} from 'react-icons/md';

// Full list of pages (desktop sidebar and the mobile "More" drawer).
// When you add Challenges or Weekly Reflection back, add them here.
const NAV_ITEMS = [
  { to: '/dashboard', icon: <MdDashboard />, label: 'Dashboard' },
  { to: '/expenses', icon: <MdAccountBalanceWallet />, label: 'Expenses' },
  { to: '/logs', icon: <MdHistory />, label: 'Logs' },
  { to: '/ai-advisor', icon: <MdSmartToy />, label: 'AI Advisor' },
  { to: '/savings', icon: <MdSavings />, label: 'Savings' },
  { to: '/limits', icon: <MdLock />, label: 'Limits' },
  { to: '/settings', icon: <MdSettings />, label: 'Settings' },
];

// The four pages pinned to the mobile bottom bar
const MAIN_PATHS = ['/dashboard', '/expenses', '/ai-advisor', '/savings'];
const MAIN_ITEMS = NAV_ITEMS.filter(item => MAIN_PATHS.includes(item.to));

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer whenever the page changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => {
    setDrawerOpen(false);
    logout();
    navigate('/login');
  };

  // Highlight "More" when the current page lives inside the drawer
  const onOverflowPage = !MAIN_PATHS.includes(location.pathname);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdPaid /></div>
          <span className="sidebar-logo-text">FinWise</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Notifications row */}
        <div style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Alerts</span>
          <NotificationBell />
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-link" onClick={handleLogout}>
            <MdLogout />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar: four main pages plus More */}
      <nav className="bottom-nav">
        {MAIN_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottom-nav-item ${drawerOpen || onOverflowPage ? 'active' : ''}`}
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <MdMenu />
          More
        </button>
      </nav>

      {/* Mobile drawer with the full set of pages */}
      <div
        className={`drawer-backdrop ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`mobile-drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="drawer-header">
          <div className="sidebar-logo" style={{ padding: 0 }}>
            <div className="sidebar-logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdPaid /></div>
            <span className="sidebar-logo-text">FinWise</span>
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <MdClose />
          </button>
        </div>

        <nav className="drawer-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="drawer-alerts">
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Alerts</span>
          <NotificationBell align="right" />
        </div>

        <button className="sidebar-link" onClick={handleLogout}>
          <MdLogout />
          Logout
        </button>
      </aside>
    </>
  );
};

export default Sidebar;