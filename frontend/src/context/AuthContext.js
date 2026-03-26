import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Check if user is already logged in from a previous session
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('worklink_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('worklink_token') || null;
  });

  // Called after successful login
  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('worklink_user', JSON.stringify(userData));
    localStorage.setItem('worklink_token', authToken);
  };

  // Called on logout
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('worklink_user');
    localStorage.removeItem('worklink_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook so any component can use auth easily
export const useAuth = () => useContext(AuthContext);