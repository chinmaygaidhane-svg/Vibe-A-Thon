import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('aidflow_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('aidflow_token') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Token expired');
        })
        .then(data => {
          setUser(data.user);
          localStorage.setItem('aidflow_user', JSON.stringify(data.user));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('aidflow_token', newToken);
    localStorage.setItem('aidflow_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('aidflow_token');
    localStorage.removeItem('aidflow_user');
  };

  const switchDemoRole = async (demoRole) => {
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole })
      });
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
        return { success: true, user: data.user };
      } else {
        alert(data.error || 'Failed to switch role');
        return { success: false };
      }
    } catch (err) {
      console.error(err);
      return { success: false };
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, switchDemoRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
