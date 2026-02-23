import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

export default function RegisterPage() {
  const [registrationType, setRegistrationType] = useState('create'); // 'create' or 'join'
  const [form, setForm] = useState({ email: '', password: '', name: '', householdName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

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
        login(data.user, data.token);
        navigate('/dashboard');
      } else {
        // Register user without household, they'll join via invite
        const { data } = await api.post('/auth/register', {
          email: form.email,
          password: form.password,
          name: form.name,
          householdName: `${form.name}'s Household` // Temporary, will be replaced when they join
        });
        console.log('Registration successful:', data);
        login(data.user, data.token);
        // You might want to show a message about needing to use an invite link
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

        {/* Registration Type Selector */}
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

          {registrationType === 'create' && (
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
          )}

          {registrationType === 'join' && (
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
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : registrationType === 'create' ? 'Create Household' : 'Register'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-4">
          Already have an account? <Link to="/login" className="text-blue-500 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
