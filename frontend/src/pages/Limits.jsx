import React, { useState, useEffect } from 'react';
import {
  MdAdd, MdDelete, MdLock, MdWarning, MdBolt, MdCheckCircle, MdLightbulb, MdBarChart,
  MdError, MdEmojiEvents, MdEco, MdCreditCard,
  MdRestaurant, MdDirectionsBus, MdSmartphone, MdHome, MdCelebration, MdPrint, MdCategory
} from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_ICONS = {
  'Chop Money / Feeding': MdRestaurant,
  'Transport / Trotro': MdDirectionsBus,
  'Mobile Data': MdSmartphone,
  'Accommodation': MdHome,
  'Social / Entertainment': MdCelebration,
  'Printing / Stationery': MdPrint,
  'Miscellaneous': MdCategory,
};

const DEFAULT_CATEGORIES = [
  'Chop Money / Feeding',
  'Transport / Trotro',
  'Mobile Data',
  'Accommodation',
  'Social / Entertainment',
  'Printing / Stationery',
  'Miscellaneous',
];

const BRIDGE_DAYS_LEFT_THRESHOLD = 5;
const CELEBRATION_DAYS_LEFT_THRESHOLD = 5;
// Must match backend's MIN_MONTHS_FOR_HISTORY — used only for the
// "still gathering data" copy below, not for any actual filtering
// (the backend already omits averages/suggestions under this threshold).
const MIN_MONTHS_FOR_HISTORY = 2;

const Confetti = ({ active }) => {
  if (!active) return null;
  const pieces = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    color: ['#F4B942', '#0A2E1A', '#1A5C38', '#fff', '#e6a82e'][Math.floor(Math.random() * 5)],
    size: 6 + Math.random() * 8,
  }));
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 12 }}>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: '-10px',
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animation: `limitsConfettiFall 1.5s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes limitsConfettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const Limits = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const bridgeKey = `fw_bridge_state_${user?.id ?? user?.email ?? 'anon'}`;
  const celebrationKey = `fw_limits_celebration_${user?.id ?? user?.email ?? 'anon'}`;

  const [limits, setLimits] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: '', monthly_limit: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [cycle, setCycle] = useState(null);
  const [goal, setGoal] = useState(null);
  const [goalFetchFailed, setGoalFetchFailed] = useState(false);
  const [bridgeState, setBridgeState] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(bridgeKey) || 'null'); } catch { return null; }
  });
  const [showBridgeForm, setShowBridgeForm] = useState(false);
  const [bridgeAmount, setBridgeAmount] = useState('');
  const [bridgeSubmitting, setBridgeSubmitting] = useState(false);

  const [celebrationState, setCelebrationState] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(celebrationKey) || 'null'); } catch { return null; }
  });
  const [showConfetti, setShowConfetti] = useState(false);

  const userCategories = user?.categories?.length ? user.categories : DEFAULT_CATEGORIES;

  const fetchLimits = () => {
    setLoading(true);
    setPageError('');
    api.get('/limits')
      .then(res => {
        const payload = res.data;
        if (Array.isArray(payload)) {
          setLimits(payload);
          setCycle(null);
          setSuggestions([]);
        } else {
          setLimits(payload.limits || []);
          setCycle({ days_left: payload.days_left, cycle_id: payload.cycle_id });
          setSuggestions(payload.suggestions || []);
        }
      })
      .catch(err => {
        setPageError(err.response?.data?.error || 'Failed to load spending limits. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  useEffect(() => {
    api.get('/savings/goal')
      .then(res => setGoal(res.data))
      .catch(() => setGoalFetchFailed(true));
  }, []);

  useEffect(() => {
    if (bridgeState) sessionStorage.setItem(bridgeKey, JSON.stringify(bridgeState));
    else sessionStorage.removeItem(bridgeKey);
  }, [bridgeState, bridgeKey]);

  useEffect(() => {
    if (celebrationState) sessionStorage.setItem(celebrationKey, JSON.stringify(celebrationState));
    else sessionStorage.removeItem(celebrationKey);
  }, [celebrationState, celebrationKey]);

  const suggestionFor = (cat) => suggestions.find(s => s.category === cat);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.monthly_limit) return setError('Please fill in all fields');
    setSubmitting(true);
    setError('');
    setPageError('');
    try {
      await api.post('/limits', form);
      setSuccess(`Limit set for ${form.category}`);
      setForm({ category: '', monthly_limit: '' });
      setShowForm(false);
      fetchLimits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save limit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, category) => {
    if (!window.confirm(`Remove limit for ${category}?`)) return;
    setPageError('');
    try {
      await api.delete(`/limits/${id}`);
      setLimits(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      setPageError(err.response?.data?.error || 'Failed to delete limit. Please try again.');
    }
  };

  const handleBridgeDismiss = () => {
    setBridgeState({ cycle: cycle.cycle_id, action: 'dismissed' });
  };

  const handleBridgeDeposit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(bridgeAmount);
    if (!amt || amt <= 0) return setError('Enter an amount to move');
    setBridgeSubmitting(true);
    setError('');
    try {
      await api.post('/savings/deposit', {
        amount: amt,
        date: new Date().toISOString().split('T')[0],
      });
      setSuccess(`₵${amt.toFixed(2)} moved to your "${goal.goal_name}" goal`);
      setTimeout(() => setSuccess(''), 3000);
      setBridgeState({ cycle: cycle.cycle_id, action: 'done' });
      setShowBridgeForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to move money to savings. Please try again.');
    } finally {
      setBridgeSubmitting(false);
    }
  };

  const handleCelebrationDismiss = () => {
    setCelebrationState({ cycle: cycle.cycle_id });
  };

  const getStatusColor = (status) => {
    if (status === 'exceeded') return 'var(--status-critical)';
    if (status === 'warning') return 'var(--status-warning)';
    return 'var(--status-good)';
  };

  const getStatusBadge = (status) => {
    const iconStyle = { fontSize: '1.05rem', marginRight: '0.3rem', flexShrink: 0 };
    if (status === 'exceeded') return <span className="badge badge-red"><MdWarning style={iconStyle} /> Exceeded</span>;
    if (status === 'warning') return <span className="badge badge-gold"><MdBolt style={iconStyle} /> Near Limit</span>;
    return <span className="badge badge-green"><MdCheckCircle style={iconStyle} /> On Track</span>;
  };

  const availableCategories = userCategories.filter(
    cat => !limits.find(l => l.category === cat)
  );

  const totalSurplus = limits.reduce(
    (sum, l) => l.status === 'exceeded' ? sum : sum + Math.max(0, l.monthly_limit - l.spent),
    0
  );
  const totalLimitSpend = limits.reduce((sum, l) => sum + l.spent, 0);
  const allLimitsOk = limits.length > 0 && limits.every(l => l.status === 'ok');

  const goalReached = goal && Number(goal.saved_amount) >= Number(goal.target_amount);

  const bridgeEligible =
    cycle &&
    !goalFetchFailed &&
    !goalReached &&
    limits.length > 0 &&
    totalSurplus > 0 &&
    cycle.days_left <= BRIDGE_DAYS_LEFT_THRESHOLD &&
    (!bridgeState || bridgeState.cycle !== cycle.cycle_id);

  const celebrationEligible =
    cycle &&
    allLimitsOk &&
    totalLimitSpend > 0 &&
    cycle.days_left <= CELEBRATION_DAYS_LEFT_THRESHOLD &&
    (!celebrationState || celebrationState.cycle !== cycle.cycle_id);

  useEffect(() => {
    if (celebrationEligible) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrationEligible]);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h1 className="page-title">Spending Limits</h1>
          <p className="page-subtitle">Set commitment limits per category to control your spending</p>
        </div>
        {availableCategories.length > 0 && !pageError && (
          <button className="btn btn-primary" onClick={() => { setError(''); setShowForm(!showForm); }}>
            <MdAdd /> Set Limit
          </button>
        )}
      </div>

      {!pageError && (
        <div style={{
          background: 'linear-gradient(135deg, #0A2E1A, #1A5C38)',
          borderRadius: 12, padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem', color: '#fff',
          display: 'flex', gap: '1rem', alignItems: 'flex-start'
        }}>
          <div style={{ fontSize: '2.4rem', display: 'flex', color: '#F4B942', flexShrink: 0 }}><MdLock /></div>
          <div>
            <div style={{ fontWeight: 700, color: '#F4B942', marginBottom: '0.2rem' }}>
              Commitment Devices
            </div>
            <div style={{ fontSize: '0.88rem', opacity: 0.9, lineHeight: 1.6 }}>
              Setting a spending limit is a commitment to your future self. When you're thinking clearly now,
              you decide how much is enough for each category. FinWise will warn you when you're getting close
              and alert you when you've gone over — before the damage is done.
            </div>
          </div>
        </div>
      )}

      {pageError && (
        <div className="card mb-3" style={{ borderColor: '#fecaca' }}>
          <div className="error-msg" style={{ marginBottom: '0.5rem' }}>{pageError}</div>
          <button className="btn btn-outline btn-sm" onClick={fetchLimits}>Retry</button>
        </div>
      )}

      {!pageError && (
        <>
          {error && <div className="error-msg mb-2">{error}</div>}
          {success && (
            <div style={{ background: 'var(--status-good-bg)', border: '1px solid #86efac', borderRadius: 8, padding: '0.65rem 1rem', color: 'var(--status-good)', fontWeight: 600, marginBottom: '1rem' }}>
              {success}
            </div>
          )}

          {showForm && (
            <div className="card mb-3">
              <div className="section-title">New Spending Limit</div>
              <form onSubmit={handleSubmit}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      required
                    >
                      <option value="">Select category</option>
                      {availableCategories.map(c => (
                        <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly Limit (₵)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="e.g. 100"
                      value={form.monthly_limit}
                      onChange={e => setForm({ ...form, monthly_limit: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {form.category && suggestionFor(form.category) && (
                  <div style={{
                    background: '#EFF6FF', border: '1px solid #bfdbfe', borderRadius: 8,
                    padding: '0.65rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#1e40af',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1, minWidth: 200 }}>
                      <MdLightbulb style={{ fontSize: '1.4rem', flexShrink: 0 }} />
                      <span>
                        Based on your last {suggestionFor(form.category).months_tracked} months,
                        you spend about <strong>₵{suggestionFor(form.category).suggested_limit.toFixed(2)}/month</strong> on {form.category}.
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, monthly_limit: String(suggestionFor(form.category).suggested_limit) }))}
                      style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                    >
                      Use ₵{suggestionFor(form.category).suggested_limit.toFixed(2)}
                    </button>
                  </div>
                )}

                <div style={{ background: '#F7F9F7', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#64748B', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <MdLightbulb style={{ fontSize: '1.4rem', flexShrink: 0 }} />
                  <span>You will receive a warning when you reach 80% of this limit, and an alert when you exceed it.</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Set Limit'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setError(''); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {limits.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon"><MdLock style={{ fontSize: '2.5rem', color: '#CBD5E1' }} /></div>
                <p style={{ marginBottom: '1rem' }}>No spending limits set yet</p>
                <p className="text-muted text-sm" style={{ maxWidth: 380, margin: '0 auto 1rem' }}>
                  Setting limits on your spending categories is one of the most effective ways to control impulsive spending. Start with Social/Entertainment or Feeding.
                </p>
                <button className="btn btn-primary" onClick={() => { setError(''); setShowForm(true); }}>
                  <MdAdd /> Set Your First Limit
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {limits.map(l => (
                <div key={l.id} className="card" style={{
                  borderLeft: `4px solid ${getStatusColor(l.status)}`
                }}>
                  <div className="flex-between mb-2">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="expense-category-icon">{React.createElement(CATEGORY_ICONS[l.category] || MdCreditCard, { size: 22 })}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0A2E1A' }}>{l.category}</div>
                        <div className="text-muted text-sm">
                          ₵{l.spent.toFixed(2)} spent of ₵{l.monthly_limit.toFixed(2)} limit
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {getStatusBadge(l.status)}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(l.id, l.category)}
                      >
                        <MdDelete />
                      </button>
                    </div>
                  </div>

                  <div className="progress-bar-wrap" style={{ height: 10 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.min(100, l.percent)}%`,
                        background: getStatusColor(l.status),
                        transition: 'width 0.5s ease'
                      }}
                    />
                  </div>

                  <div className="flex-between mt-1">
                    <span className="text-muted text-sm">{l.percent}% used</span>
                    <span className="text-muted text-sm">
                      {l.status === 'exceeded'
                        ? `₵${(l.spent - l.monthly_limit).toFixed(2)} over limit`
                        : `₵${(l.monthly_limit - l.spent).toFixed(2)} remaining`
                      }
                    </span>
                  </div>

                  {/* Historical trend (D) — only shows a real average once at
                      least MIN_MONTHS_FOR_HISTORY months of data exist, so a
                      single month's total never gets mislabeled as an average. */}
                  {l.history && l.history.avg_monthly_spend !== null && l.history.avg_monthly_spend !== undefined ? (
                    <div className="text-muted text-sm" style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <MdBarChart style={{ fontSize: '1.25rem', flexShrink: 0 }} />
                      <span>
                        Historical: avg ₵{l.history.avg_monthly_spend.toFixed(2)}/month over last {l.history.months_tracked} months
                        {l.history.months_exceeded > 0 && (
                          <> · exceeded in {l.history.months_exceeded} of {l.history.months_tracked}</>
                        )}
                      </span>
                    </div>
                  ) : l.history && l.history.months_tracked > 0 ? (
                    <div className="text-muted text-sm" style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <MdBarChart style={{ fontSize: '1.25rem', flexShrink: 0 }} />
                      <span>Still gathering data — {l.history.months_tracked} of {MIN_MONTHS_FOR_HISTORY} months tracked so far</span>
                    </div>
                  ) : (
                    <div className="text-muted text-sm" style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <MdBarChart style={{ fontSize: '1.25rem', flexShrink: 0 }} />
                      <span>No spending history yet for this category</span>
                    </div>
                  )}

                  {l.status === 'exceeded' && (
                    <div style={{ marginTop: '0.75rem', background: 'var(--status-critical-bg)', borderRadius: 8, padding: '0.65rem 1rem', color: 'var(--status-critical)', fontSize: '0.87rem', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <MdError style={{ fontSize: '1.4rem', flexShrink: 0 }} />
                      <span>You have exceeded your {l.category} limit this month. Consider avoiding further spending in this category.</span>
                    </div>
                  )}
                  {l.status === 'warning' && (
                    <div style={{ marginTop: '0.75rem', background: 'var(--status-warning-bg)', borderRadius: 8, padding: '0.65rem 1rem', color: 'var(--status-warning-text)', fontSize: '0.87rem', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <MdBolt style={{ fontSize: '1.4rem', flexShrink: 0 }} />
                      <span>You are close to your {l.category} limit. Only ₵{(l.monthly_limit - l.spent).toFixed(2)} left in this category.</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {celebrationEligible && (
            <div style={{
              position: 'relative',
              background: 'linear-gradient(135deg, #0A2E1A, #1A5C38)',
              borderRadius: 12,
              padding: '1.5rem',
              marginTop: '1rem',
              textAlign: 'center',
              overflow: 'hidden',
            }}>
              <Confetti active={showConfetti} />
              <div style={{ fontSize: '3.2rem', marginBottom: '0.4rem', display: 'flex', justifyContent: 'center', color: '#F4B942' }}><MdEmojiEvents /></div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F4B942', marginBottom: '0.3rem' }}>
                Perfect cycle!
              </div>
              <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 1rem' }}>
                You stayed within all {limits.length} of your spending limits this cycle. That's real discipline — keep it going.
              </div>
              <button
                onClick={handleCelebrationDismiss}
                style={{ background: '#F4B942', border: 'none', borderRadius: 8, padding: '0.5rem 1.5rem', color: '#0A2E1A', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}
              >
                Nice!
              </button>
            </div>
          )}

          {bridgeEligible && (
            <div className="card mt-3" style={{ background: 'var(--status-good-bg)', border: '1px solid #86efac' }}>
              {!showBridgeForm ? (
                <>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '2.4rem', display: 'flex', color: 'var(--status-good)', flexShrink: 0 }}><MdEco /></div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--status-good)', marginBottom: '0.2rem' }}>
                        Found money: ₵{totalSurplus.toFixed(2)} unspent
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>
                        You're under your limits with {cycle.days_left} day{cycle.days_left === 1 ? '' : 's'} left
                        before your next allowance. Unspent money tends to quietly disappear into day-to-day
                        spending —{' '}
                        {goal
                          ? `move some of it to your "${goal.goal_name}" goal now, while it's still there.`
                          : 'consider putting it toward a savings goal so it doesn\'t slip away.'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
                    {goal ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => { setBridgeAmount(totalSurplus.toFixed(2)); setShowBridgeForm(true); setError(''); }}
                      >
                        Move to {goal.goal_name} →
                      </button>
                    ) : (
                      <button className="btn btn-primary" onClick={() => navigate('/savings')}>
                        Start a savings goal →
                      </button>
                    )}
                    <button className="btn btn-outline" onClick={handleBridgeDismiss}>
                      Not this cycle
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleBridgeDeposit}>
                  <div className="section-title" style={{ color: 'var(--status-good)' }}>Move money to your goal</div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Amount (₵)</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={bridgeAmount}
                        onChange={e => setBridgeAmount(e.target.value)}
                        style={{ width: 160 }}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={bridgeSubmitting}>
                      {bridgeSubmitting ? 'Moving...' : `Deposit to ${goal.goal_name}`}
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => setShowBridgeForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {limits.length > 0 && (
            <div className="card mt-3" style={{ background: '#F7F9F7' }}>
              <div className="section-title">This Month's Limit Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-good)' }}>
                    {limits.filter(l => l.status === 'ok').length}
                  </div>
                  <div className="text-muted text-sm">On Track</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-warning)' }}>
                    {limits.filter(l => l.status === 'warning').length}
                  </div>
                  <div className="text-muted text-sm">Near Limit</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-critical)' }}>
                    {limits.filter(l => l.status === 'exceeded').length}
                  </div>
                  <div className="text-muted text-sm">Exceeded</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Limits;