/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const API_URL = 'http://localhost:5000/api';
const AuthContext = createContext();

const normalizeRole = (role) => {
  if (!role) return 'candidate';
  const r = String(role).trim().toLowerCase();
  if (r === 'hr') return 'hr';
  if (r === 'hiring_manager') return 'hiring_manager';
  if (r === 'manager' || r === 'executive manager') return 'manager';
  if (r === 'interviewer') return 'interviewer';
  return 'candidate';
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userProfileId, setUserProfileId] = useState(null);
  const [userName, setUserName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // On mount, check if a token is stored and restore the session
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('hirezone_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Token expired');
        const user = await res.json();
        setCurrentUser({ uid: user.id, email: user.email });
        setUserRole(normalizeRole(user.role));
        setUserProfileId(user.id);
        setUserName(user.name);
      } catch {
        // Token is invalid or expired — clear it
        localStorage.removeItem('hirezone_token');
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (email, password) => {
    const cleanEmail = String(email || '').trim();
    const cleanPassword = String(password || '');

    if (!cleanEmail || !cleanPassword) {
      const msg = 'Please enter your email and password.';
      setAuthError(msg);
      throw new Error(msg);
    }

    setAuthError('');

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || 'Login failed. Please try again.';
        setAuthError(msg);
        throw new Error(msg);
      }

      // Store the JWT token securely in localStorage
      localStorage.setItem('hirezone_token', data.token);

      const role = normalizeRole(data.user.role);
      try {
        sessionStorage.setItem('hirezone-selected-role', role);
        localStorage.setItem('hirezone-selected-role', role);
      } catch { /* no-op */ }

      setCurrentUser({ uid: data.user.id, email: data.user.email });
      setUserRole(role);
      setUserProfileId(data.user.id);
      setUserName(data.user.name);

      return data.user;
    } catch (error) {
      if (!authError) setAuthError(error.message);
      throw error;
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    setUserRole(null);
    setUserProfileId(null);
    setUserName(null);
    setAuthError('');
    try {
      localStorage.removeItem('hirezone_token');
      sessionStorage.removeItem('hirezone-selected-role');
      localStorage.removeItem('hirezone-selected-role');
    } catch { /* no-op */ }
  };

  const value = useMemo(
    () => ({ currentUser, userRole, userProfileId, userName, loading, authError, login, logout }),
    [currentUser, userRole, userProfileId, userName, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);