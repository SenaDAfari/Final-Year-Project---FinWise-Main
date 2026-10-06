import React, { useState, useEffect, useRef } from 'react';
import {
  MdSave, MdPerson, MdAccountBalance, MdCheckCircle, MdLightbulb,
  MdRestaurant, MdDirectionsBus, MdSmartphone, MdHome, MdCelebration,
  MdPrint, MdCategory
} from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const UNIVERSITIES = [
  'University of Ghana (UG)',
  'Kwame Nkrumah University of Science and Technology (KNUST)',
  'University of Cape Coast (UCC)',
  'Ashesi University',
  'Ghana Institute of Management and Public Administration (GIMPA)',
  'African University College of Communications (AUCC)',
  'Central University',
  'Valley View University',
  'University of Energy and Natural Resources (UENR)',
  'Other',
];

const CATEGORIES = [
  { id: 'Chop Money / Feeding', Icon: MdRestaurant },
  { id: 'Transport / Trotro', Icon: MdDirectionsBus },
  { id: 'Mobile Data', Icon: MdSmartphone },
  { id: 'Accommodation', Icon: MdHome },
  { id: 'Social / Entertainment', Icon: MdCelebration },
  { id: 'Printing / Stationery', Icon: MdPrint },
  { id: 'Miscellaneous', Icon: MdCategory },
];

// How long the "Saving..." state is shown at minimum, so the feedback is
// visible even when the server answers instantly, and how long the
// "Saved" confirmation stays on screen.
const MIN_SAVING_MS = 900;
const SAVED_VISIBLE_MS = 3500;

const Settings = () => {
  const { user, refreshUser } = useAuth();
  // 'idle' | 'saving' | 'saved'
  const [saveStatus, setSaveStatus] = useState('idle');
  const [error, setError] = useState('');
  const savedTimer = useRef(null);

  // Don't leave a timer running if the person navigates away
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  // Income form state
  const [allowanceAmount, setAllowanceAmount] = useState('');
  const [allowanceFrequency, setAllowanceFrequency] = useState('Monthly');
  const [semesterMonths, setSemesterMonths] = useState(4);
  const [nextPayday, setNextPayday] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [university, setUniversity] = useState('');

  useEffect(() => {
    if (user) {
      setAllowanceAmount(user.allowance_amount || '');
      setAllowanceFrequency(user.allowance_frequency || 'Monthly');
      setSemesterMonths(user.semester_months || 4);
      setNextPayday(user.next_payday || '');
      setFullName(user.full_name || '');
      setUniversity(user.university || '');
      setSelectedCategories(
        Array.isArray(user.categories)
          ? user.categories.filter(Boolean)
          : (user.categories || '').split(',').filter(Boolean)
      );
    }
  }, [user]);

  const toggleCategory = (id) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const monthlyPreview = () => {
    if (!allowanceAmount) return null;
    if (allowanceFrequency === 'Per Semester') return (parseFloat(allowanceAmount) / semesterMonths).toFixed(2);
    if (allowanceFrequency === 'Weekly') return (parseFloat(allowanceAmount) * 4).toFixed(2);
    return parseFloat(allowanceAmount).toFixed(2);
  };

  const handleSaveIncome = async (e) => {
    e.preventDefault();
    if (saveStatus === 'saving') return;
    setError('');
    if (!allowanceAmount) return setError('Please enter your allowance amount');
    if (selectedCategories.length === 0) return setError('Please select at least one category');

    clearTimeout(savedTimer.current);
    setSaveStatus('saving');
    const startedAt = Date.now();
    try {
      await api.post('/settings/income', {
        allowance_amount: allowanceAmount,
        allowance_frequency: allowanceFrequency,
        semester_months: semesterMonths,
        categories: selectedCategories,
        next_payday: nextPayday || null,
      });
      try {
        // Pull the full, authoritative user back from the server
        await refreshUser();
      } catch {
        // The save itself succeeded; a failed refresh only means the screen
        // updates on the next page load.
      }
      // Keep the "Saving..." state visible for at least MIN_SAVING_MS
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_SAVING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SAVING_MS - elapsed));
      }
      setSaveStatus('saved');
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), SAVED_VISIBLE_MS);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update income settings');
      setSaveStatus('idle');
    }
  };

  const preview = monthlyPreview();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your income, categories, and profile</p>
      </div>

      {/* Income Settings */}
      <div className="card mb-3">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <div style={{ width: 36, height: 36, background: '#E8F5EE', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MdAccountBalance style={{ color: '#1A5C38', fontSize: '1.2rem' }} />
          </div>
          <div>
            <div className="section-title" style={{ marginBottom: 0 }}>Income & Allowance</div>
            <div className="text-muted text-sm">Update your allowance amount and frequency</div>
          </div>
        </div>

        <form onSubmit={handleSaveIncome}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Allowance Amount (₵)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 800"
                value={allowanceAmount}
                onChange={e => setAllowanceAmount(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">How often do you receive it?</label>
              <select
                className="form-select"
                value={allowanceFrequency}
                onChange={e => setAllowanceFrequency(e.target.value)}
              >
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Per Semester">Per Semester (lump sum)</option>
              </select>
            </div>
          </div>

          {allowanceFrequency === 'Per Semester' && (
            <div className="form-group">
              <label className="form-label">How many months does this cover?</label>
              <select
                className="form-select"
                value={semesterMonths}
                onChange={e => setSemesterMonths(parseInt(e.target.value))}
              >
                <option value={3}>3 months</option>
                <option value={4}>4 months</option>
                <option value={5}>5 months</option>
                <option value={6}>6 months</option>
              </select>
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
              <span>Leave this blank and FinWise assumes your allowance resets at the start of each calendar month.
              Set a date to count down to that day instead; it rolls forward automatically after each one.</span>
            </span>
          </div>

          {preview && (
            <div style={{ background: '#E8F5EE', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', color: '#1A5C38', fontWeight: 600 }}>Your monthly budget will be:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0A2E1A' }}>₵{preview}</span>
            </div>
          )}

          <div className="divider" />

          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ marginBottom: '0.75rem', display: 'block' }}>Spending Categories</label>
            <div className="category-grid">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-chip ${selectedCategories.includes(cat.id) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <cat.Icon />
                  {cat.id}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback sits right next to the button so it is always in view */}
          {error && <div className="error-msg" role="alert">{error}</div>}

          <div className="save-row">
            <button
              type="submit"
              className={`btn btn-primary${saveStatus === 'saving' ? ' btn-saving' : ''}${saveStatus === 'saved' ? ' btn-saved' : ''}`}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? (
                <><span className="btn-spinner" aria-hidden="true" /> Saving...</>
              ) : saveStatus === 'saved' ? (
                <><MdCheckCircle /> Saved</>
              ) : (
                <><MdSave /> Save Income Settings</>
              )}
            </button>
            <div role="status" aria-live="polite">
              {saveStatus === 'saved' && (
                <span className="save-status success">
                  <MdCheckCircle /> Settings saved successfully
                </span>
              )}
            </div>
          </div>

          {saveStatus === 'saving' && (
            <div className="save-progress" aria-hidden="true">
              <div className="save-progress-fill" style={{ animationDuration: `${MIN_SAVING_MS}ms` }} />
            </div>
          )}
        </form>
      </div>

      {/* Profile Info — read only for now */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <div style={{ width: 36, height: 36, background: '#E8F5EE', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MdPerson style={{ color: '#1A5C38', fontSize: '1.2rem' }} />
          </div>
          <div>
            <div className="section-title" style={{ marginBottom: 0 }}>Profile Information</div>
            <div className="text-muted text-sm">Your account details</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#F7F9F7', borderRadius: 8, padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Full Name</div>
            <div style={{ fontWeight: 600, color: '#0A2E1A' }}>{user?.full_name || '—'}</div>
          </div>
          <div style={{ background: '#F7F9F7', borderRadius: 8, padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Email</div>
            <div style={{ fontWeight: 600, color: '#0A2E1A' }}>{user?.email || '—'}</div>
          </div>
          <div style={{ background: '#F7F9F7', borderRadius: 8, padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>University</div>
            <div style={{ fontWeight: 600, color: '#0A2E1A' }}>{user?.university || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;