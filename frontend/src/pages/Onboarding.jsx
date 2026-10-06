import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  MdPaid, MdLightbulb, MdRestaurant, MdDirectionsBus, MdSmartphone,
  MdHome, MdCelebration, MdPrint, MdCategory
} from 'react-icons/md';

const CATEGORIES = [
  { id: 'Chop Money / Feeding', Icon: MdRestaurant, label: 'Chop Money / Feeding' },
  { id: 'Transport / Trotro', Icon: MdDirectionsBus, label: 'Transport / Trotro' },
  { id: 'Mobile Data', Icon: MdSmartphone, label: 'Mobile Data' },
  { id: 'Accommodation', Icon: MdHome, label: 'Accommodation' },
  { id: 'Social / Entertainment', Icon: MdCelebration, label: 'Social / Entertainment' },
  { id: 'Printing / Stationery', Icon: MdPrint, label: 'Printing / Stationery' },
  { id: 'Miscellaneous', Icon: MdCategory, label: 'Miscellaneous' },
];

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [allowanceAmount, setAllowanceAmount] = useState('');
  const [allowanceFrequency, setAllowanceFrequency] = useState('Monthly');
  const [nextPayday, setNextPayday] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
    const { user, setUser, refreshUser } = useAuth();
  const [semesterMonths, setSemesterMonths] = useState(4);
  const navigate = useNavigate();

  const toggleCategory = (id) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

    const handleFinish = async () => {
    if (!goalName || !targetAmount) return setError('Please fill in your savings goal');
    setError('');
    setLoading(true);
    try {
      await api.post('/onboarding', {
        allowance_amount: allowanceAmount,
        allowance_frequency: allowanceFrequency,
        semester_months: semesterMonths,
        categories: selectedCategories,
        goal_name: goalName,
        target_amount: targetAmount,
        deadline: deadline,
        next_payday: nextPayday || null
      });

      // Onboarding succeeded — refetch the full user object so categories,
      // semester_months, allowance, etc. are all correctly populated
      // without needing a hard refresh (fixes the stale-user bug).
      try {
        await refreshUser();
      } catch {
        // Refetch failed for some transient reason — onboarding itself
        // still succeeded, so don't block navigation. Fall back to the
        // old optimistic merge rather than leaving the user stuck.
        setUser(prev => ({ ...prev, onboarded: true }));
      }
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.error || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };
  
  const firstName = user?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 36, height: 36, background: '#0A2E1A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff' }}><MdPaid /></div>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2E1A' }}>FinWise</span>
        </div>

        {/* Step progress */}
        <div className="onboarding-steps">
          {[1, 2, 3].map(s => (
            <div key={s} className={`onboarding-step-dot ${step > s ? 'done' : step === s ? 'active' : ''}`} />
          ))}
        </div>

        {error && <div className="error-msg">{error}</div>}

        {/* Step 1 - Allowance */}
        {step === 1 && (
          <>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0A2E1A', marginBottom: '0.3rem' }}>
              Welcome, {firstName}!
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Let's set up your allowance
            </p>

            <div className="form-group">
              <label className="form-label">Allowance Amount (₵)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 500"
                value={allowanceAmount}
                onChange={e => setAllowanceAmount(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">How often do you receive it?</label>
              <select className="form-select" value={allowanceFrequency} onChange={e => setAllowanceFrequency(e.target.value)}>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Per Semester">Per Semester (lump sum)</option>
              </select>
            </div>

            {allowanceFrequency === 'Per Semester' && (
              <div className="form-group">
                <label className="form-label">How many months does this cover?</label>
                <select className="form-select" value={semesterMonths} onChange={e => setSemesterMonths(e.target.value)}>
                  <option value="3">3 months</option>
                  <option value="4">4 months</option>
                  <option value="5">5 months</option>
                  <option value="6">6 months</option>
                </select>
                <span className="text-muted text-sm" style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <MdLightbulb style={{ flexShrink: 0 }} />
                  Your allowance will be split into ₵{allowanceAmount ? (allowanceAmount / semesterMonths).toFixed(2) : '0.00'} per month
                </span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">When do you next expect it? (optional)</label>
              <input
                className="form-input"
                type="date"
                value={nextPayday}
                onChange={e => setNextPayday(e.target.value)}
              />
              <span className="text-muted text-sm" style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
                <MdLightbulb style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                <span>Leave this blank and FinWise will assume your allowance resets at the start of each calendar month.
                Set a date and it will count down to that day instead, and roll forward automatically after each one.</span>
              </span>
            </div>

            <button
              className="btn btn-gold btn-full"
              style={{ marginTop: '0.5rem', padding: '0.8rem' }}
              onClick={() => {
                if (!allowanceAmount) return setError('Please enter your allowance amount');
                setError('');
                setStep(2);
              }}
            >
              Next →
            </button>
          </>
        )}

        {/* Step 2 - Categories */}
        {step === 2 && (
          <>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0A2E1A', marginBottom: '0.3rem' }}>
              What do you spend on?
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Select all that apply to you
            </p>

            <div className="category-grid">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`category-chip ${selectedCategories.includes(cat.id) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <cat.Icon />
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setError(''); setStep(1); }}>← Back</button>
              <button
                className="btn btn-gold"
                style={{ flex: 2, padding: '0.8rem' }}
                onClick={() => {
                  if (selectedCategories.length === 0) return setError('Please select at least one category');
                  setError('');
                  setStep(3);
                }}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 3 - Savings Goal */}
        {step === 3 && (
          <>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0A2E1A', marginBottom: '0.3rem' }}>
              Set a savings goal
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              What are you saving towards?
            </p>

            <div className="form-group">
              <label className="form-label">Goal Name</label>
              <input className="form-input" placeholder="e.g. New Laptop, Emergency Fund" value={goalName} onChange={e => setGoalName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Target Amount (₵)</label>
              <input className="form-input" type="number" min="1" placeholder="e.g. 1200" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Deadline (optional)</label>
              <input className="form-input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setError(''); setStep(2); }}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, padding: '0.8rem' }}
                onClick={handleFinish}
                disabled={loading}
              >
                {loading ? 'Setting up...' : "Let's go!"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Onboarding;