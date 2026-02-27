import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    // Check for inviteToken in URL params
    const token = searchParams.get('inviteToken');
    if (token) {
      setInviteToken(token);
      fetchInviteInfo(token);
    }
  }, [searchParams]);

  const fetchInviteInfo = async (token) => {
    try {
      const response = await api.get(`/households/invite-info/${token}`);
      setInviteInfo(response.data);
    } catch (err) {
      console.error('Failed to fetch invite info:', err);
      setError('Invalid or expired invite link');
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
      const { data } = await api.post('/auth/login', form);
      console.log('Login successful:', data);

      if (data.mfaRequired) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      // The backend returns accessToken and refreshToken
      // Pass pending invites to auth context
      login(data.user, data.accessToken, data.pendingInvites || []);
      
      // Store refreshToken separately for token rotation
      localStorage.setItem('refreshToken', data.refreshToken);

      // If there's an invite token, accept it automatically
      if (inviteToken) {
        try {
          const inviteResult = await api.post(`/households/invite/accept/${inviteToken}`);
          console.log('Invite accepted automatically:', inviteResult.data);
          // Update user with new household if available
          if (inviteResult.data.household) {
            login(inviteResult.data.user || data.user, data.accessToken, []);
          }
        } catch (inviteErr) {
          console.warn('Auto-accept failed:', inviteErr);
        }
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { ...form, mfaToken });
      login(data.user, data.accessToken, data.pendingInvites || []);
      localStorage.setItem('refreshToken', data.refreshToken);
      if (inviteToken) {
        try {
          const inviteResult = await api.post(`/households/invite/accept/${inviteToken}`);
          if (inviteResult.data.household) {
            login(inviteResult.data.user || data.user, data.accessToken, []);
          }
        } catch (inviteErr) {
          console.warn('Auto-accept failed:', inviteErr);
        }
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid MFA code');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: options } = await api.post('/auth/passkey/login/start', { email: form.email });
      const { challengeUserId, ...authOptions } = options;
      const credential = await startAuthentication({ optionsJSON: authOptions });
      const { data } = await api.post('/auth/passkey/login/finish', { ...credential, challengeUserId });
      login(data.user, data.accessToken, data.pendingInvites || []);
      localStorage.setItem('refreshToken', data.refreshToken);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Passkey sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Household Budget</h1>

        {mfaRequired ? (
          <form onSubmit={handleMfaSubmit} className="space-y-4 mt-6">
            <div className="text-center">
              <div className="text-4xl mb-2">🔐</div>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Two-Factor Authentication</h2>
              <p className="text-sm text-gray-500">Enter the 6-digit code from your authenticator app.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Authentication Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={mfaToken}
                onChange={e => setMfaToken(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                placeholder="000000"
                required
                autoFocus
              />
            </div>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">{error}</div>}
            <button
              type="submit"
              disabled={loading || mfaToken.length !== 6}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setMfaRequired(false); setMfaToken(''); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition"
            >
              ← Back to login
            </button>
          </form>
        ) : (
          <>
            {inviteInfo && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">✉️ You have an invitation!</p>
                <p className="text-xs text-green-600 mt-2">
                  <strong>From:</strong> {inviteInfo.invitedByName}
                </p>
                <p className="text-xs text-green-600">
                  <strong>Household:</strong> {inviteInfo.householdName}
                </p>
                <p className="text-xs text-green-600 mt-2">Log in below and you'll automatically be added to this household!</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
              </div>

              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <div className="flex items-center gap-3 my-1">
                <hr className="flex-1 border-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <hr className="flex-1 border-gray-200" />
              </div>

              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {loading ? 'Waiting...' : 'Sign in with Passkey'}
              </button>
            </form>

            <p className="text-center text-gray-600 mt-4">
              Don't have an account? <Link to="/register" className="text-blue-500 hover:underline">Register</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
