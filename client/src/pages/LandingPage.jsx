import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/* ─── Scroll-triggered fade-in hook ─────────────────────── */
function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

/* ─── Animated counter hook ──────────────────────────────── */
function useCounter(target, inView, duration = 1800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);
  return count;
}

/* ─── Stat counter pill ──────────────────────────────────── */
function StatPill({ target, suffix, label, inView }) {
  const count = useCounter(target, inView);
  return (
    <div className="text-center">
      <div className="text-4xl font-extrabold text-white tracking-tight">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-indigo-200 text-sm mt-1 font-medium">{label}</div>
    </div>
  );
}

/* ─── Feature card ───────────────────────────────────────── */
function FeatureCard({ icon, title, desc, delay, inView }) {
  return (
    <div
      className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms, box-shadow 0.3s, translate 0.3s`,
      }}
    >
      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

/* ─── Step card ──────────────────────────────────────────── */
function StepCard({ num, title, desc, inView, delay }) {
  return (
    <div
      className="flex gap-5"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateX(0)' : 'translateX(-24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-200">
        {num}
      </div>
      <div>
        <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
        <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Mock dashboard preview ─────────────────────────────── */
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:mx-0" style={{ animation: 'float 5s ease-in-out infinite' }}>
      {/* Glow ring */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 blur-2xl scale-105 -z-10" />

      <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        {/* App header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">H</div>
            <span className="text-white text-xs font-semibold">Household Budget</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-indigo-400/30" />
            <div className="text-[10px] text-gray-400">Johnson Family</div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Metric cards row */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Income', value: '$6,240', color: 'from-green-500/20 to-emerald-500/10', text: 'text-green-400', dot: 'bg-green-400' },
              { label: 'Fixed Exp.', value: '$2,150', color: 'from-red-500/20 to-rose-500/10', text: 'text-red-400', dot: 'bg-red-400' },
              { label: 'Variable', value: '$843', color: 'from-orange-500/20 to-amber-500/10', text: 'text-orange-400', dot: 'bg-orange-400' },
              { label: 'Available', value: '$3,247', color: 'from-blue-500/20 to-indigo-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl p-3 bg-gradient-to-br ${c.color} border border-white/5`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  <span className="text-[10px] text-gray-400">{c.label}</span>
                </div>
                <div className={`text-sm font-bold ${c.text}`}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Mini chart */}
          <div className="bg-gray-800/60 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-gray-400 mb-2">Spending by Category</div>
            <div className="flex items-end gap-1 h-12">
              {[65, 40, 80, 55, 90, 35, 70, 45, 60, 85, 50, 75].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}%`,
                    background: `hsl(${220 + i * 5}, 80%, ${50 + i * 2}%)`,
                    opacity: 0.8,
                    animation: `barGrow 0.6s ease ${i * 60}ms both`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Recent activity list */}
          <div className="bg-gray-800/60 rounded-xl overflow-hidden border border-white/5">
            <div className="text-[10px] text-gray-400 px-3 py-2 border-b border-white/5">Recent Activity</div>
            {[
              { name: 'Netflix', cat: 'Entertainment', amt: '-$15.99', color: 'bg-rose-400' },
              { name: 'Whole Foods', cat: 'Groceries', amt: '-$124.50', color: 'bg-orange-400' },
              { name: 'Payroll Deposit', cat: 'Income', amt: '+$3,120', color: 'bg-green-400', pos: true },
            ].map((t, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${t.color}`} />
                  <div>
                    <div className="text-[10px] text-gray-200 font-medium">{t.name}</div>
                    <div className="text-[9px] text-gray-500">{t.cat}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold ${t.pos ? 'text-green-400' : 'text-gray-400'}`}>{t.amt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [statsRef, statsInView] = useInView();
  const [featRef, featInView] = useInView();
  const [howRef, howInView] = useInView();
  const [bankRef, bankInView] = useInView();
  const [aiRef, aiInView] = useInView();
  const [pricingRef, pricingInView] = useInView();
  const [ctaRef, ctaInView] = useInView();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const features = [
    {
      icon: <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      title: 'Budget Tracking',
      desc: 'Track income, fixed bills, and variable spending all in one clean dashboard. Know exactly where every dollar goes.',
    },
    {
      icon: <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
      title: 'Bank Sync via Plaid',
      desc: 'Securely connect your bank accounts and credit cards. Transactions flow in automatically — no manual entry needed.',
    },
    {
      icon: <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      title: 'Household Members',
      desc: 'Invite your partner or family. Share the budget, split responsibilities, and stay aligned on your financial goals.',
    },
    {
      icon: <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
      title: 'Goals & Savings',
      desc: 'Set savings goals — vacation fund, emergency fund, down payment. Watch your progress grow with visual trackers.',
    },
    {
      icon: <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      title: 'AI Financial Insights',
      desc: 'Get smart recommendations tailored to your spending patterns. Spot waste, find savings opportunities, plan ahead.',
    },
    {
      icon: <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      title: 'Receipt Scanning',
      desc: 'Snap a photo of any receipt and we\'ll read it for you. Log expenses in seconds without typing a single digit.',
    },
  ];

  return (
    <>
      {/* ── Keyframe styles ──────────────────────────────────── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-12px) rotate(0.5deg); }
          66%       { transform: translateY(-6px) rotate(-0.5deg); }
        }
        @keyframes orb1 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50%       { transform: translate(40px,-30px) scale(1.1); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50%       { transform: translate(-30px,20px) scale(0.95); }
        }
        @keyframes orb3 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50%       { transform: translate(20px,40px) scale(1.05); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes barGrow {
          from { transform: scaleY(0); transform-origin: bottom; }
          to   { transform: scaleY(1); transform-origin: bottom; }
        }
        @keyframes gradShift {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .gradient-text {
          background: linear-gradient(135deg, #818cf8 0%, #a78bfa 35%, #60a5fa 65%, #818cf8 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .btn-shimmer {
          background: linear-gradient(90deg, #4f46e5, #7c3aed, #2563eb, #4f46e5);
          background-size: 300% auto;
          animation: gradShift 3s ease infinite;
        }
        .hero-grad {
          background: linear-gradient(135deg, #0f0c29 0%, #1a1060 30%, #24243e 60%, #0d0d2b 100%);
        }
        .card-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.12); }
        .step-line::after {
          content: '';
          position: absolute;
          left: 19px;
          top: 40px;
          width: 2px;
          height: calc(100% - 8px);
          background: linear-gradient(to bottom, #6366f1, transparent);
        }
      `}</style>

      <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

        {/* ══ NAVBAR ══════════════════════════════════════════════ */}
        <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-indigo-300 transition-shadow">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <span className={`font-bold text-lg ${scrolled ? 'text-gray-900' : 'text-white'}`}>Household Budget</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {['Features', 'How It Works', 'Pricing'].map(item => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`text-sm font-medium transition-colors hover:text-indigo-500 ${scrolled ? 'text-gray-600' : 'text-white/80'}`}
                >
                  {item}
                </a>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                to="/login"
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                  scrolled ? 'text-gray-700 hover:text-indigo-600' : 'text-white/90 hover:text-white'
                }`}
              >
                Sign in
              </Link>
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="btn-shimmer text-white text-sm font-semibold px-5 py-2 rounded-xl shadow-lg shadow-indigo-300 hover:shadow-indigo-400 transition-shadow"
              >
                {isAuthenticated ? 'Go to Dashboard →' : 'Get Started Free'}
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              className={`md:hidden p-2 rounded-lg ${scrolled ? 'text-gray-700' : 'text-white'}`}
              onClick={() => setMenuOpen(o => !o)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 shadow-lg">
              {['Features', 'How It Works', 'Pricing'].map(item => (
                <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="block text-gray-700 font-medium py-1" onClick={() => setMenuOpen(false)}>{item}</a>
              ))}
              <div className="pt-2 flex flex-col gap-2">
                <Link to="/login" className="text-center py-2 text-gray-700 border border-gray-200 rounded-xl font-medium" onClick={() => setMenuOpen(false)}>Sign in</Link>
                <Link to={isAuthenticated ? '/dashboard' : '/register'} className="text-center py-2 btn-shimmer text-white rounded-xl font-semibold" onClick={() => setMenuOpen(false)}>
                  {isAuthenticated ? 'Dashboard →' : 'Get Started Free'}
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* ══ HERO ════════════════════════════════════════════════ */}
        <section className="hero-grad relative min-h-screen flex items-center overflow-hidden pt-16">
          {/* Floating orbs */}
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" style={{ animation: 'orb1 8s ease-in-out infinite' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" style={{ animation: 'orb2 10s ease-in-out infinite' }} />
          <div className="absolute top-1/2 right-1/3 w-56 h-56 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" style={{ animation: 'orb3 12s ease-in-out infinite' }} />

          {/* Subtle dot grid */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

              {/* Left: copy */}
              <div>
                {/* Badge */}
                <div
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-medium mb-8 backdrop-blur-sm"
                  style={{ animation: 'fadeUp 0.6s ease both' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Trusted by families across the US
                </div>

                <h1
                  className="text-5xl sm:text-6xl font-extrabold text-white leading-tight mb-6"
                  style={{ animation: 'fadeUp 0.6s ease 100ms both' }}
                >
                  Your family's{' '}
                  <span className="gradient-text">money</span>,<br />
                  finally organized.
                </h1>

                <p
                  className="text-lg text-white/65 mb-10 leading-relaxed max-w-lg"
                  style={{ animation: 'fadeUp 0.6s ease 200ms both' }}
                >
                  Household Budget brings all your income, bills, goals, and bank transactions into one shared space — so your whole household is always on the same page.
                </p>

                <div
                  className="flex flex-wrap gap-4"
                  style={{ animation: 'fadeUp 0.6s ease 300ms both' }}
                >
                  <Link
                    to={isAuthenticated ? '/dashboard' : '/register'}
                    className="btn-shimmer text-white font-semibold px-7 py-3.5 rounded-xl shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-shadow text-sm"
                  >
                    {isAuthenticated ? 'Go to Dashboard →' : 'Start for free →'}
                  </Link>
                  <a
                    href="#how-it-works"
                    className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/20 text-white/80 hover:bg-white/10 transition-colors text-sm font-medium backdrop-blur-sm"
                  >
                    See how it works
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </a>
                </div>

                {/* Trust row */}
                <div
                  className="flex items-center gap-6 mt-10 pt-8 border-t border-white/10"
                  style={{ animation: 'fadeUp 0.6s ease 400ms both' }}
                >
                  {[
                    { val: 'Free', lbl: 'to get started' },
                    { val: '256-bit', lbl: 'encryption' },
                    { val: 'Plaid', lbl: 'bank security' },
                  ].map(t => (
                    <div key={t.val} className="text-center">
                      <div className="text-white font-bold text-sm">{t.val}</div>
                      <div className="text-white/50 text-xs">{t.lbl}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: mock dashboard */}
              <div style={{ animation: 'fadeUp 0.8s ease 200ms both' }}>
                <DashboardMockup />
              </div>
            </div>
          </div>

          {/* Wave bottom */}
          <div className="absolute bottom-0 inset-x-0 pointer-events-none">
            <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-16">
              <path d="M0 80L1440 80L1440 20C1200 70 960 0 720 30C480 60 240 10 0 40L0 80Z" fill="white" />
            </svg>
          </div>
        </section>

        {/* ══ STATS BAR ═══════════════════════════════════════════ */}
        <section ref={statsRef} className="bg-gradient-to-r from-indigo-600 to-purple-700 py-14">
          <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatPill target={12000} suffix="+" label="Households enrolled" inView={statsInView} />
            <StatPill target={48} suffix="M+" label="Transactions tracked" inView={statsInView} />
            <StatPill target={99} suffix="%" label="Uptime guarantee" inView={statsInView} />
            <StatPill target={4} suffix=".9★" label="Average rating" inView={statsInView} />
          </div>
        </section>

        {/* ══ FEATURES ════════════════════════════════════════════ */}
        <section id="features" ref={featRef} className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="text-center mb-14"
              style={{
                opacity: featInView ? 1 : 0,
                transform: featInView ? 'none' : 'translateY(20px)',
                transition: 'opacity 0.6s ease, transform 0.6s ease',
              }}
            >
              <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wide mb-4">Features</span>
              <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Everything your household needs</h2>
              <p className="text-gray-500 max-w-xl mx-auto">One app for budgeting, bill tracking, bank sync, family sharing, and financial insights.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <FeatureCard key={f.title} {...f} delay={i * 80} inView={featInView} />
              ))}
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ════════════════════════════════════════ */}
        <section id="how-it-works" ref={howRef} className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              {/* Visual: stacked cards */}
              <div
                className="relative order-2 lg:order-1"
                style={{
                  opacity: howInView ? 1 : 0,
                  transform: howInView ? 'none' : 'translateX(-24px)',
                  transition: 'opacity 0.7s ease, transform 0.7s ease',
                }}
              >
                <div className="relative w-full aspect-square max-w-sm mx-auto">
                  {/* Background card */}
                  <div className="absolute inset-4 bg-indigo-100 rounded-3xl transform rotate-3" />
                  <div className="absolute inset-2 bg-purple-100 rounded-3xl transform -rotate-2" />
                  {/* Main card */}
                  <div className="relative bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex flex-col justify-center gap-6">
                    {[
                      { icon: '🏦', title: 'Connect your bank', desc: 'Securely link accounts with Plaid in 60 seconds', done: true },
                      { icon: '🎯', title: 'Set your budget', desc: 'Enter income, bills, and savings targets', done: true },
                      { icon: '📊', title: 'See your picture', desc: 'Live dashboard shows where you stand', done: false },
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${step.done ? 'bg-green-100' : 'bg-indigo-50'}`}>
                          {step.done ? '✅' : step.icon}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{step.title}</div>
                          <div className="text-xs text-gray-500">{step.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Steps list */}
              <div className="order-1 lg:order-2">
                <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wide mb-4">How It Works</span>
                <h2 className="text-4xl font-extrabold text-gray-900 mb-10">Up and running in minutes</h2>
                <div className="relative space-y-8 step-line">
                  {[
                    { num: '1', title: 'Create your household', desc: 'Sign up free, name your household, and invite your partner or family members. Everyone gets their own secure login.' },
                    { num: '2', title: 'Connect your accounts', desc: 'Link your bank and credit cards via Plaid. Transactions sync automatically — no CSV uploads, no manual entry.' },
                    { num: '3', title: 'Set up your budget', desc: 'Enter your income and fixed expenses. We calculate what\'s available and show you a clear monthly picture.' },
                    { num: '4', title: 'Watch your goals grow', desc: 'Create savings goals, log receipts, and track progress. Your AI insights get smarter the more you use it.' },
                  ].map((step, i) => (
                    <StepCard key={i} {...step} inView={howInView} delay={i * 100} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ BANK INTEGRATION SPOTLIGHT ══════════════════════════ */}
        <section ref={bankRef} className="py-24 bg-gradient-to-br from-slate-900 to-indigo-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div
                style={{
                  opacity: bankInView ? 1 : 0,
                  transform: bankInView ? 'none' : 'translateY(24px)',
                  transition: 'opacity 0.7s ease, transform 0.7s ease',
                }}
              >
                <span className="inline-block text-xs font-semibold text-indigo-300 bg-indigo-900/60 px-3 py-1 rounded-full uppercase tracking-wide mb-4 border border-indigo-700">Bank Security</span>
                <h2 className="text-4xl font-extrabold text-white mb-6">Bank-grade security, powered by Plaid</h2>
                <p className="text-white/60 mb-8 leading-relaxed">
                  We never store your banking credentials. Plaid connects directly to your bank using the same security standards used by the largest financial institutions in the world.
                </p>
                <div className="space-y-4">
                  {[
                    '256-bit AES encryption in transit and at rest',
                    'Passkey & two-factor authentication required for bank linking',
                    'Read-only access — we can never move your money',
                    'Revoke bank access at any time from your profile',
                  ].map(item => (
                    <div key={item} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-white/75 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="flex justify-center"
                style={{
                  opacity: bankInView ? 1 : 0,
                  transform: bankInView ? 'none' : 'translateX(24px)',
                  transition: 'opacity 0.7s ease 150ms, transform 0.7s ease 150ms',
                }}
              >
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm max-w-sm w-full">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div className="text-white font-semibold">Secure Connection</div>
                    <div className="text-white/50 text-xs mt-1">Your bank credentials never touch our servers</div>
                  </div>
                  <div className="space-y-3">
                    {['Chase Bank', 'Bank of America', 'Wells Fargo', 'Citibank', '+ 12,000 more institutions'].map((bank, i) => (
                      <div key={bank} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-xl border border-white/10">
                        <span className="text-white/70 text-sm">{bank}</span>
                        {i < 4 && <span className="text-green-400 text-xs">Connected ✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ AI INSIGHTS SPOTLIGHT ═══════════════════════════════ */}
        <section ref={aiRef} className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-3xl p-10 lg:p-14 border border-indigo-100">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div
                  style={{
                    opacity: aiInView ? 1 : 0,
                    transform: aiInView ? 'none' : 'translateY(24px)',
                    transition: 'opacity 0.7s ease, transform 0.7s ease',
                  }}
                >
                  <span className="inline-block text-xs font-semibold text-purple-600 bg-purple-100 px-3 py-1 rounded-full uppercase tracking-wide mb-4">AI Powered</span>
                  <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Insights that actually help</h2>
                  <p className="text-gray-500 leading-relaxed mb-6">
                    Our AI analyses your spending patterns and delivers plain-English recommendations — not generic tips. Understand overspend categories, predict month-end balance, and find subscriptions you forgot about.
                  </p>
                  <Link
                    to={isAuthenticated ? '/insights' : '/register'}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 transition-shadow"
                  >
                    Try insights free
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>

                <div
                  className="space-y-3"
                  style={{
                    opacity: aiInView ? 1 : 0,
                    transform: aiInView ? 'none' : 'translateX(24px)',
                    transition: 'opacity 0.7s ease 150ms, transform 0.7s ease 150ms',
                  }}
                >
                  {[
                    { icon: '📉', title: 'You overspent on dining by 34% this month', desc: 'Based on your 3-month average of $340/mo, you\'re trending $116 over.', color: 'border-l-amber-400 bg-amber-50' },
                    { icon: '💡', title: '3 recurring charges you might not need', desc: 'Hulu, Adobe CC, and a gym you haven\'t visited since January.', color: 'border-l-blue-400 bg-blue-50' },
                    { icon: '🎉', title: 'On track to hit Emergency Fund goal', desc: 'You\'ll reach your $5,000 goal in approximately 2.4 months.', color: 'border-l-green-400 bg-green-50' },
                  ].map(insight => (
                    <div key={insight.title} className={`rounded-xl p-4 border-l-4 ${insight.color}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-xl flex-shrink-0">{insight.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm mb-0.5">{insight.title}</div>
                          <div className="text-xs text-gray-500">{insight.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ PRICING ═════════════════════════════════════════════ */}
        <section id="pricing" ref={pricingRef} className="py-24 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="text-center mb-14"
              style={{
                opacity: pricingInView ? 1 : 0,
                transform: pricingInView ? 'none' : 'translateY(20px)',
                transition: 'opacity 0.6s ease, transform 0.6s ease',
              }}
            >
              <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wide mb-4">Pricing</span>
              <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Simple, honest pricing</h2>
              <p className="text-gray-500">Start free. Upgrade when you're ready for the full picture.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Free */}
              <div
                className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm card-hover"
                style={{
                  opacity: pricingInView ? 1 : 0,
                  transform: pricingInView ? 'none' : 'translateY(24px)',
                  transition: 'opacity 0.6s ease 100ms, transform 0.6s ease 100ms',
                }}
              >
                <div className="text-indigo-600 font-semibold text-sm mb-2">Free</div>
                <div className="text-5xl font-extrabold text-gray-900 mb-1">$0</div>
                <div className="text-gray-400 text-sm mb-8">Forever</div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Income & expense tracking',
                    'Fixed expenses & bill calendar',
                    'Up to 3 savings goals',
                    '1 household member',
                    '30-day transaction history',
                    'Basic monthly overview',
                  ].map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="w-full block text-center py-3 rounded-xl border-2 border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors text-sm">
                  Start for free
                </Link>
              </div>

              {/* Pro */}
              <div
                className="relative bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 shadow-xl shadow-indigo-200 card-hover"
                style={{
                  opacity: pricingInView ? 1 : 0,
                  transform: pricingInView ? 'none' : 'translateY(24px)',
                  transition: 'opacity 0.6s ease 200ms, transform 0.6s ease 200ms',
                }}
              >
                <div className="absolute top-6 right-6 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>
                <div className="text-indigo-200 font-semibold text-sm mb-2">Pro</div>
                <div className="text-5xl font-extrabold text-white mb-1">$7<span className="text-2xl font-medium text-indigo-200">.99</span></div>
                <div className="text-indigo-200 text-sm mb-8">per month, per household</div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Everything in Free',
                    'Plaid bank & credit card sync',
                    'Unlimited savings goals',
                    'Unlimited household members',
                    'Full transaction history',
                    'AI financial insights',
                    'Receipt OCR scanning',
                    'Income split management',
                    'Priority support',
                  ].map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-indigo-100">
                      <svg className="w-4 h-4 text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="w-full block text-center py-3 rounded-xl bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition-colors text-sm shadow-md">
                  Get started free →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ══ FINAL CTA ════════════════════════════════════════════ */}
        <section ref={ctaRef} className="py-24 bg-white">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div
              className="bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 rounded-3xl px-8 py-16 shadow-2xl shadow-indigo-200 relative overflow-hidden"
              style={{
                opacity: ctaInView ? 1 : 0,
                transform: ctaInView ? 'none' : 'translateY(24px)',
                transition: 'opacity 0.7s ease, transform 0.7s ease',
              }}
            >
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }} />
              <div className="relative z-10">
                <h2 className="text-4xl font-extrabold text-white mb-4">Ready to take control?</h2>
                <p className="text-indigo-200 mb-10 max-w-lg mx-auto">
                  Join thousands of households who already know exactly where their money goes every month.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Link
                    to={isAuthenticated ? '/dashboard' : '/register'}
                    className="px-8 py-4 bg-white text-indigo-700 font-bold rounded-xl shadow-xl hover:shadow-2xl hover:bg-indigo-50 transition-all text-sm"
                  >
                    {isAuthenticated ? 'Open Dashboard →' : 'Create free account →'}
                  </Link>
                  <Link
                    to="/login"
                    className="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors text-sm backdrop-blur-sm"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ FOOTER ══════════════════════════════════════════════ */}
        <footer className="bg-gray-900 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <span className="font-bold text-lg">Household Budget</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                  The all-in-one budget app built for real households. Track, plan, and grow together.
                </p>
                <p className="text-gray-500 text-xs mt-4">© {new Date().getFullYear()} ACED Division LLC. All rights reserved.</p>
              </div>

              <div>
                <p className="font-semibold text-sm mb-4">Product</p>
                <ul className="space-y-2">
                  {['Features', 'Pricing', 'How It Works', 'Security'].map(l => (
                    <li key={l}><a href="#" className="text-gray-400 text-sm hover:text-white transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-semibold text-sm mb-4">Legal</p>
                <ul className="space-y-2">
                  <li><Link to="/privacy-policy" className="text-gray-400 text-sm hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link to="/terms" className="text-gray-400 text-sm hover:text-white transition-colors">Terms of Service</Link></li>
                  <li><Link to="/login" className="text-gray-400 text-sm hover:text-white transition-colors">Sign In</Link></li>
                  <li><Link to="/register" className="text-gray-400 text-sm hover:text-white transition-colors">Create Account</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-gray-500 text-xs">Built with ❤️ for households that want to do better.</p>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                All systems operational
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
