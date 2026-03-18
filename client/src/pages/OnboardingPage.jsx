import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import PlaidLink from '../components/PlaidLink';

// ─── Step definitions ────────────────────────────────────────────────────────
const STEPS = [
  { id: 'welcome',        title: 'Welcome',          emoji: '👋' },
  { id: 'income',         title: 'Your Income',      emoji: '💰' },
  { id: 'fixed-expenses', title: 'Fixed Bills',      emoji: '🏠' },
  { id: 'goals',          title: 'Savings Goals',    emoji: '🎯' },
  { id: 'passkey',        title: 'Set up Passkey',   emoji: '🔑' },
  { id: 'bank',           title: 'Link Bank',        emoji: '🏦' },
  { id: 'done',           title: "You're set!",      emoji: '🎉' },
];

const INCOME_FREQUENCIES = [
  { value: 'weekly',      label: 'Weekly' },
  { value: 'biweekly',    label: 'Every 2 weeks (bi-weekly)' },
  { value: 'semimonthly', label: 'Twice a month (1st & 15th)' },
  { value: 'monthly',     label: 'Monthly' },
];

const EXPENSE_PRESETS = [
  { name: 'Rent / Mortgage',  group: 'Housing',   frequency: 'monthly', dueDay: 1  },
  { name: 'Electric',         group: 'Utilities', frequency: 'monthly', dueDay: 15 },
  { name: 'Water',            group: 'Utilities', frequency: 'monthly', dueDay: 15 },
  { name: 'Internet',         group: 'Utilities', frequency: 'monthly', dueDay: 15 },
  { name: 'Phone',            group: 'Bills',     frequency: 'monthly', dueDay: 20 },
  { name: 'Car Payment',      group: 'Auto',      frequency: 'monthly', dueDay: 1  },
  { name: 'Car Insurance',    group: 'Insurance', frequency: 'monthly', dueDay: 1  },
  { name: 'Health Insurance', group: 'Insurance', frequency: 'monthly', dueDay: 1  },
  { name: 'Groceries',        group: 'Food',      frequency: 'weekly',  dueDay: 1  },
  { name: 'Streaming (Netflix/etc)', group: 'Entertainment', frequency: 'monthly', dueDay: 1 },
  { name: 'Student Loan',     group: 'Debt',      frequency: 'monthly', dueDay: 1  },
  { name: 'Gym',              group: 'Other',     frequency: 'monthly', dueDay: 1  },
];

const GOAL_TYPES = ['Emergency', 'Project', 'Investment', 'Other'];

// ─── Small reusable field ─────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step, total }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6">
      <div
        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.round((step / (total - 1)) * 100)}%` }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateUser, isAuthenticated } = useAuth();

  // Redirect away if not logged in or already onboarded
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.onboardingCompleted === true) {
    return <Navigate to="/dashboard" replace />;
  }

  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Income state
  const [income, setIncome] = useState({
    contributorName: user?.name || '',
    amount: '',
    frequency: 'biweekly',
  });

  // Fixed expenses state: map of preset name → { enabled, amount }
  const [presets, setPresets] = useState(
    Object.fromEntries(EXPENSE_PRESETS.map(p => [p.name, { enabled: false, amount: '' }]))
  );
  const [customExpenses, setCustomExpenses] = useState([]);

  // Goals state
  const [goals, setGoals] = useState([
    { name: '', target: '', monthlyContribution: '', type: 'Emergency', currentBalance: '' },
  ]);

  // Week actuals — only the weeks that have already started this month
  const _obNow = new Date();
  const currentWeekOfMonth = Math.min(4, Math.ceil(_obNow.getDate() / 7));
  const _obMonthShort = _obNow.toLocaleString('en-US', { month: 'short' });
  const _obDaysInMonth = new Date(_obNow.getFullYear(), _obNow.getMonth() + 1, 0).getDate();
  const [weekActuals, setWeekActuals] = useState(
    Array.from({ length: currentWeekOfMonth }, (_, i) => ({ week: i + 1, amount: '' }))
  );

  const [bankLinked, setBankLinked] = useState(false);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');

  const handlePasskeyRegister = async () => {
    setPasskeyError('');
    setPasskeyLoading(true);
    try {
      const { data: options } = await api.post('/auth/passkey/register/start');
      const credential = await startRegistration({ optionsJSON: options });
      await api.post('/auth/passkey/register/finish', { ...credential, name: 'My Passkey' });
      // Update user context so PlaidLink gate is immediately satisfied
      if (updateUser) updateUser({ passkeyCount: 1 });
      setPasskeyRegistered(true);
    } catch (err) {
      setPasskeyError(err.response?.data?.error || err.message || 'Registration failed. Please try again.');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const next = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex(i => Math.max(i - 1, 0));

  const addGoal = () =>
    setGoals(g => [...g, { name: '', target: '', monthlyContribution: '', type: 'Other', currentBalance: '' }]);

  const updateGoal = (i, field, val) =>
    setGoals(g => g.map((goal, idx) => (idx === i ? { ...goal, [field]: val } : goal)));

  const removeGoal = (i) => setGoals(g => g.filter((_, idx) => idx !== i));

  const addCustomExpense = () =>
    setCustomExpenses(e => [...e, { name: '', amount: '', group: 'Other', frequency: 'monthly', dueDay: 1 }]);

  const updateCustomExpense = (i, field, val) =>
    setCustomExpenses(e => e.map((ex, idx) => (idx === i ? { ...ex, [field]: val } : ex)));

  const removeCustomExpense = (i) =>
    setCustomExpenses(e => e.filter((_, idx) => idx !== i));

  const handleComplete = async (skip = false) => {
    setSubmitting(true);
    setError('');
    try {
      if (skip) {
        await api.patch('/onboarding/skip');
      } else {
        // Build fixed expenses payload
        const fixedExpenses = [
          ...EXPENSE_PRESETS.filter(p => presets[p.name]?.enabled).map(p => ({
            ...p,
            amount: parseFloat(presets[p.name].amount) || 0,
          })),
          ...customExpenses.filter(e => e.name && e.amount),
        ];

        // Build goals payload
        const goalsPayload = goals
          .filter(g => g.name)
          .map(g => ({
            ...g,
            target: parseFloat(g.target) || 0,
            monthlyContribution: parseFloat(g.monthlyContribution) || 0,
            currentBalance: parseFloat(g.currentBalance) || 0,
          }));

        // Build per-week actuals — only weeks the user confirmed receiving income
        const weeklyActuals = weekActuals
          .filter(w => parseFloat(w.amount) > 0)
          .map(w => ({
            week: w.week,
            amount: parseFloat(w.amount),
            contributorName: income.contributorName || 'Primary',
          }));

        await api.post('/onboarding/complete', {
          income: income.amount ? { ...income, amount: parseFloat(income.amount) } : null,
          weeklyActuals,
          fixedExpenses,
          goals: goalsPayload,
        });
      }

      // Update local user state so the redirect doesn't loop
      if (updateUser) updateUser({ onboardingCompleted: true });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-400 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Top bar */}
          <div className="px-8 pt-8 pb-0">
            <ProgressBar step={stepIndex} total={STEPS.length - 1} />
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400 font-medium">
                Step {Math.min(stepIndex + 1, STEPS.length - 1)} of {STEPS.length - 1}
              </span>
              {stepIndex > 0 && !isLast && (
                <button
                  onClick={() => handleComplete(true)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition"
                >
                  Skip setup →
                </button>
              )}
            </div>
          </div>

          {/* Step content */}
          <div className="px-8 py-6 min-h-[420px] flex flex-col">

            {/* ── Welcome ── */}
            {step.id === 'welcome' && (
              <div className="flex flex-col items-center text-center flex-1 justify-center gap-4">
                <div className="text-6xl animate-bounce">👋</div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Welcome, {user?.name?.split(' ')[0] || 'there'}!
                </h1>
                <p className="text-gray-500 max-w-sm">
                  Let's set up your household budget in about 2 minutes. We'll walk you through your income,
                  your regular bills, your savings goals, and optionally link your bank account — so your
                  dashboard is ready to go from day one.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {STEPS.slice(1, -1).map(s => (
                    <span key={s.id} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full">
                      {s.emoji} {s.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Income ── */}
            {step.id === 'income' && (
              <div className="flex flex-col gap-5 flex-1">
                <div>
                  <div className="text-3xl mb-1">💰</div>
                  <h2 className="text-2xl font-bold text-gray-900">Your Income</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Tell us your take-home pay and how often you get paid.
                  </p>
                </div>
                <Field label="Your name (as it appears on income)">
                  <input
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400"
                    placeholder="e.g. John"
                    value={income.contributorName}
                    onChange={e => setIncome(v => ({ ...v, contributorName: e.target.value }))}
                  />
                </Field>
                <Field label="Take-home pay per paycheck" hint="After taxes and deductions">
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400"
                      placeholder="0.00"
                      value={income.amount}
                      onChange={e => setIncome(v => ({ ...v, amount: e.target.value }))}
                    />
                  </div>
                </Field>
                <Field label="Pay frequency">
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400"
                    value={income.frequency}
                    onChange={e => setIncome(v => ({ ...v, frequency: e.target.value }))}
                  >
                    {INCOME_FREQUENCIES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </Field>
                {income.amount && (
                  <div className="bg-indigo-50 rounded-lg px-4 py-3 text-sm text-indigo-700">
                    📊 That's approximately{' '}
                    <strong>
                      ${(
                        income.frequency === 'weekly' ? parseFloat(income.amount) * 52 / 12
                        : income.frequency === 'biweekly' ? parseFloat(income.amount) * 26 / 12
                        : income.frequency === 'semimonthly' ? parseFloat(income.amount) * 2
                        : parseFloat(income.amount)
                      ).toFixed(0)}/mo
                    </strong>{' '}
                    in take-home pay.
                  </div>
                )}

                {/* ── Actual income received this month, week by week ── */}
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      What have you actually received this month?
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Enter only amounts already paid to you. Leave blank for weeks with no income.
                    </p>
                  </div>
                  {weekActuals.map((w, i) => {
                    const wStart = (w.week - 1) * 7 + 1;
                    const wEnd = Math.min(w.week * 7, _obDaysInMonth);
                    const isCurrentWk = w.week === currentWeekOfMonth;
                    const weeklyDefault = income.amount ? (() => {
                      const a = parseFloat(income.amount);
                      if (income.frequency === 'weekly') return a;
                      if (income.frequency === 'biweekly') return a / 2;
                      if (income.frequency === 'semimonthly') return a / 2;
                      return a / 4;
                    })() : null;
                    return (
                      <div key={w.week} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-sm text-gray-600 flex-1 min-w-0">
                          <span className="font-medium">W{w.week}</span>
                          <span className="text-gray-400 ml-1">({_obMonthShort} {wStart}–{wEnd})</span>
                          {isCurrentWk && (
                            <span className="ml-1 text-xs text-indigo-600 font-medium">current</span>
                          )}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400"
                            placeholder={weeklyDefault ? weeklyDefault.toFixed(2) : '0.00'}
                            value={w.amount}
                            onChange={e => setWeekActuals(prev =>
                              prev.map((wa, idx) => idx === i ? { ...wa, amount: e.target.value } : wa)
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Fixed Expenses ── */}
            {step.id === 'fixed-expenses' && (
              <div className="flex flex-col gap-4 flex-1">
                <div>
                  <div className="text-3xl mb-1">🏠</div>
                  <h2 className="text-2xl font-bold text-gray-900">Fixed Bills</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Check off your regular bills and enter the amounts. Leave blank to skip.
                  </p>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {EXPENSE_PRESETS.map(preset => (
                    <div
                      key={preset.name}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition cursor-pointer ${
                        presets[preset.name]?.enabled
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() =>
                        setPresets(p => ({
                          ...p,
                          [preset.name]: { ...p[preset.name], enabled: !p[preset.name]?.enabled },
                        }))
                      }
                    >
                      <input
                        type="checkbox"
                        checked={presets[preset.name]?.enabled || false}
                        onChange={() =>
                          setPresets(p => ({
                            ...p,
                            [preset.name]: { ...p[preset.name], enabled: !p[preset.name]?.enabled },
                          }))
                        }
                        className="h-4 w-4 text-indigo-600 rounded flex-shrink-0"
                        onClick={e => e.stopPropagation()}
                      />
                      <span className="flex-1 text-sm font-medium text-gray-700">{preset.name}</span>
                      {presets[preset.name]?.enabled && (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <span className="text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400"
                            placeholder="Amount"
                            value={presets[preset.name]?.amount || ''}
                            onChange={e =>
                              setPresets(p => ({
                                ...p,
                                [preset.name]: { ...p[preset.name], amount: e.target.value },
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Custom expenses */}
                {customExpenses.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <input
                      className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Bill name"
                      value={e.name}
                      onChange={v => updateCustomExpense(i, 'name', v.target.value)}
                    />
                    <span className="text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Amount"
                      value={e.amount}
                      onChange={v => updateCustomExpense(i, 'amount', v.target.value)}
                    />
                    <button onClick={() => removeCustomExpense(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCustomExpense}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium self-start"
                >
                  + Add another bill
                </button>
              </div>
            )}

            {/* ── Goals ── */}
            {step.id === 'goals' && (
              <div className="flex flex-col gap-4 flex-1">
                <div>
                  <div className="text-3xl mb-1">🎯</div>
                  <h2 className="text-2xl font-bold text-gray-900">Savings Goals</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Add any savings goals — emergency fund, vacation, car, etc. You can always add more later.
                  </p>
                </div>
                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {goals.map((g, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Goal {i + 1}</span>
                        {goals.length > 1 && (
                          <button onClick={() => removeGoal(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                        )}
                      </div>
                      <input
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400"
                        placeholder="Goal name (e.g. Emergency Fund)"
                        value={g.name}
                        onChange={e => updateGoal(i, 'name', e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Target amount</label>
                          <div className="relative">
                            <span className="absolute left-2 top-2 text-gray-400 text-sm">$</span>
                            <input
                              type="number" min="0"
                              className="w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-400"
                              placeholder="5,000"
                              value={g.target}
                              onChange={e => updateGoal(i, 'target', e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Monthly contribution</label>
                          <div className="relative">
                            <span className="absolute left-2 top-2 text-gray-400 text-sm">$</span>
                            <input
                              type="number" min="0"
                              className="w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-400"
                              placeholder="200"
                              value={g.monthlyContribution}
                              onChange={e => updateGoal(i, 'monthlyContribution', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Type</label>
                          <select
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-400"
                            value={g.type}
                            onChange={e => updateGoal(i, 'type', e.target.value)}
                          >
                            {GOAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Current balance</label>
                          <div className="relative">
                            <span className="absolute left-2 top-2 text-gray-400 text-sm">$</span>
                            <input
                              type="number" min="0"
                              className="w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-400"
                              placeholder="0"
                              value={g.currentBalance}
                              onChange={e => updateGoal(i, 'currentBalance', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addGoal}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium self-start"
                >
                  + Add another goal
                </button>
              </div>
            )}

            {/* ── Passkey ── */}
            {step.id === 'passkey' && (
              <div className="flex flex-col items-center text-center flex-1 justify-center gap-5">
                <div className="text-5xl">🔑</div>
                <h2 className="text-2xl font-bold text-gray-900">Secure your account</h2>
                <p className="text-gray-500 max-w-sm text-sm">
                  Create a <strong>passkey</strong> using Face ID, Touch ID, or Windows Hello.
                  Passkeys replace passwords entirely — no app needed — and are required to link
                  a bank account.
                </p>

                {passkeyRegistered ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-5 py-3 rounded-xl font-medium">
                    ✅ Passkey created! Your account is secured.
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 w-full">
                    {passkeyError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg w-full max-w-sm">
                        {passkeyError}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handlePasskeyRegister}
                      disabled={passkeyLoading}
                      className="w-full max-w-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
                    >
                      {passkeyLoading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Waiting for device…
                        </>
                      ) : '🔑 Create Passkey'}
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      className="text-sm text-gray-400 hover:text-gray-600 transition"
                    >
                      Skip for now — I'll set this up later
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Bank Link ── */}
            {step.id === 'bank' && (
              <div className="flex flex-col items-center text-center flex-1 justify-center gap-5">
                <div className="text-5xl">🏦</div>
                <h2 className="text-2xl font-bold text-gray-900">Link Your Bank Account</h2>
                <p className="text-gray-500 max-w-sm text-sm">
                  Connect your bank so your transactions sync automatically. We use Plaid — read-only access,
                  and your banking credentials are never stored by us.
                </p>
                {bankLinked ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-5 py-3 rounded-xl font-medium">
                    ✅ Bank account linked successfully!
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <PlaidLink onSuccess={() => setBankLinked(true)} />
                    <button
                      onClick={next}
                      className="text-sm text-gray-400 hover:text-gray-600 transition"
                    >
                      Skip for now — I'll link it later
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Done ── */}
            {step.id === 'done' && (
              <div className="flex flex-col items-center text-center flex-1 justify-center gap-5">
                <div className="text-6xl animate-bounce">🎉</div>
                <h2 className="text-3xl font-bold text-gray-900">You're all set!</h2>
                <p className="text-gray-500 max-w-sm">
                  Your budget foundation is ready. Head to your dashboard to see your numbers and start
                  tracking your spending.
                </p>
                {[
                  income.amount && `✅ Income recorded`,
                  Object.values(presets).some(p => p.enabled) && `✅ Fixed bills added`,
                  goals.some(g => g.name) && `✅ Savings goals created`,
                  passkeyRegistered && `✅ Passkey created`,
                  bankLinked && `✅ Bank account linked`,
                ].filter(Boolean).map(item => (
                  <div key={item} className="text-sm font-medium text-indigo-700 bg-indigo-50 px-4 py-2 rounded-full">
                    {item}
                  </div>
                ))}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm w-full max-w-sm">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="px-8 pb-8 flex items-center justify-between gap-3">
            {stepIndex > 0 && !isLast ? (
              <button
                onClick={back}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {isLast ? (
              <button
                onClick={() => handleComplete(false)}
                disabled={submitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-base"
              >
                {submitting ? 'Saving...' : 'Go to my Dashboard →'}
              </button>
            ) : step.id === 'bank' ? (
              // On bank step the skip button is inline; just show Next to proceed after linking
              bankLinked ? (
                <button
                  onClick={next}
                  className="ml-auto px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition"
                >
                  Next →
                </button>
              ) : null
            ) : (
              <button
                onClick={next}
                className="ml-auto px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition"
              >
                {step.id === 'welcome' ? "Let's go →" : 'Next →'}
              </button>
            )}
          </div>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mt-5">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? 'w-6 h-2.5 bg-white'
                  : i < stepIndex
                  ? 'w-2.5 h-2.5 bg-white/60'
                  : 'w-2.5 h-2.5 bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
