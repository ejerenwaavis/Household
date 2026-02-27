import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

export default function RegisterPage() {
  const { inviteToken } = useParams();
  const [registrationType, setRegistrationType] = useState(inviteToken ? 'join' : 'create');
  const [form, setForm] = useState({ email: '', password: '', name: '', householdName: '' });
  const [householdInfo, setHouseholdInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingHousehold, setLoadingHousehold] = useState(false);
  const [error, setError] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Fetch household info from invite token
  useEffect(() => {
    if (inviteToken) {
      fetchHouseholdFromToken();
    }
  }, [inviteToken]);

  const fetchHouseholdFromToken = async () => {
    setLoadingHousehold(true);
    try {
      // Decode token to get household info
      const response = await api.get(`/households/invite-info/${inviteToken}`);
      setHouseholdInfo(response.data);
      setForm(prev => ({ ...prev, householdName: response.data.householdName }));
    } catch (err) {
      console.error('Failed to fetch household info:', err);
      setError('Invalid or expired invite link');
    } finally {
      setLoadingHousehold(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (registrationType === 'create') {
        // Create new household with user as head
        const { data } = await api.post('/auth/register', form);
        console.log('Registration successful:', data);
        login(data.user, data.accessToken, []);
        localStorage.setItem('refreshToken', data.refreshToken);
        navigate('/dashboard');
      } else if (registrationType === 'join' && inviteToken) {
        // Register with existing account that will join via invite
        const { data: registerData } = await api.post('/auth/register', {
          email: form.email,
          password: form.password,
          name: form.name,
          householdName: `${form.name}'s Household`, // Temporary, will be replaced when they join
        });
        console.log('Registration successful:', registerData);
        login(registerData.user, registerData.accessToken, []);
        localStorage.setItem('refreshToken', registerData.refreshToken);

        // Now accept the invite automatically
        try {
          const { data: inviteData } = await api.post(`/households/invite/accept/${inviteToken}`);
          console.log('Invite accepted:', inviteData);
          // Update user's household after accepting invite
          login(inviteData.user || registerData.user, registerData.accessToken, []);
        } catch (inviteErr) {
          console.warn('Auto-accept invite failed, but registration succeeded:', inviteErr);
        }
        navigate('/dashboard');
      } else {
        // Register user without household, they'll join via invite later
        const { data } = await api.post('/auth/register', {
          email: form.email,
          password: form.password,
          name: form.name,
          householdName: `${form.name}'s Household`,
        });
        console.log('Registration successful:', data);
        login(data.user, data.accessToken, []);
        localStorage.setItem('refreshToken', data.refreshToken);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Create Account</h1>
        <p className="text-center text-gray-500 text-sm mb-8">Join the household budget tracker</p>

        {loadingHousehold ? (
          <div className="text-center py-8 text-gray-500">Loading household information...</div>
        ) : error && householdInfo === null && inviteToken ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">{error}</div>
        ) : (
          <>
            {/* Registration Type Selector - only show if no invite token */}
            {!inviteToken && (
              <div className="mb-6 flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRegistrationType('create')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
                    registrationType === 'create'
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Create Household
                </button>
                <button
                  type="button"
                  onClick={() => setRegistrationType('join')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
                    registrationType === 'join'
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Join via Invite
                </button>
              </div>
            )}

            {/* Show active mode indicator when invite token is present */}
            {inviteToken && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">✓ Joining with Invite</p>
                <p className="text-xs text-green-600 mt-1">Creating account to join: <strong>{householdInfo?.householdName || 'Loading...'}</strong></p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Show household name field */}
              {registrationType === 'create' && !inviteToken ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Household Name</label>
                  <input
                    type="text"
                    name="householdName"
                    value={form.householdName}
                    onChange={handleChange}
                    placeholder="e.g., John & Sarah"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required={registrationType === 'create'}
                  />
                  <p className="text-xs text-gray-500 mt-1">You'll be the head of household and can invite members</p>
                </div>
              ) : inviteToken ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Joining Household</label>
                  <input
                    type="text"
                    value={form.householdName}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">You will join this household after registration</p>
                </div>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    📧 After creating your account, you'll need an invite link from your household head to join.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
                {/* Live password requirements */}
                {form.password.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {[
                      { label: 'At least 8 characters', ok: form.password.length >= 8 },
                      { label: 'One uppercase letter (A–Z)', ok: /[A-Z]/.test(form.password) },
                      { label: 'One lowercase letter (a–z)', ok: /[a-z]/.test(form.password) },
                      { label: 'One number (0–9)', ok: /\d/.test(form.password) },
                      { label: 'One special character (!@#$%^&*)', ok: /[!@#$%^&*]/.test(form.password) },
                    ].map(({ label, ok }) => (
                      <li key={label} className={`flex items-center gap-1.5 ${ok ? 'text-green-600' : 'text-red-500'}`}>
                        <span>{ok ? '✓' : '✗'}</span>
                        <span>{label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">{error}</div>}

              {/* Consent checkbox */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={e => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <span className="text-sm text-gray-600">
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" className="text-blue-600 hover:underline font-medium">
                    Terms &amp; Conditions
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy-policy" target="_blank" className="text-blue-600 hover:underline font-medium">
                    Privacy Policy
                  </Link>{' '}
                  of ACED Division LLC.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || loadingHousehold || !consentChecked}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : registrationType === 'create' ? 'Create Household' : 'Create Account & Join'}
              </button>
            </form>

            <p className="text-center text-gray-600 mt-4">
              Already have an account? <Link to="/login" className="text-blue-500 hover:underline">Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
