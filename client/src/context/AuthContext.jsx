import { createContext, useState, useEffect } from 'react';

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
    if (savedToken && savedUser) {
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

  const switchHousehold = (householdId, householdName) => {
    if (user) {
      const updatedUser = {
        ...user,
        householdId,
        householdName
      };
      console.log('[Auth] BEFORE switchHousehold - user:', { currentHouseholdId: user.householdId, currentHouseholdName: user.householdName });
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      const verify = localStorage.getItem('user');
      console.log('[Auth] AFTER switchHousehold - localStorage:', { householdId, householdName, storedUser: JSON.parse(verify) });
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setPendingInvites([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('pendingInvites');
  };

  return (
    <AuthContext.Provider value={{ user, token, pendingInvites, loading, login, logout, switchHousehold, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}
