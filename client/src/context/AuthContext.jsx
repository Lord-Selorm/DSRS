import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('dsrs_user') || 'null'));
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('dsrs_token', data.token);
      localStorage.setItem('dsrs_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('dsrs_token');
    localStorage.removeItem('dsrs_user');
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('dsrs_token');
    const storedUser = localStorage.getItem('dsrs_user');
    if (token && !storedUser) {
      api.get('/auth/me').then(({ data }) => setUser(data)).catch(() => logout());
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);