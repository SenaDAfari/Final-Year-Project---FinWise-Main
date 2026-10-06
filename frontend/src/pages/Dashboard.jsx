// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  MdToday, MdWarning, MdLocalFireDepartment, MdStar, MdCheckCircle,
  MdBarChart, MdSavings, MdBalance, MdTrendingUp, MdLightbulb, MdPieChart,
  MdRestaurant, MdDirectionsBus, MdSmartphone, MdHome, MdCelebration,
  MdPrint, MdCategory, MdPayments
} from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

// Shared status colours (defined once in index.css)
const STATUS_COLOR = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-critical)',
};

const COLORS = ['#0A2E1A', '#1A5C38', '#F4B942', '#2d8a57', '#e6a82e', '#4caf80', '#c9992a'];

const CATEGORY_ICONS = {
  'Chop Money / Feeding': MdRestaurant,
  'Transport / Trotro': MdDirectionsBus,
  'Mobile Data': MdSmartphone,
  'Accommodation': MdHome,
  'Social / Entertainment': MdCelebration,
  'Printing / Stationery': MdPrint,
  'Miscellaneous': MdCategory,
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [tip, setTip] = useState('');
  const [tipLoading, setTipLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [healthScore, setHealthScore] = useState(null);

  const firstName = user?.full_name?.split(' ')[0] || 'Student';

  useEffect(() => {
    let isMounted = true;

    api.get('/dashboard')
      .then(res => {
        if (isMounted) setData(res.data);
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    api.post('/ai/tip')
      .then(res => {
        if (isMounted) setTip(res.data.tip);
      })
      .catch(() => {
        if (isMounted) setTip('Keep tracking your expenses to stay on top of your budget!');
      })
      .finally(() => {
        if (isMounted) setTipLoading(false);
      });

    api.get('/health-score')
      .then(res => {
        if (isMounted) setHealthScore(res.data);
      })
      .catch(console.error);

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  const monthly_budget = Number(data?.monthly_budget || 0);
  const totalExp = Number(data?.total_expenses || 0);
  const remaining = Number(data?.remaining_balance || 0);
  const percentUsed = Number(data?.percent_used || 0);
  const survivalMode = data?.survival_mode || false;
  const dailyBudget = Number(data?.daily_budget || 0);
  const daysLeft = Number(data?.days_left || 0);
  const daysUntilBroke = Number(data?.days_until_broke || 0);
  const streak = Number(data?.streak || 0);
  const nextPayday = data?.next_payday || null;
  const recentExpenses = (data?.recent_transactions || []).slice(0, 2);
  const recentSavings = (data?.recent_savings || []).slice(0, 2);

  const pieData = Object.entries(data?.category_breakdown || {}).map(([name, value]) => ({
    name,
    value: Number(value)
  }));
  // Every savings goal (older servers only send the single `savings_goal`)
  const savingsGoals = data?.savings_goals || (data?.savings_goal ? [data.savings_goal] : []);
  const goalPercentOf = (g) =>
    g && Number(g.target_amount) > 0
      ? Math.min(100, Math.round((Number(g.saved_amount) / Number(g.target_amount)) * 100))
      : 0;

  // Dynamic countdown text helper
  const countdownLabel = nextPayday
    ? `${daysLeft} days left (until ${nextPayday})`
    : data?.allowance_frequency === 'Per Semester'
    ? `${daysLeft} days left this semester`
    : `${daysLeft} days left this month`;

  return (
    <div>
      {/* Survival Mode Banner */}
      {survivalMode && (
        <div
          style={{
            background: STATUS_COLOR.critical,
            borderRadius: 12,
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            color: '#fff',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '1.8rem', display: 'flex' }}><MdWarning /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.2rem' }}>
              Survival Mode Active
            </div>
            <div style={{ fontSize: '0.88rem', opacity: 0.9 }}>
              You have only ₵{remaining.toFixed(2)} left for {daysLeft} more days. Stick to ₵{dailyBudget.toFixed(2)} per day on essentials only.
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">{getGreeting()}, {firstName}!</h1>
        <p className="page-subtitle">
          {new Date().toLocaleDateString('en-GH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Monthly Budget</div>
          <div className="stat-value">₵{monthly_budget.toFixed(2)}</div>
          {data?.allowance_frequency === 'Per Semester' && (
            <div className="text-muted text-sm">Split from semester allowance</div>
          )}
        </div>
        <div className="stat-card gold-border">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value">₵{totalExp.toFixed(2)}</div>
          <div className="text-muted text-sm">{percentUsed}% of budget used</div>
        </div>
        <div className={`stat-card ${survivalMode ? 'danger-border' : ''}`}>
          <div className="stat-label">Remaining</div>
          <div className={`stat-value ${survivalMode ? 'danger' : ''}`}>
            ₵{remaining.toFixed(2)}
          </div>
          <div className="text-muted text-sm">{countdownLabel}</div>
        </div>
      </div>

      {/* Spending Streak */}
      {streak > 0 && (
        <div
          style={{
            background: streak >= 7 ? 'linear-gradient(135deg, #0A2E1A, #1A5C38)' : '#fff',
            border: streak >= 7 ? 'none' : '1px solid #E2E8E4',
            borderRadius: 12,
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 12px rgba(10,46,26,0.08)'
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: streak >= 7 ? '#F4B942' : '#1A5C38',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '0.2rem'
              }}
            >
              Daily Budget Streak
            </div>
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: streak >= 7 ? '#fff' : '#0A2E1A'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {streak >= 7 ? <MdLocalFireDepartment /> : streak >= 3 ? <MdStar /> : <MdCheckCircle />}
                {streak >= 7 ? 'On fire! Keep it up!' : streak >= 3 ? 'Great consistency!' : 'Good start!'}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.82rem',
                color: streak >= 7 ? 'rgba(255,255,255,0.7)' : '#64748B',
                marginTop: '0.2rem'
              }}
            >
              You have stayed within your daily budget for {streak} day{streak !== 1 ? 's' : ''} in a row
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: streak >= 7 ? '#F4B942' : '#0A2E1A',
                lineHeight: 1
              }}
            >
              {streak}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: streak >= 7 ? 'rgba(255,255,255,0.6)' : '#64748B',
                fontWeight: 600
              }}
            >
              day streak
            </div>
          </div>
        </div>
      )}

      {/* Financial Health Score */}
      {healthScore && (
        <div className="card mb-3">
          <div className="flex-between">
            <div>
              <div className="section-title" style={{ marginBottom: '0.25rem' }}>
                Financial Health Score
              </div>
              <div className="text-muted text-sm">Based on your spending behaviour this month</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  color: STATUS_COLOR[healthScore.status] || STATUS_COLOR.critical,
                  lineHeight: 1
                }}
              >
                {healthScore.score}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>out of 100</div>
            </div>
          </div>

          <div className="divider" />

          <div className="progress-bar-wrap" style={{ height: 14, marginBottom: '0.75rem' }}>
            <div
              className="progress-bar-fill"
              style={{
                width: `${healthScore.score}%`,
                background: STATUS_COLOR[healthScore.status] || STATUS_COLOR.critical,
                transition: 'width 1s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              className={`badge ${
                healthScore.status === 'good'
                  ? 'badge-green'
                  : healthScore.status === 'warning'
                  ? 'badge-gold'
                  : 'badge-red'
              }`}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                {healthScore.status === 'good' ? <MdCheckCircle /> : healthScore.status === 'warning' ? <MdWarning /> : <MdWarning />}
                {healthScore.label}
              </span>
            </span>
            <span className="text-muted text-sm">{healthScore.reason}</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.5rem',
              marginTop: '1rem'
            }}
          >
            {[
              { label: 'Budget', points: 40, icon: MdBarChart },
              { label: 'Savings', points: 30, icon: MdSavings },
              { label: 'Balance', points: 20, icon: MdBalance },
              { label: 'Trend', points: 10, icon: MdTrendingUp },
            ].map((f) => (
              <div
                key={f.label}
                style={{
                  background: '#F7F9F7',
                  borderRadius: 8,
                  padding: '0.6rem',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '1.2rem', display: 'flex', justifyContent: 'center' }}><f.icon /></div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#0A2E1A',
                    marginTop: '0.2rem'
                  }}
                >
                  {f.label}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{f.points} pts</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget progress bar */}
      <div className="card mb-3">
        <div className="flex-between mb-1">
          <span className="text-sm fw-bold">Monthly Budget Used</span>
          <span className="text-sm fw-bold">{percentUsed}%</span>
        </div>
        <div className="progress-bar-wrap" style={{ height: 12 }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${Math.min(100, percentUsed)}%`,
              background: percentUsed > 80 ? STATUS_COLOR.critical : percentUsed > 60 ? STATUS_COLOR.warning : STATUS_COLOR.good
            }}
          />
        </div>
        <div className="flex-between mt-1">
          <span className="text-muted text-sm">₵{totalExp.toFixed(2)} spent</span>
          <span className="text-muted text-sm">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              {totalExp > 0 && daysUntilBroke > 0 && daysUntilBroke < daysLeft ? <MdWarning /> : <MdCheckCircle />}
              {totalExp > 0 && daysUntilBroke > 0 && daysUntilBroke < daysLeft
                ? `At this rate, funds run out in ${Math.round(daysUntilBroke)} days`
                : `On track for the period`}
            </span>
          </span>
        </div>
      </div>

      {/* Daily budget card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0A2E1A, #1A5C38)',
          borderRadius: 12,
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#F4B942',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            Recommended Daily Budget
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.2rem' }}>
            ₵{dailyBudget.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            to last the remaining {daysLeft} days {nextPayday ? `(until ${nextPayday})` : ''}
          </div>
        </div>
        <div style={{ fontSize: '2rem', opacity: 0.85, display: 'flex' }}>
          <MdToday />
        </div>
      </div>

      {/* AI Tip */}
      <div className="ai-tip-card mb-3">
        <div className="ai-tip-icon" style={{ display: 'flex' }}><MdLightbulb /></div>
        <div>
          <div className="ai-tip-label">AI Financial Tip</div>
          <div className="ai-tip-text">
            {tipLoading ? 'Analyzing your spending...' : tip}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Chart */}
        <div className="card">
          <div className="section-title">Spending by Category</div>
          {pieData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}><MdPieChart /></div>
              <p>No expenses logged yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `₵${Number(v).toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Savings Goals */}
        <div className="card">
          <div className="section-title">{savingsGoals.length > 1 ? 'Savings Goals' : 'Savings Goal'}</div>
          {savingsGoals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}><MdSavings /></div>
              <p>No savings goal yet</p>
            </div>
          ) : (
            <>
              {savingsGoals.slice(0, 3).map((g, idx) => {
                const pct = goalPercentOf(g);
                return (
                  <div key={g.id ?? idx} style={{ marginTop: idx === 0 ? 0 : '1.25rem' }}>
                    <div
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#0A2E1A',
                        marginBottom: '0.3rem'
                      }}
                    >
                      {g.goal_name}
                    </div>
                    <div className="flex-between mb-1">
                      <span className="text-muted text-sm">
                        ₵{Number(g.saved_amount).toFixed(2)} saved
                      </span>
                      <span className="text-sm fw-bold">
                        ₵{Number(g.target_amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="progress-bar-wrap">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex-between mt-1">
                      <span className="text-muted text-sm">{pct}% complete</span>
                      {g.deadline && (
                        <span className="text-muted text-sm">Due: {g.deadline}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {savingsGoals.length > 3 && (
                <Link to="/savings" className="activity-link">View all {savingsGoals.length} goals &rarr;</Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Recent Activity: latest two expenses and latest two savings deposits */}
      <div className="card mt-3">
        <div className="section-title">Recent Activity</div>
        {recentExpenses.length === 0 && recentSavings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}><MdPayments /></div>
            <p>No activity yet. Log an expense or a savings deposit to get started!</p>
          </div>
        ) : (
          <div className="activity-grid">
            <div>
              <div className="activity-col-title"><MdPayments /> Expenses</div>
              {recentExpenses.length === 0 ? (
                <p className="text-muted text-sm" style={{ padding: '0.85rem 0' }}>No expenses yet.</p>
              ) : (
                recentExpenses.map((t) => (
                  <div key={`expense-${t.id}`} className="expense-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="expense-category-icon" style={{ display: 'flex' }}>
                        {React.createElement(CATEGORY_ICONS[t.category] || MdPayments)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.category}</div>
                        {t.note && <div className="text-muted text-sm">{t.note}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: STATUS_COLOR.critical }}>
                        -₵{Number(t.amount).toFixed(2)}
                      </div>
                      <div className="text-muted text-sm">{t.date}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div>
              <div className="activity-col-title"><MdSavings /> Savings</div>
              {recentSavings.length === 0 ? (
                <p className="text-muted text-sm" style={{ padding: '0.85rem 0' }}>No savings deposits yet.</p>
              ) : (
                recentSavings.map((s) => (
                  <div key={`saving-${s.id}`} className="expense-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="expense-category-icon" style={{ display: 'flex' }}><MdSavings /></div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Savings · {s.goal_name}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: STATUS_COLOR.good }}>
                        +₵{Number(s.amount).toFixed(2)}
                      </div>
                      <div className="text-muted text-sm">{s.date}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        <Link to="/logs" className="activity-link">View full history &rarr;</Link>
      </div>
    </div>
  );
};

export default Dashboard;