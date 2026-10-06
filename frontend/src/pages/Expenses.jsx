import React, { useState, useEffect } from 'react';
import {
  MdDelete, MdAdd, MdSearch, MdBolt, MdPayments,
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

const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [form, setForm] = useState({ amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [pageError, setPageError] = useState('');

  const userCategories = user?.categories?.length ? user.categories : DEFAULT_CATEGORIES;

  const fetchExpenses = () => {
    setLoading(true);
    setPageError('');
    api.get('/expenses')
      .then(res => setExpenses(res.data))
      .catch(err => {
        setPageError(err.response?.data?.error || 'Failed to load expenses. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.category) return setError('Amount and category are required');
    setSubmitting(true);
    setWarning('');
    try {
      const res = await api.post('/expenses', form);
      const newExp = { id: res.data.id, ...form, amount: parseFloat(form.amount) };
      setExpenses(prev => [newExp, ...prev]);
      setForm({ amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '' });
      setError('');

      // Show limit warning if backend flagged one
      if (res.data.limit_warning) {
        setWarning(res.data.limit_warning.message);
      } else {
        setShowForm(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    setPageError('');
    try {
      await api.delete(`/expenses/${id}`);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      setPageError(err.response?.data?.error || 'Failed to delete expense. Please try again.');
    }
  };

  const filtered = expenses.filter(e => {
    const matchSearch = !search || e.category.toLowerCase().includes(search.toLowerCase()) || (e.note || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || e.category === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = filtered.reduce((acc, e) => {
    acc[e.date] = acc[e.date] || [];
    acc[e.date].push(e);
    return acc;
  }, {});

  const totalFiltered = filtered.reduce((sum, e) => sum + Number(e.amount), 0);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">{filtered.length} transactions · Total: ₵{totalFiltered.toFixed(2)}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <MdAdd /> Log Expense
        </button>
      </div>

      {pageError && (
        <div className="card mb-3" style={{ borderColor: '#fecaca' }}>
          <div className="error-msg" style={{ marginBottom: '0.5rem' }}>{pageError}</div>
          <button className="btn btn-outline btn-sm" onClick={fetchExpenses}>Retry</button>
        </div>
      )}

      {/* Add expense form */}
      {showForm && (
        <div className="card mb-3">
          <div className="section-title">New Expense</div>
          {error && <div className="error-msg">{error}</div>}
          {warning && (
            <div style={{ background: '#FFF7ED', border: '1px solid #fed7aa', borderRadius: 8, padding: '0.65rem 1rem', color: '#d97706', fontSize: '0.87rem', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MdBolt style={{ flexShrink: 0 }} /> {warning}
            </div>
          )}
          <form onSubmit={handleAdd}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount (₵)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required>
                  <option value="">Select category</option>
                  {userCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" max={new Date().toISOString().split('T')[0]} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input className="form-input" placeholder="What was this for?" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add Expense'}</button>
              <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setError(''); setWarning(''); }}>
                {warning ? 'Done' : 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-3" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <MdSearch style={{ position: 'absolute', left: 12, color: '#94a3b8', pointerEvents: 'none' }} />
            <input className="form-input" style={{ width: '100%', paddingLeft: '2.25rem' }} placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ flex: 1, minWidth: 160 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            {userCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Grouped expense list */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}><MdPayments /></div>
            <p>{expenses.length === 0 ? 'No expenses yet. Log your first one!' : 'No results match your search.'}</p>
          </div>
        </div>
      ) : (
        Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => (
          <div key={date} className="card mb-2">
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-GH', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            {items.map(e => (
              <div key={e.id} className="expense-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="expense-category-icon" style={{ display: 'flex' }}>{React.createElement(CATEGORY_ICONS[e.category] || MdPayments)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.category}</div>
                    {e.note && <div className="text-muted text-sm">{e.note}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#DC2626' }}>-₵{Number(e.amount).toFixed(2)}</div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}><MdDelete /></button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export default Expenses;