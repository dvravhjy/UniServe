import { createContext, useContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('uniserve_user')); } catch { return null; }
  });

  const save = (data) => {
    localStorage.setItem('uniserve_token', data.token);
    localStorage.setItem('uniserve_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const login = async (email, password) => save((await api.post('/auth/login', { email, password })).data);
  const logout = () => {
    localStorage.removeItem('uniserve_token');
    localStorage.removeItem('uniserve_user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
