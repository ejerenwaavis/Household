import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

export default function ProfileSettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaStep, setMfaStep] = useState('idle'); // 'idle' | 'setup' | 'disable'
  const [mfaQR, setMfaQR] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [mfaMsg, setMfaMsg] = useState('');
  const [mfaErr, setMfaErr] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/mfa/status')
      .then(({ data }) => setMfaEnabled(data.mfaEnabled))
      .catch(() => {});
    api.get('/auth/passkey/list')
      .then(({ data }) => setPasskeys(data))
      .catch(() => {});
  }, []);

  // Passkey state
  const [passkeys, setPasskeys] = useState([]);
  const [passkeyName, setPasskeyName] = useState('');
  const [passkeyStep, setPasskeyStep] = useState('idle'); // 'idle' | 'naming'
  const [passkeyMsg, setPasskeyMsg] = useState('');
  const [passkeyErr, setPasskeyErr] = useState('');
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    if (!name.trim()) { setProfileErr('Name cannot be empty'); return; }
    setProfileLoading(true);
    try {
      await api.patch('/auth/profile', { name: name.trim() });
      updateUser({ name: name.trim() });
      setProfileMsg('Name updated successfully.');
    } catch (err) {
      setProfileErr(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');
    if (newPassword !== confirmPassword) { setPasswordErr('New passwords do not match'); return; }
    if (newPassword.length < 8) { setPasswordErr('New password must be at least 8 characters'); return; }
    setPasswordLoading(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword });
      setPasswordMsg('Password changed. You will be logged out now.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Invalidate session – server rotated token version
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 1800);
    } catch (err) {
      setPasswordErr(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleMfaSetup = async () => {
    setMfaErr(''); setMfaMsg(''); setMfaLoading(true);
    try {
      const { data } = await api.post('/auth/mfa/setup');
      setMfaQR(data.qrCode);
      setMfaStep('setup');
    } catch (err) {
      setMfaErr(err.response?.data?.error || 'Failed to start MFA setup');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setMfaErr(''); setMfaLoading(true);
    try {
      await api.post('/auth/mfa/verify', { token: mfaToken });
      setMfaEnabled(true);
      setMfaStep('idle');
      setMfaQR('');
      setMfaToken('');
      setMfaMsg('Two-factor authentication is now enabled.');
    } catch (err) {
      setMfaErr(err.response?.data?.error || 'Invalid code, please try again');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaDisable = async (e) => {
    e.preventDefault();
    setMfaErr(''); setMfaLoading(true);
    try {
      await api.post('/auth/mfa/disable', { password: mfaDisablePassword });
      setMfaEnabled(false);
      setMfaStep('idle');
      setMfaDisablePassword('');
      setMfaMsg('Two-factor authentication has been disabled.');
    } catch (err) {
      setMfaErr(err.response?.data?.error || 'Failed to disable MFA');
    } finally {
      setMfaLoading(false);
    }
  };

  const handlePasskeyRegister = async () => {
    setPasskeyErr(''); setPasskeyMsg(''); setPasskeyLoading(true);
    try {
      const { data: options } = await api.post('/auth/passkey/register/start');
      const credential = await startRegistration({ optionsJSON: options });
      await api.post('/auth/passkey/register/finish', { ...credential, name: passkeyName || 'Passkey' });
      const { data } = await api.get('/auth/passkey/list');
      setPasskeys(data);
      setPasskeyStep('idle');
      setPasskeyName('');
      setPasskeyMsg('Passkey registered successfully.');
    } catch (err) {
      setPasskeyErr(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handlePasskeyDelete = async (credentialID) => {
    setPasskeyErr(''); setPasskeyMsg('');
    try {
      await api.delete(`/auth/passkey/${encodeURIComponent(credentialID)}`);
      setPasskeys(prev => prev.filter(pk => pk.credentialID !== credentialID));
      setPasskeyMsg('Passkey removed.');
    } catch (err) {
      setPasskeyErr(err.response?.data?.error || 'Failed to remove passkey');
    }
  };

  const initials = (user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your profile and security preferences</p>
        </div>

        {/* Avatar + account info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-yellow-400 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{user?.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</div>
            <div className="mt-1 flex gap-2 flex-wrap">
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full capitalize">{user?.role || 'member'}</span>
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">🏠 {user?.householdName || 'Household'}</span>
            </div>
          </div>
        </div>

        {/* Update Name */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Profile Information
          </h2>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed.</p>
            </div>
            {profileMsg && <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">{profileMsg}</div>}
            {profileErr && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{profileErr}</div>}
            <button
              type="submit"
              disabled={profileLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {profileLoading ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Change Password
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 pr-10"
                  placeholder="Enter current password"
                />
                <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  {showCurrentPw
                    ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 pr-10"
                  placeholder="At least 8 characters"
                />
                <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  {showNewPw
                    ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
              {newPassword && (
                <div className="mt-1.5 flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      newPassword.length >= (i + 1) * 2
                        ? newPassword.length < 8 ? 'bg-red-400' : newPassword.length < 12 ? 'bg-yellow-400' : 'bg-green-500'
                        : 'bg-gray-200 dark:bg-gray-600'
                    }`} />
                  ))}
                  <span className="text-xs text-gray-400 ml-1">
                    {newPassword.length < 8 ? 'Too short' : newPassword.length < 12 ? 'Good' : 'Strong'}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                  confirmPassword && confirmPassword !== newPassword
                    ? 'border-red-400 dark:border-red-500'
                    : 'border-gray-200 dark:border-gray-600'
                }`}
                placeholder="Repeat new password"
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
              )}
            </div>
            {passwordMsg && <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">{passwordMsg}</div>}
            {passwordErr && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{passwordErr}</div>}
            <button
              type="submit"
              disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {passwordLoading ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Two-Factor Authentication */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Two-Factor Authentication
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Use an authenticator app (Google Authenticator, Authy, etc.) to add an extra layer of security.
          </p>
          {mfaMsg && <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg mb-3">{mfaMsg}</div>}
          {mfaErr && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-3">{mfaErr}</div>}

          {mfaEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  MFA Active
                </span>
              </div>
              {mfaStep !== 'disable' ? (
                <button
                  type="button"
                  onClick={() => { setMfaStep('disable'); setMfaErr(''); setMfaMsg(''); }}
                  className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  Disable MFA
                </button>
              ) : (
                <form onSubmit={handleMfaDisable} className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Enter your password to confirm disabling MFA:</p>
                  <input
                    type="password"
                    value={mfaDisablePassword}
                    onChange={e => setMfaDisablePassword(e.target.value)}
                    placeholder="Current password"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={mfaLoading || !mfaDisablePassword}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {mfaLoading ? 'Disabling…' : 'Confirm Disable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMfaStep('idle'); setMfaErr(''); setMfaDisablePassword(''); }}
                      className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {mfaStep === 'idle' && (
                <button
                  type="button"
                  onClick={handleMfaSetup}
                  disabled={mfaLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {mfaLoading ? 'Loading…' : 'Enable MFA'}
                </button>
              )}
              {mfaStep === 'setup' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
                  </p>
                  <img src={mfaQR} alt="MFA QR Code" className="w-40 h-40 border border-gray-200 dark:border-gray-600 rounded-lg" />
                  <form onSubmit={handleMfaVerify} className="space-y-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={mfaToken}
                      onChange={e => setMfaToken(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit code"
                      required
                      autoFocus
                      className="w-40 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={mfaLoading || mfaToken.length !== 6}
                        className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {mfaLoading ? 'Verifying…' : 'Verify & Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMfaStep('idle'); setMfaQR(''); setMfaToken(''); setMfaErr(''); }}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Passkeys */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Passkeys
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Sign in with Face ID, Touch ID, or Windows Hello — no password needed.
          </p>
          {passkeyMsg && <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg mb-3">{passkeyMsg}</div>}
          {passkeyErr && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-3">{passkeyErr}</div>}

          {passkeys.length > 0 && (
            <ul className="space-y-2 mb-4">
              {passkeys.map(pk => (
                <li key={pk.credentialID} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{pk.name}</p>
                      <p className="text-xs text-gray-400">{pk.deviceType === 'multiDevice' ? 'Synced (iCloud/Google)' : 'Device-bound'} · Added {new Date(pk.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePasskeyDelete(pk.credentialID)}
                    className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {passkeyStep === 'idle' ? (
            <button
              type="button"
              onClick={() => { setPasskeyStep('naming'); setPasskeyErr(''); setPasskeyMsg(''); }}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Add Passkey
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Give this passkey a name (e.g. "MacBook", "iPhone"):</p>
              <input
                type="text"
                value={passkeyName}
                onChange={e => setPasskeyName(e.target.value)}
                placeholder="My Passkey"
                maxLength={40}
                className="w-full sm:w-64 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePasskeyRegister}
                  disabled={passkeyLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {passkeyLoading ? 'Waiting for device…' : 'Register Passkey'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPasskeyStep('idle'); setPasskeyName(''); setPasskeyErr(''); }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Account Info (read-only) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Account Info
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">User ID</dt>
              <dd className="text-gray-700 dark:text-gray-300 font-mono text-xs">{user?.userId?.slice(0, 16)}…</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Household</dt>
              <dd className="text-gray-700 dark:text-gray-300">{user?.householdName || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Role</dt>
              <dd className="text-gray-700 dark:text-gray-300 capitalize">{user?.role || 'member'}</dd>
            </div>
          </dl>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/40 p-6">
          <h2 className="text-base font-semibold text-red-600 dark:text-red-400 mb-3">Sign Out</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This will clear your session on this device.</p>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="px-5 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-sm font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          >
            Sign Out
          </button>
        </div>

      </div>
    </Layout>
  );
}
