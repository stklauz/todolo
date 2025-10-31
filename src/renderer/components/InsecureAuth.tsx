// Authentication component with security issues
import React, { useState } from 'react';

export function InsecureAuth() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // ISSUE: Weak authentication logic
  const handleLogin = () => {
    // ISSUE: Client-side authentication only
    if (username === 'admin' && password === 'admin123') {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('password', password); // ISSUE: Storing password in localStorage
      return true;
    }
    return false;
  };
  
  // ISSUE: No rate limiting, brute force vulnerable
  const attemptLogin = async () => {
    // ISSUE: Sending password in GET request
    const response = await fetch(`/api/login?username=${username}&password=${password}`);
    return response.json();
  };
  
  // ISSUE: Weak session management
  const createSession = () => {
    const sessionId = Math.random().toString(); // ISSUE: Predictable session ID
    localStorage.setItem('sessionId', sessionId);
    // ISSUE: No expiration
    localStorage.setItem('sessionExpiry', 'never');
  };
  
  // ISSUE: No CSRF protection
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // ISSUE: No input validation
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    // ISSUE: Insecure transmission
    fetch('http://example.com/login', {
      method: 'POST',
      body: formData
    });
  };
  
  // ISSUE: Exposing credentials in URL
  const resetPassword = (email: string, newPassword: string) => {
    window.location.href = `/reset?email=${email}&newPassword=${newPassword}`;
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="text" 
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        // ISSUE: Autocomplete enabled for username
        autoComplete="username"
      />
      <input 
        type="text" // ISSUE: Password field as text
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        // ISSUE: Autocomplete enabled for password
        autoComplete="current-password"
      />
      <button type="submit">Login</button>
    </form>
  );
}

// ISSUE: Hardcoded credentials
export const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'Admin123!',
  apiKey: 'sk-admin-key-12345',
  secretToken: 'very-secret-token'
};

// ISSUE: Weak token generation
export function generateAuthToken() {
  return Math.random().toString(36).substring(2);
}

