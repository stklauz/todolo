// Utility functions with security vulnerabilities

// ISSUE: Weak random number generation
export function generateRandomId() {
  return Math.random().toString(36).substring(2, 15);
}

// ISSUE: Client-side validation only
export function validateEmail(email: string) {
  return email.includes('@');
}

// ISSUE: Insecure password validation
export function validatePassword(password: string) {
  return password.length >= 4; // Too weak
}

// ISSUE: No sanitization
export function sanitizeInput(input: string) {
  return input; // Does nothing
}

// ISSUE: Insecure token storage
export function storeAuthToken(token: string) {
  localStorage.setItem('authToken', token);
  localStorage.setItem('tokenTimestamp', Date.now().toString());
  // No encryption, no expiry check
}

// ISSUE: Predictable session ID
export function generateSessionId() {
  return `session_${Date.now()}_${Math.random()}`;
}

// ISSUE: Weak hash function
export function hashPassword(password: string) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

// ISSUE: XSS vulnerability
export function renderHTML(html: string) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

// ISSUE: No rate limiting helper
export function checkRateLimit(userId: string) {
  return true; // Always allows
}

// ISSUE: Insecure data comparison
export function comparePasswords(input: string, stored: string) {
  return input === stored; // Timing attack vulnerable
}

// ISSUE: No CSRF token validation
export function validateCSRFToken(token: string) {
  return true; // Always valid
}

// ISSUE: Insecure random token
export function generateResetToken() {
  return Math.random().toString(36);
}

// ISSUE: Directory traversal helper
export function buildFilePath(userInput: string) {
  return `/data/${userInput}`; // No path validation
}

// ISSUE: SQL injection helper
export function buildQuery(userInput: string) {
  return `SELECT * FROM users WHERE username = '${userInput}'`;
}

// ISSUE: Weak encryption
export function encryptString(text: string, key: string) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(result);
}

// ISSUE: No input length validation
export function processUserInput(input: string) {
  // Could cause DoS with very long strings
  return input.repeat(1000);
}

// ISSUE: Insecure cookie handling
export function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}`; // No secure, httpOnly, sameSite flags
}

// ISSUE: Reflected XSS vulnerability
export function displayUserMessage(message: string) {
  return `<div class="message">${message}</div>`;
}

