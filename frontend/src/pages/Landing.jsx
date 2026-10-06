import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const FEATURES = [
  {
    icon: '🧠',
    title: 'AI Financial Advisor',
    desc: 'Get personalized advice based on your actual spending patterns — not generic tips. Your AI advisor knows your budget, your categories, and your goals.',
  },
  {
    icon: '📊',
    title: 'Smart Budget Splitting',
    desc: 'Receive your allowance per semester? FinWise splits it intelligently into monthly budgets and warns you before you overspend.',
  },
  {
    icon: '🚨',
    title: 'Survival Mode',
    desc: 'When your balance drops critically low, Survival Mode activates — showing your daily spending limit to make it to the end of the month.',
  },
  {
    icon: '🎯',
    title: 'Savings Goals',
    desc: 'Set a target, log deposits, and watch your progress bar fill up. Whether it\'s a laptop, emergency fund, or trip home — FinWise keeps you accountable.',
  },
  {
    icon: '💚',
    title: 'Financial Health Score',
    desc: 'A real-time score out of 100 that reflects how well you\'re managing your money. Budget adherence, savings consistency, spending balance — all in one number.',
  },
  {
    icon: '📈',
    title: 'Spending Predictions',
    desc: 'Know exactly when you\'ll run out of money before it happens. FinWise tracks your daily spending rate and predicts your financial future.',
  },
];

const STEPS = [
  { num: '01', title: 'Create your account', desc: 'Sign up with your university email in under a minute.' },
  { num: '02', title: 'Set up your profile', desc: 'Enter your allowance, spending categories, and savings goal.' },
  { num: '03', title: 'Track and get advised', desc: 'Log expenses and let the AI guide your financial decisions.' },
];

const LandingPage = () => {
  const [scrolled, setScrolled] = useState(false);
  const [visibleSections, setVisibleSections] = useState(new Set());
  const sectionRefs = useRef({});

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => new Set([...prev, entry.target.dataset.section]));
          }
        });
      },
      { threshold: 0.15 }
    );
    Object.values(sectionRefs.current).forEach(ref => ref && observer.observe(ref));
    return () => observer.disconnect();
  }, []);

  const setRef = (key) => (el) => { sectionRefs.current[key] = el; };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#F7F9F7', color: '#1A1A1A', overflowX: 'hidden' }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: '1rem 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 36, height: 36, background: '#0A2E1A', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💰</div>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2E1A', letterSpacing: '-0.5px' }}>FinWise</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link to="/login" style={{ padding: '0.55rem 1.1rem', borderRadius: 8, border: '1.5px solid #0A2E1A', color: '#0A2E1A', fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none', transition: 'all 0.2s' }}>
            Sign In
          </Link>
          <Link to="/register" style={{ padding: '0.55rem 1.25rem', borderRadius: 8, background: '#0A2E1A', color: '#F4B942', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none', transition: 'all 0.2s' }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 55%, #0A2E1A 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6rem 2rem 4rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'rgba(244,185,66,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 600, height: 600, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 800, textAlign: 'center', position: 'relative' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(244,185,66,0.15)', border: '1px solid rgba(244,185,66,0.3)', borderRadius: 99, padding: '0.4rem 1rem', marginBottom: '1.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#F4B942', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Built for Ghanaian Students</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.1,
            letterSpacing: '-2px',
            marginBottom: '1.5rem',
          }}>
            Stop Running Out of<br />
            <span style={{ color: '#F4B942' }}>Money Before Month-End</span>
          </h1>

          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'rgba(255,255,255,0.75)', maxWidth: 580, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            FinWise is an AI-powered financial advisor built specifically for university students in Ghana. Track spending, split your allowance smartly, and get personalized advice — all in one place.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" style={{
              padding: '0.9rem 2rem',
              borderRadius: 10,
              background: '#F4B942',
              color: '#0A2E1A',
              fontWeight: 800,
              fontSize: '1rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              boxShadow: '0 8px 24px rgba(244,185,66,0.3)',
            }}>
              Start for Free →
            </Link>
            <Link to="/login" style={{
              padding: '0.9rem 2rem',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.1)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '1rem',
              textDecoration: 'none',
              border: '1.5px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s',
            }}>
              Sign In
            </Link>
          </div>

          {/* Trust badges */}
          <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            {['🎓 University Students', '🇬🇭 Built for Ghana', '🤖 AI-Powered', '🔒 Secure'].map(badge => (
              <div key={badge} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', fontWeight: 600 }}>{badge}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM SECTION ── */}
      <section
        data-section="problem"
        ref={setRef('problem')}
        style={{
          padding: '6rem 2rem',
          maxWidth: 900,
          margin: '0 auto',
          opacity: visibleSections.has('problem') ? 1 : 0,
          transform: visibleSections.has('problem') ? 'translateY(0)' : 'translateY(40px)',
          transition: 'all 0.7s ease',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A5C38', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.75rem' }}>The Problem</div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#0A2E1A', letterSpacing: '-1px', lineHeight: 1.2 }}>
            Sound familiar?
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {[
            { emoji: '😰', text: '"I check my MoMo balance and wonder where it all went"' },
            { emoji: '📅', text: '"I always run out of money before the end of the month"' },
            { emoji: '🤷', text: '"I don\'t know how much I should be spending each day"' },
            { emoji: '💸', text: '"I got my semester allowance and spent it in two months"' },
            { emoji: '😟', text: '"Financial stress is affecting my studies"' },
            { emoji: '🏦', text: '"Professional financial advisors are too expensive for me"' },
          ].map((item, i) => (
            <div key={i} style={{
              background: '#fff',
              borderRadius: 12,
              padding: '1.25rem 1.5rem',
              border: '1px solid #E2E8E4',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: '0 2px 12px rgba(10,46,26,0.06)',
            }}>
              <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{item.emoji}</span>
              <span style={{ fontSize: '0.9rem', color: '#444', lineHeight: 1.5, fontStyle: 'italic' }}>{item.text}</span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0A2E1A' }}>FinWise was built to solve all of this. 👇</div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        data-section="features"
        ref={setRef('features')}
        style={{
          padding: '6rem 2rem',
          background: '#0A2E1A',
          opacity: visibleSections.has('features') ? 1 : 0,
          transform: visibleSections.has('features') ? 'translateY(0)' : 'translateY(40px)',
          transition: 'all 0.7s ease',
        }}
      >
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F4B942', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.75rem' }}>Features</div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-1px' }}>
              Everything you need to<br />manage your money
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: '1.75rem',
                transition: 'all 0.3s',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{f.icon}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem' }}>{f.title}</div>
                <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        data-section="how"
        ref={setRef('how')}
        style={{
          padding: '6rem 2rem',
          maxWidth: 800,
          margin: '0 auto',
          opacity: visibleSections.has('how') ? 1 : 0,
          transform: visibleSections.has('how') ? 'translateY(0)' : 'translateY(40px)',
          transition: 'all 0.7s ease',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A5C38', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.75rem' }}>How It Works</div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#0A2E1A', letterSpacing: '-1px' }}>
            Up and running in minutes
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1.5rem',
              background: '#fff',
              borderRadius: 14,
              padding: '1.75rem',
              border: '1px solid #E2E8E4',
              boxShadow: '0 2px 12px rgba(10,46,26,0.06)',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0A2E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F4B942', fontWeight: 900, fontSize: '1rem', flexShrink: 0 }}>
                {step.num}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0A2E1A', marginBottom: '0.3rem' }}>{step.title}</div>
                <div style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        data-section="cta"
        ref={setRef('cta')}
        style={{
          padding: '7rem 2rem',
          background: 'linear-gradient(135deg, #0A2E1A, #1A5C38)',
          textAlign: 'center',
          opacity: visibleSections.has('cta') ? 1 : 0,
          transform: visibleSections.has('cta') ? 'translateY(0)' : 'translateY(40px)',
          transition: 'all 0.7s ease',
        }}
      >
        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-1.5px', marginBottom: '1rem', lineHeight: 1.1 }}>
          Ready to take control<br />of your money?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', marginBottom: '2.5rem', maxWidth: 500, margin: '0 auto 2.5rem' }}>
          Take control of your student finances with an AI advisor built specifically for you.
        </p>
        <Link to="/register" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '1rem 2.5rem',
          borderRadius: 12,
          background: '#F4B942',
          color: '#0A2E1A',
          fontWeight: 800,
          fontSize: '1.05rem',
          textDecoration: 'none',
          boxShadow: '0 8px 32px rgba(244,185,66,0.35)',
          transition: 'all 0.2s',
        }}>
          Create Free Account →
        </Link>
        <div style={{ marginTop: '1.5rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>
          No credit card required · Free forever for students
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#061A0D', padding: '2.5rem 2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ width: 28, height: 28, background: '#F4B942', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💰</div>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>FinWise</span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
          AI-Powered Financial Advisory System for Ghanaian University Students
        </p>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
          Final Year Project · University of Ghana · {new Date().getFullYear()}
        </p>
      </footer>

    </div>
  );
};

export default LandingPage;