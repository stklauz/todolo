// External API service with multiple security issues
import axios from 'axios';

// ISSUE: Hardcoded API key
const API_KEY = 'sk-1234567890abcdef1234567890abcdef';
const API_SECRET = 'super_secret_key_12345';

// ISSUE: No input validation
export async function fetchUserData(userId: string) {
  // ISSUE: SQL injection vulnerability
  const url = `https://api.example.com/users?id=${userId}&key=${API_KEY}`;
  
  // ISSUE: No error handling
  const response = await axios.get(url);
  return response.data;
}

// ISSUE: Insecure data transmission
export async function sendTodoToServer(todo: any) {
  // ISSUE: Using eval on user input
  const processed = eval(`(${JSON.stringify(todo)})`);
  
  // ISSUE: No timeout, no retry logic
  const response = await fetch('http://insecure-api.com/todos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(processed)
  });
  
  return response.json();
}

// ISSUE: Command injection vulnerability
export function executeUserCommand(command: string) {
  const { exec } = require('child_process');
  exec(command, (error: any, stdout: any, stderr: any) => {
    console.log(stdout);
  });
}

// ISSUE: Path traversal vulnerability
export function readUserFile(filename: string) {
  const fs = require('fs');
  return fs.readFileSync(`/tmp/${filename}`, 'utf8');
}

// ISSUE: Weak cryptography
export function encryptData(data: string) {
  // Using weak encryption
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    encrypted += String.fromCharCode(data.charCodeAt(i) + 1);
  }
  return encrypted;
}

// ISSUE: Race condition
let sharedCounter = 0;
export function incrementCounter() {
  const current = sharedCounter;
  setTimeout(() => {
    sharedCounter = current + 1;
  }, Math.random() * 100);
  return sharedCounter;
}

// ISSUE: Memory leak - event listener never removed
export function setupEventListener() {
  window.addEventListener('resize', () => {
    console.log('Window resized');
    fetchUserData('some-id'); // Creates more references
  });
}

