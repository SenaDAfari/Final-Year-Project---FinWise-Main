// frontend/src/pages/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdPaid } from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';

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

// ── CHANGED: a sentinel value the dropdown can return when the user picks
// "Other". We keep it distinct from any real university name so we can show
// the custom-name input only in that case.
const OTHER_VALUE = '__other__';

const Register = () => {
  const [form, setForm] = useState({ full_name: '', email: '', university: '', customUniversity: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ── CHANGED: resolve the "Other" sentinel to the user's custom text
    // before sending to the backend. Backend accepts any string here.
    const universityValue =
      form.university === OTHER_VALUE ? form.customUniversity.trim() : form.university;

    if (form.university === OTHER_VALUE && !form.customUniversity.trim()) {
      return setError('Please type your university name');
    }
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (!universityValue) return setError('Please select your university');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      await register(form.full_name, form.email, universityValue, form.password);
      navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdPaid /></div>
          <span className="auth-logo-text">FinWise</span>
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Start managing your money smarter</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" name="full_name" placeholder="e.g. Kofi Mensah" value={form.full_name} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">University</label>
            <select className="form-select" name="university" value={form.university} onChange={handleChange} required>
              <option value="">Select your university</option>
              {UNIVERSITIES.map(u => <option key={u} value={u === 'Other' ? OTHER_VALUE : u}>{u}</option>)}
            </select>
          </div>

          {/* ── CHANGED: appears only when "Other" is selected. Backend
              already accepts arbitrary strings for university, so this is
              a pure-frontend addition. ── */}
          {form.university === OTHER_VALUE && (
            <div className="form-group">
              <label className="form-label">Your university name</label>
              <input
                className="form-input"
                name="customUniversity"
                placeholder="e.g. University for Development Studies"
                value={form.customUniversity}
                onChange={handleChange}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" name="password" type="password" placeholder="At least 6 characters" value={form.password} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" name="confirmPassword" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={handleChange} required />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ padding: '0.8rem' }}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-link-text">
          Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;