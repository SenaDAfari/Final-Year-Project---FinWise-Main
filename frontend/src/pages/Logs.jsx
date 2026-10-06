import React, { useState, useEffect, useCallback } from 'react';
import {
  MdDelete, MdAdd, MdHistory, MdSavings, MdSearch, MdPayments,
  MdRestaurant, MdDirectionsBus, MdSmartphone, MdHome, MdCelebration,
  MdPrint, MdCategory
} from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

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
  'Chop Money / Feeding', 'Transport / Trotro', 'Mobile Data',
  'Accommodation', 'Social / Entertainment', 'Printing / Stationery', 'Miscellaneous'
];

const todayStr = () => new Date().toISOString().split('T')[0];

// Groups a flat, already-filtered/sorted entry list into month buckets,
// keyed "YYYY-MM" and kept in the same newest-first order as the input.
const groupByMonth = (entries) => {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return Array.from(groups.entries()).map(([key, items]) => {
    const [year, month] = key.split('-').map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' });
    const expenseTotal = items.filter(i => i.type === 'expense').reduce((s, i) => s + Number(i.amount), 0);
    const savingsTotal = items.filter(i => i.type === 'saving').reduce((s, i) => s + Number(i.amount), 0);
    return { key, label, items, expenseTotal, savingsTotal };
  });
};

const Logs = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', category: '', date: todayStr(), note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const userCategories = user?.categories?.length ? user.categories : DEFAULT_CATEGORIES;

  const buildParams = useCallback(() => {
    const params = {};
    if (type) params.type = type;
    if (category) params.category = category;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (search.trim()) params.search = search.trim();
    return params;
  }, [type, category, startDate, endDate, search]);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    setError('');
    const params = buildParams();
    Promise.all([
      api.get('/logs', { params }),
      api.get('/logs/summary', { params }),
    ])
      .then(([logsRes, summaryRes]) => {
        setEntries(logsRes.data);
        setSummary(summaryRes.data);
      })
      .catch(() => setError('Could not load your history. Please try again.'))
      .finally(() => setLoading(false));
  }, [buildParams]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleDelete = async (entry) => {
    const confirmMsg = entry.type === 'saving'
      ? `Delete this ₵${Number(entry.amount).toFixed(2)} deposit toward "${entry.goal_name}"? This will reverse it from that goal's saved amount.`
      : `Delete this ₵${Number(entry.amount).toFixed(2)} expense?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.delete(`/logs/${entry.type}/${entry.id}`);
      fetchLogs();
    } catch {
      setError('Could not delete that entry. Please try again.');
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.category) return setFormError('Amount and category are required');
    setSubmitting(true);
    setFormError('');
    try {
      await api.post('/expenses', form);
      setForm({ amount: '', category: '', date: todayStr(), note: '' });
      setShowForm(false);
      fetchLogs();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to add expense');
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setType(''); setCategory(''); setStartDate(''); setEndDate(''); setSearch('');
  };
  const filtersActive = type || category || startDate || endDate || search.trim();

  const monthGroups = groupByMonth(entries);

  if (loading && entries.length === 0) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h1 className="page-title">Logs</h1>
          <p className="page-subtitle">Your full expense and savings history in one place</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <MdAdd /> Log Expense
        </button>
      </div>

      {error && <div className="error-msg mb-2">{error}</div>}

      {showForm && (
        <div className="card mb-3">
          <div className="section-title">New Expense</div>
          {formError && <div className="error-msg">{formError}</div>}
          <form onSubmit={handleAdd}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount (₵)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })} required>
                  <option value="">Select category</option>
                  {userCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" max={todayStr()}
                  value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input className="form-input" placeholder="What was this for?"
                  value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add Expense'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setFormError(''); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary strip */}
      {summary && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Total Expenses</div>
            <div className="stat-value">₵{summary.total_expense_amount.toFixed(2)}</div>
            <div className="text-muted text-sm">{summary.expense_count} entries</div>
          </div>
          <div className="stat-card gold-border">
            <div className="stat-label">Total Saved</div>
            <div className="stat-value">₵{summary.total_savings_amount.toFixed(2)}</div>
            <div className="text-muted text-sm">{summary.savings_count} deposits</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Entries</div>
            <div className="stat-value">{summary.total_count}</div>
            <div className="text-muted text-sm">{filtersActive ? 'matching your filters' : 'all time'}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-3" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div style={{ flex: 2, minWidth: 180, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <MdSearch style={{ position: 'absolute', left: 12, color: '#94a3b8', pointerEvents: 'none' }} />
            <input className="form-input" style={{ width: '100%', paddingLeft: '2.25rem' }}
              placeholder="Search notes, goals, categories..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ flex: 1, minWidth: 140 }} value={type} onChange={e => setType(e.target.value)}>
            <option value="">All types</option>
            <option value="expense">Expenses only</option>
            <option value="saving">Savings only</option>
          </select>
          <select className="form-select" style={{ flex: 1, minWidth: 160 }} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label className="text-muted text-sm">From</label>
            <input className="form-input" type="date" max={endDate || todayStr()} value={startDate}
              onChange={e => setStartDate(e.target.value)} style={{ width: 150 }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label className="text-muted text-sm">To</label>
            <input className="form-input" type="date" min={startDate} max={todayStr()} value={endDate}
              onChange={e => setEndDate(e.target.value)} style={{ width: 150 }} />
          </div>
          {filtersActive && (
            <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      </div>

      {/* Month groups */}
      {monthGroups.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}><MdHistory /></div>
            <p>{filtersActive ? 'No entries match your filters.' : 'No history yet. Log an expense or a savings deposit to see it here.'}</p>
          </div>
        </div>
      ) : (
        monthGroups.map(group => (
          <div key={group.key} className="card mb-2">
            <div className="flex-between mb-2">
              <div className="section-title" style={{ marginBottom: 0 }}>{group.label}</div>
              <div className="text-muted text-sm">
                {group.expenseTotal > 0 && <span>-₵{group.expenseTotal.toFixed(2)} spent</span>}
                {group.expenseTotal > 0 && group.savingsTotal > 0 && <span> &middot; </span>}
                {group.savingsTotal > 0 && <span>+₵{group.savingsTotal.toFixed(2)} saved</span>}
              </div>
            </div>
            {group.items.map(entry => (
              <div key={`${entry.type}-${entry.id}`} className="expense-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="expense-category-icon" style={{ display: 'flex' }}>
                    {entry.type === 'saving'
                      ? <MdSavings />
                      : React.createElement(CATEGORY_ICONS[entry.category] || MdPayments)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {entry.type === 'saving' ? `Savings · ${entry.goal_name}` : entry.category}
                    </div>
                    {entry.note && <div className="text-muted text-sm">{entry.note}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: entry.type === 'saving' ? 'var(--status-good)' : 'var(--status-critical)' }}>
                      {entry.type === 'saving' ? '+' : '-'}₵{Number(entry.amount).toFixed(2)}
                    </div>
                    <div className="text-muted text-sm">{entry.date}</div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(entry)} aria-label="Delete entry">
                    <MdDelete />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export default Logs;