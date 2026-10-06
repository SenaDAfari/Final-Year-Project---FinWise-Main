import React, { useState, useEffect, useRef } from 'react';
import {
  MdNotifications, MdClose, MdArrowForward, MdRefresh,
  MdWarning, MdBolt, MdCelebration, MdLightbulb, MdCheckCircle
} from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const getRouteFallback = (message) => {
  const msg = message.toLowerCase();
  if (msg.includes('limit') || (msg.includes('exceeded your') && msg.includes('limit'))) return '/limits';
  if (msg.includes('savings') || msg.includes('deposit')) return '/savings';
  if (msg.includes('logged any expenses') || msg.includes('expense')) return '/expenses';
  if (msg.includes('budget') || msg.includes('spending rate') || msg.includes('run out')) return '/dashboard';
  return '/dashboard';
};

const ROUTE_LABELS = {
  '/dashboard': 'Dashboard',
  '/limits': 'Spending Limits',
  '/savings': 'Savings',
  '/expenses': 'Expenses',
};

const notifKey = (n) => `${n.type || 'info'}::${n.message}`;

const NotificationBell = ({ align = 'left' }) => {
  const { user } = useAuth();
  const dismissedKey = `fw_dismissed_notifications_${user?.id ?? user?.email ?? 'anon'}`;

  const [allNotifications, setAllNotifications] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(dismissedKey) || '[]');
    } catch { return []; }
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/notifications')
      .then(res => setAllNotifications(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sessionStorage.setItem(dismissedKey, JSON.stringify(dismissed));
  }, [dismissed, dismissedKey]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getColor = (type) => {
    if (type === 'danger') return { bg: '#FEF2F2', color: '#DC2626', hover: '#fee2e2', Icon: MdWarning };
    if (type === 'warning') return { bg: '#FFF7ED', color: '#d97706', hover: '#fef3c7', Icon: MdBolt };
    if (type === 'success') return { bg: '#E8F5EE', color: '#1A5C38', hover: '#d1fae5', Icon: MdCelebration };
    return { bg: '#EFF6FF', color: '#2563eb', hover: '#dbeafe', Icon: MdLightbulb };
  };

  const handleNotificationClick = (n) => {
    const route = n.route || getRouteFallback(n.message);
    setOpen(false);
    navigate(route);
  };

  const handleDismiss = (e, key) => {
    e.stopPropagation();
    setDismissed(prev => [...prev, key]);
  };

  const handleRestoreAll = () => {
    setDismissed([]);
    sessionStorage.removeItem(dismissedKey);
  };

  const visible = allNotifications.filter(n => !dismissed.includes(notifKey(n)));
  const unread = visible.length;
  const hasDismissed = dismissed.length > 0;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: open ? 'rgba(255,255,255,0.15)' : 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.5rem',
          borderRadius: 8,
          position: 'relative',
          color: 'rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        title="Notifications"
      >
        <MdNotifications style={{ fontSize: '1.4rem' }} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 16, height: 16,
            background: '#DC2626', borderRadius: '50%',
            fontSize: '0.65rem', fontWeight: 800, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          ...(align === 'right' ? { right: 0 } : { left: 0 }),
          width: 320,
          maxWidth: 'calc(100vw - 2rem)',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 -4px 32px rgba(0,0,0,0.2), 0 8px 32px rgba(0,0,0,0.1)',
          border: '1px solid #E2E8E4',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #E2E8E4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F7F9F7' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0A2E1A' }}>
              Notifications {unread > 0 && <span style={{ color: '#DC2626' }}>({unread})</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {hasDismissed && (
                <button
                  onClick={handleRestoreAll}
                  title="Restore all dismissed notifications"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A5C38', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.5rem', borderRadius: 6 }}
                >
                  <MdRefresh style={{ fontSize: '0.95rem' }} />
                  Restore
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', padding: 4 }}
              >
                <MdClose />
              </button>
            </div>
          </div>

          {visible.length > 0 && (
            <div style={{ padding: '0.4rem 1rem', background: '#F7F9F7', borderBottom: '1px solid #E2E8E4', fontSize: '0.72rem', color: '#94a3b8' }}>
              Tap a notification to go to the relevant page · ✕ to dismiss
            </div>
          )}

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B', fontSize: '0.88rem' }}>Loading...</div>
            ) : visible.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}><MdCheckCircle /></div>
                <div style={{ color: '#64748B', fontSize: '0.88rem', marginBottom: '0.75rem' }}>
                  {hasDismissed ? 'All notifications dismissed.' : 'No alerts right now.'}
                </div>
                {hasDismissed && (
                  <button
                    onClick={handleRestoreAll}
                    style={{ background: '#E8F5EE', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', color: '#1A5C38', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'inherit' }}
                  >
                    <MdRefresh /> Show dismissed notifications
                  </button>
                )}
              </div>
            ) : (
              allNotifications.map((n) => {
                const key = notifKey(n);
                if (dismissed.includes(key)) return null;
                const style = getColor(n.type);
                const route = n.route || getRouteFallback(n.message);
                const routeLabel = ROUTE_LABELS[route] || 'Dashboard';

                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid #F1F5F9',
                      background: style.bg,
                    }}
                  >
                    <button
                      onClick={() => handleNotificationClick(n)}
                      style={{
                        flex: 1,
                        padding: '0.85rem 0 0.85rem 1rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.parentElement.style.background = style.hover}
                      onMouseLeave={e => e.currentTarget.parentElement.style.background = style.bg}
                    >
                      <span style={{ flexShrink: 0, marginTop: 2, fontSize: '1rem', display: 'flex' }}><style.Icon /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.84rem', color: style.color, lineHeight: 1.5, marginBottom: '0.3rem' }}>
                          {n.message}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                          Go to {routeLabel} <MdArrowForward style={{ fontSize: '0.8rem' }} />
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={(e) => handleDismiss(e, key)}
                      title="Dismiss"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0 0.75rem',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        fontSize: '0.9rem',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                      onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                    >
                      <MdClose />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;