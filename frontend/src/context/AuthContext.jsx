import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    async function initAuth() {
      const savedToken = localStorage.getItem('technova_jwt_token');
      const savedUser = localStorage.getItem('technova_current_user');

      if (savedToken) {
        try {
          if (savedUser) {
            setUser(JSON.parse(savedUser));
          }
          setToken(savedToken);
          const me = await api.getCurrentUser();
          setUser(me);
          localStorage.setItem('technova_current_user', JSON.stringify(me));
        } catch (err) {
          console.warn('Session expired or invalid, signing out:', err);
          api.logout();
          setUser(null);
          setToken(null);
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  const login = useCallback(async (username, password) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      const res = await api.login(username.trim().toLowerCase(), password);
      setUser(res.user);
      setToken(res.access_token);
      return res;
    } catch (err) {
      const errorMsg = err.message || 'Authentication failed. Please verify credentials.';
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
    setToken(null);
    setAuthError(null);
  }, []);

  const isAdmin = user?.role === 'administrator';
  const isHR = user?.role === 'hr';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  const canUpload = isAdmin || isHR;
  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        submitting,
        authError,
        isAuthenticated,
        login,
        logout,
        isAdmin,
        isHR,
        isManager,
        isEmployee,
        canUpload,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
