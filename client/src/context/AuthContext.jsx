import { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedInvites = localStorage.getItem('pendingInvites');
    console.log('[AuthContext] Loading from localStorage:', { hasUser: !!savedUser, hasToken: !!savedToken });
    if (savedToken && savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
      const parsed = JSON.parse(savedUser);
      console.log('[AuthContext] Parsed user:', { userId: parsed.userId, householdId: parsed.householdId, householdName: parsed.householdName });
      setToken(savedToken);
      setUser(parsed);
      if (savedInvites) {
        setPendingInvites(JSON.parse(savedInvites));
      }
    } else {
      console.log('[AuthContext] No saved token or user, setting loading to false');
    }
    setLoading(false);
  }, []);

  const login = (userData, authToken, invites = []) => {
    console.log('[AuthContext] Login called with:', { userData, hasToken: !!authToken });
    setUser(userData);
    setToken(authToken);
    setPendingInvites(invites || []);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('pendingInvites', JSON.stringify(invites || []));
    console.log('[AuthContext] Login complete, isAuthenticated:', !!authToken);
  };

  const switchHousehold = async (householdId, householdName) => {
    if (!user || !token) return null;

    console.log('[Auth] Switching household:', {
      fromHouseholdId: user.householdId,
      toHouseholdId: householdId,
      householdName,
    });

    const response = await api.post('/auth/switch-household', { householdId });
    const nextUser = response.data?.user || {
      ...user,
      householdId,
      householdName,
    };
    const nextToken = response.data?.accessToken || token;

    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem('user', JSON.stringify(nextUser));
    localStorage.setItem('token', nextToken);

    return nextUser;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setPendingInvites([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('pendingInvites');
  };

  const updateUser = (updatedFields) => {
    const updated = { ...user, ...updatedFields };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, token, pendingInvites, loading, login, logout, switchHousehold, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}
