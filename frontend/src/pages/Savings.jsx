import React, { useState, useEffect, useRef } from 'react';
import {
  MdAdd, MdEmojiEvents, MdDelete, MdLocalFireDepartment, MdStar,
  MdTrackChanges, MdTrendingUp, MdCheckCircle, MdWarning, MdSavings
} from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

// Confetti burst component for milestone celebrations.
// NOTE: keyframes for `confettiFall` and `shimmer` now live in index.css,
// not inline <style> tags — see handoff notes. Make sure they're pasted in.
const Confetti = ({ active }) => {
  if (!active) return null;
  const pieces = Array.from({ length: 30 }, (_, i) => ({
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
            animation: `confettiFall 1.5s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
};

// Milestone thresholds
const MILESTONES = [25, 50, 75, 100];

const getMilestoneMessage = (percent) => {
  if (percent >= 100) return { Icon: MdEmojiEvents, title: "Goal Reached!", message: "Incredible! You've saved up everything you set out to save. You did it!" };
  if (percent >= 75) return { Icon: MdLocalFireDepartment, title: "75% There!", message: "You're almost there. One final push and your goal is yours." };
  if (percent >= 50) return { Icon: MdStar, title: "Halfway There!", message: "You've crossed the halfway mark. The momentum is with you — keep going!" };
  if (percent >= 25) return { Icon: MdTrackChanges, title: "25% Saved!", message: "Great start! You've proven you can do this. Every deposit gets you closer." };
  return null;
};

const todayStr = () => new Date().toISOString().split('T')[0];

const Savings = () => {
  const { user } = useAuth();
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Per-user sessionStorage key so milestone history doesn't leak across
  // accounts sharing the same browser. Now stores a MAP of
  // { [goalId]: [milestones already shown] } instead of a flat set, since
  // milestones must be tracked independently per goal.
  const milestoneKey = `fw_shown_milestones_${user?.id ?? user?.email ?? 'anon'}`;

  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [showNewGoalForm, setShowNewGoalForm] = useState(false);
  const [newGoalForm, setNewGoalForm] = useState({ goal_name: '', target_amount: '', deadline: '' });
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [goalFormError, setGoalFormError] = useState('');

  // Per-goal deposit form UI state, keyed by goal id, so each goal card has
  // its own independent open/closed form, field values, and error message.
  const [depositUI, setDepositUI] = useState({});

  // Milestone celebration: a queue so that if multiple goals cross a
  // milestone at once (e.g. first load of a new browser session with
  // several goals already partly funded), they're shown one at a time
  // instead of colliding.
  const [milestoneQueue, setMilestoneQueue] = useState([]);
  const [milestone, setMilestone] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [savingsStreak, setSavingsStreak] = useState(0);

  useEffect(() => {
    fetchGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance the milestone queue one at a time.
  useEffect(() => {
    if (!milestone && milestoneQueue.length > 0) {
      const [next, ...rest] = milestoneQueue;
      setMilestone(next);
      setMilestoneQueue(rest);
      setShowConfetti(true);
      const t = setTimeout(() => { if (isMountedRef.current) setShowConfetti(false); }, 2500);
      return () => clearTimeout(t);
    }
  }, [milestone, milestoneQueue]);

  const loadShownMilestonesMap = () => {
    try {
      return JSON.parse(sessionStorage.getItem(milestoneKey) || '{}');
    } catch {
      return {};
    }
  };

  const saveShownMilestonesMap = (map) => {
    sessionStorage.setItem(milestoneKey, JSON.stringify(map));
  };

  const fetchGoals = () => {
    setLoading(true);
    setPageError('');
    api.get('/savings/goals')
      .then(res => {
        if (!isMountedRef.current) return;
        const data = Array.isArray(res.data) ? res.data : [];
        setGoals(data);
        calculateSavingsStreak(data);
        checkAllMilestones(data);
      })
      .catch(err => {
        if (!isMountedRef.current) return;
        setPageError(err.response?.data?.error || 'Failed to load your savings goals. Please try again.');
      })
      .finally(() => { if (isMountedRef.current) setLoading(false); });
  };

  // Count consecutive months with at least one deposit into ANY goal.
  // Combines deposits across all goals since the streak represents an
  // overall savings habit, not commitment to a single goal.
  // Current calendar month gets a grace period — same fix as before.
  const calculateSavingsStreak = (allGoals) => {
    const allDeposits = allGoals.flatMap(g => g.deposits || []);
    if (allDeposits.length === 0) { setSavingsStreak(0); return; }
    let streak = 0;
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const checkMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${checkMonth.getFullYear()}-${String(checkMonth.getMonth() + 1).padStart(2, '0')}`;
      const hasDeposit = allDeposits.some(d => d.date.startsWith(monthStr));
      if (hasDeposit) {
        streak++;
      } else if (i === 0) {
        continue; // current month grace period
      } else {
        break;
      }
    }
    setSavingsStreak(streak);
  };

  // FIX: previously iterated milestones high-to-low and `break`d after the
  // first match, so a deposit jumping 20% -> 80% only ever fired the 75%
  // celebration — 25% and 50% were silently skipped AND never marked as
  // shown, so they'd incorrectly fire on the NEXT deposit instead. Now:
  // iterate low-to-high, collect ALL newly-crossed thresholds, mark them
  // all as shown in one write, and display only the highest one reached.
  // Runs per-goal, independently namespaced in sessionStorage.
  const checkAllMilestones = (goalsData) => {
    const map = loadShownMilestonesMap();
    let mapChanged = false;
    const newQueueItems = [];

    goalsData.forEach(g => {
      if (!g.target_amount || g.target_amount <= 0) return;
      const percent = Math.round((g.saved_amount / g.target_amount) * 100);
      const shownForGoal = new Set(map[g.id] || []);
      const newlyCrossed = MILESTONES.filter(m => percent >= m && !shownForGoal.has(m));
      if (newlyCrossed.length === 0) return;

      newlyCrossed.forEach(m => shownForGoal.add(m));
      map[g.id] = [...shownForGoal];
      mapChanged = true;

      const highest = Math.max(...newlyCrossed);
      const msg = getMilestoneMessage(highest);
      if (msg) {
        newQueueItems.push({ goalId: g.id, goalName: g.goal_name, ...msg });
      }
    });

    if (mapChanged) saveShownMilestonesMap(map);
    if (newQueueItems.length > 0) {
      setMilestoneQueue(prev => [...prev, ...newQueueItems]);
    }
  };

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    setGoalFormError('');
    const targetNum = parseFloat(newGoalForm.target_amount);
    if (!newGoalForm.goal_name.trim()) {
      setGoalFormError('Enter a name for your goal');
      return;
    }
    if (!newGoalForm.target_amount || isNaN(targetNum) || targetNum <= 0) {
      setGoalFormError('Enter a target amount greater than 0');
      return;
    }
    setCreatingGoal(true);
    try {
      await api.post('/savings/goals', newGoalForm);
      await fetchGoals();
      setShowNewGoalForm(false);
      setNewGoalForm({ goal_name: '', target_amount: '', deadline: '' });
    } catch (err) {
      setGoalFormError(err.response?.data?.error || 'Failed to create goal. Please try again.');
    } finally {
      if (isMountedRef.current) setCreatingGoal(false);
    }
  };

  // Deletion is now a targeted, per-goal action rather than an implicit
  // "replace" — the confirm dialog still warns about losing deposit
  // history, since that data really is gone once the goal is deleted.
  const handleDeleteGoal = async (goal) => {
    const hasHistory = goal.deposits && goal.deposits.length > 0;
    const warningMsg = hasHistory
      ? `Delete "${goal.goal_name}"? This will permanently remove all ${goal.deposits.length} deposit${goal.deposits.length !== 1 ? 's' : ''} you've logged toward it (₵${Number(goal.saved_amount).toFixed(2)} saved). This cannot be undone.`
      : `Delete "${goal.goal_name}"? This cannot be undone.`;
    if (!window.confirm(warningMsg)) return;

    setPageError('');
    try {
      await api.delete(`/savings/goals/${goal.id}`);
      const map = loadShownMilestonesMap();
      delete map[goal.id];
      saveShownMilestonesMap(map);
      await fetchGoals();
    } catch (err) {
      setPageError(err.response?.data?.error || 'Failed to delete goal. Please try again.');
    }
  };

  const getDepositUI = (goalId) =>
    depositUI[goalId] || { open: false, amount: '', date: todayStr(), submitting: false, error: '' };

  const toggleDepositForm = (goalId) => {
    const current = getDepositUI(goalId);
    setDepositUI(prev => ({ ...prev, [goalId]: { ...current, open: !current.open, error: '' } }));
  };

  const updateDepositField = (goalId, field, value) => {
    const current = getDepositUI(goalId);
    setDepositUI(prev => ({ ...prev, [goalId]: { ...current, [field]: value } }));
  };

  const handleDeposit = async (e, goal) => {
    e.preventDefault();
    const ui = getDepositUI(goal.id);
    const amountNum = parseFloat(ui.amount);
    if (!ui.amount || isNaN(amountNum) || amountNum <= 0) {
      setDepositUI(prev => ({ ...prev, [goal.id]: { ...ui, error: 'Enter a valid deposit amount greater than 0' } }));
      return;
    }
    setDepositUI(prev => ({ ...prev, [goal.id]: { ...ui, submitting: true, error: '' } }));
    try {
      await api.post(`/savings/goals/${goal.id}/deposit`, { amount: ui.amount, date: ui.date });
      await fetchGoals();
      if (isMountedRef.current) {
        setDepositUI(prev => ({ ...prev, [goal.id]: { open: false, amount: '', date: todayStr(), submitting: false, error: '' } }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setDepositUI(prev => ({
          ...prev,
          [goal.id]: { ...ui, submitting: false, error: err.response?.data?.error || 'Failed to log deposit. Please try again.' }
        }));
      }
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h1 className="page-title">Savings</h1>
          <p className="page-subtitle">Build your future one deposit at a time</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowNewGoalForm(v => !v); setGoalFormError(''); }}>
          <MdAdd /> New Goal
        </button>
      </div>

      {pageError && (
        <div className="card mb-3" style={{ borderColor: '#fecaca' }}>
          <div className="error-msg" style={{ marginBottom: '0.5rem' }}>{pageError}</div>
          <button className="btn btn-outline btn-sm" onClick={fetchGoals}>Retry</button>
        </div>
      )}

      {!pageError && (
        <>
          {/* Milestone celebration modal */}
          {milestone && (
            <div style={{
              position: 'relative',
              background: 'linear-gradient(135deg, #0A2E1A, #1A5C38)',
              borderRadius: 12,
              padding: '1.75rem',
              marginBottom: '1.5rem',
              textAlign: 'center',
              overflow: 'hidden',
            }}>
              <Confetti active={showConfetti} />
              <div style={{ fontSize: '4rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center', color: '#F4B942' }}>
                <milestone.Icon />
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#F4B942', marginBottom: '0.2rem' }}>
                {milestone.title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem', fontWeight: 600 }}>
                {milestone.goalName}
              </div>
              <div style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 1rem' }}>
                {milestone.message}
              </div>
              <button
                onClick={() => setMilestone(null)}
                style={{ background: '#F4B942', border: 'none', borderRadius: 8, padding: '0.5rem 1.5rem', color: '#0A2E1A', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem' }}
              >
                Keep Going!
              </button>
            </div>
          )}

          {/* Savings Streak (global, across all goals) */}
          {savingsStreak > 0 && (
            <div style={{
              background: savingsStreak >= 3 ? 'linear-gradient(135deg, #0A2E1A, #1A5C38)' : '#fff',
              border: savingsStreak >= 3 ? 'none' : '1px solid #E2E8E4',
              borderRadius: 12,
              padding: '1rem 1.5rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 12px rgba(10,46,26,0.08)'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: savingsStreak >= 3 ? '#F4B942' : '#1A5C38', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.2rem' }}>
                  Savings Streak
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: savingsStreak >= 3 ? '#fff' : '#0A2E1A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {savingsStreak >= 6 ? (
                    <><MdEmojiEvents style={{ fontSize: '2rem', color: '#F4B942', flexShrink: 0 }} /> Outstanding consistency!</>
                  ) : savingsStreak >= 3 ? (
                    <><MdLocalFireDepartment style={{ fontSize: '2rem', color: '#FB923C', flexShrink: 0 }} /> Building a habit!</>
                  ) : (
                    <><MdCheckCircle style={{ fontSize: '2rem', color: '#1A5C38', flexShrink: 0 }} /> Good start!</>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: savingsStreak >= 3 ? 'rgba(255,255,255,0.7)' : '#64748B', marginTop: '0.2rem' }}>
                  You have saved every month for {savingsStreak} month{savingsStreak !== 1 ? 's' : ''} in a row
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: savingsStreak >= 3 ? '#F4B942' : '#0A2E1A', lineHeight: 1 }}>
                  {savingsStreak}
                </div>
                <div style={{ fontSize: '0.75rem', color: savingsStreak >= 3 ? 'rgba(255,255,255,0.6)' : '#64748B', fontWeight: 600 }}>
                  month streak
                </div>
              </div>
            </div>
          )}

          {/* New goal form */}
          {showNewGoalForm && (
            <div className="card mb-3">
              <div className="section-title">New Savings Goal</div>
              {goalFormError && <div className="error-msg mb-2">{goalFormError}</div>}
              <form onSubmit={handleCreateGoal}>
                <div className="form-group">
                  <label className="form-label">Goal Name</label>
                  <input className="form-input" placeholder="e.g. New Laptop, Emergency Fund, Trip Home" value={newGoalForm.goal_name} onChange={e => setNewGoalForm({ ...newGoalForm, goal_name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Target Amount (₵)</label>
                  <input className="form-input" type="number" min="1" placeholder="e.g. 1200" value={newGoalForm.target_amount} onChange={e => setNewGoalForm({ ...newGoalForm, target_amount: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline (optional)</label>
                  <input className="form-input" type="date" value={newGoalForm.deadline} onChange={e => setNewGoalForm({ ...newGoalForm, deadline: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={creatingGoal}>{creatingGoal ? 'Saving...' : 'Create Goal'}</button>
                  <button type="button" className="btn btn-outline" onClick={() => { setShowNewGoalForm(false); setGoalFormError(''); }}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* No goals yet */}
          {goals.length === 0 && !showNewGoalForm && (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', fontSize: '3rem' }}><MdTrackChanges /></div>
                <p style={{ marginBottom: '1rem' }}>You haven't set a savings goal yet</p>
                <button className="btn btn-primary" onClick={() => setShowNewGoalForm(true)}>
                  <MdAdd /> Create Savings Goal
                </button>
              </div>
            </div>
          )}

          {/* Goal cards */}
          {goals.map(goal => {
            const percent = goal.target_amount > 0
              ? Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100))
              : 0;
            const proj = goal.projection;
            const ui = getDepositUI(goal.id);

            return (
              <div key={goal.id} className="card mb-3">
                <div className="flex-between mb-2">
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0A2E1A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <MdEmojiEvents style={{ color: '#F4B942', fontSize: '1.6rem', flexShrink: 0 }} />
                      {goal.goal_name}
                    </div>
                    {goal.deadline && <div className="text-muted text-sm">Target deadline: {goal.deadline}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1A5C38' }}>
                      ₵{Number(goal.saved_amount).toFixed(2)}
                    </div>
                    <div className="text-muted text-sm">of ₵{Number(goal.target_amount).toFixed(2)}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="progress-bar-wrap" style={{ height: 16, marginBottom: '0.5rem' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 99,
                      width: `${percent}%`,
                      background: percent >= 100 ? '#F4B942' : percent >= 75 ? '#1A5C38' : percent >= 50 ? '#2d8a57' : '#64748B',
                      transition: 'width 0.8s ease',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 0, left: '-100%', right: 0, bottom: 0,
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                      animation: 'shimmer 2s infinite',
                    }} />
                  </div>
                </div>

                {/* Milestone markers */}
                <div style={{ position: 'relative', height: 20, marginBottom: '0.75rem' }}>
                  {MILESTONES.map(m => (
                    <div key={m} style={{ position: 'absolute', left: `${m}%`, transform: 'translateX(-50%)', textAlign: 'center' }}>
                      <div style={{ width: 2, height: 8, background: percent >= m ? '#F4B942' : '#CBD5E1', margin: '0 auto 2px' }} />
                      <div style={{ fontSize: '0.65rem', color: percent >= m ? '#F4B942' : '#94a3b8', fontWeight: 700 }}>{m}%</div>
                    </div>
                  ))}
                </div>

                <div className="flex-between mt-1">
                  <span className="text-muted text-sm">{percent}% complete</span>
                  <span className="text-muted text-sm">₵{(Number(goal.target_amount) - Number(goal.saved_amount)).toFixed(2)} remaining</span>
                </div>

                {percent >= 100 && (
                  <div style={{ marginTop: '1rem', background: '#E8F5EE', borderRadius: 8, padding: '0.75rem 1rem', color: '#1A5C38', fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <MdEmojiEvents style={{ fontSize: '1.6rem', color: '#F4B942', flexShrink: 0 }} />
                    <span>Congratulations! You've reached your goal!</span>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => toggleDepositForm(goal.id)}>
                    <MdAdd /> Log Deposit
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleDeleteGoal(goal)}
                    style={{ color: '#dc2626', borderColor: '#fecaca' }}
                  >
                    <MdDelete /> Delete Goal
                  </button>
                </div>

                {/* Deposit form */}
                {ui.open && (
                  <form onSubmit={(e) => handleDeposit(e, goal)} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #E2E8E4' }}>
                    {ui.error && <div className="error-msg mb-2">{ui.error}</div>}
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Amount (₵)</label>
                        <input
                          className="form-input"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="0.00"
                          value={ui.amount}
                          onChange={e => updateDepositField(goal.id, 'amount', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Date</label>
                        <input
                          className="form-input"
                          type="date"
                          max={todayStr()}
                          value={ui.date}
                          onChange={e => updateDepositField(goal.id, 'date', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button type="submit" className="btn btn-primary" disabled={ui.submitting}>
                        {ui.submitting ? 'Saving...' : 'Log Deposit'}
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => toggleDepositForm(goal.id)}>Cancel</button>
                    </div>
                  </form>
                )}

                {/* Projection */}
                {proj && (
                  <div style={{
                    background: 'linear-gradient(135deg, #0A2E1A, #1A5C38)',
                    borderRadius: 12,
                    padding: '1.5rem',
                    marginTop: '1.5rem',
                    color: '#fff',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#F4B942', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <MdTrendingUp style={{ fontSize: '1.4rem' }} /> Savings Projection
                    </div>

                    {proj.avg_monthly_deposit > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.2rem' }}>Avg Monthly Deposit</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F4B942' }}>₵{proj.avg_monthly_deposit.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.2rem' }}>Still Need to Save</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>₵{proj.remaining_amount.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.2rem' }}>Months at Current Rate</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                            {proj.months_needed !== null ? `${proj.months_needed} months` : '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.2rem' }}>Projected Completion</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: proj.completion_date === 'Goal reached!' ? '#F4B942' : '#fff' }}>
                            {proj.completion_date || '—'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                        Log your first deposit to see a projection of when you'll reach this goal at your current saving rate.
                      </div>
                    )}

                    {proj.deadline_warning && (
                      <div style={{ marginTop: '1rem', background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#fca5a5', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <MdWarning style={{ fontSize: '1.4rem', flexShrink: 0 }} />
                        <span>{proj.deadline_warning}</span>
                      </div>
                    )}

                    {proj.on_track && proj.completion_date && proj.completion_date !== 'Goal reached!' && !proj.deadline_warning && (
                      <div style={{ marginTop: '1rem', background: 'rgba(244,185,66,0.15)', border: '1px solid rgba(244,185,66,0.3)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#F4B942', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <MdCheckCircle style={{ fontSize: '1.4rem', flexShrink: 0 }} />
                        <span>You are on track to reach this goal by {proj.completion_date}. Keep saving consistently!</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Deposit history */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #E2E8E4' }}>
                  <div className="section-title">Deposit History</div>
                  {(!goal.deposits || goal.deposits.length === 0) ? (
                    <div className="empty-state">
                      <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', fontSize: '3rem' }}><MdSavings /></div>
                      <p>No deposits yet. Log your first one!</p>
                    </div>
                  ) : (
                    goal.deposits.map(d => (
                      <div key={d.id} className="expense-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="expense-category-icon"><MdSavings style={{ fontSize: '1.4rem' }} /></div>
                          <div style={{ fontWeight: 600 }}>Savings Deposit</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#1A5C38' }}>+₵{Number(d.amount).toFixed(2)}</div>
                          <div className="text-muted text-sm">{d.date}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default Savings;