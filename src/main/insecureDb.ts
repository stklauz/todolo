// Database operations with SQL injection vulnerabilities
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

export function initializeInsecureDb() {
  const dbPath = path.join(app.getPath('userData'), 'insecure.db');
  db = new Database(dbPath);
  
  // ISSUE: SQL injection vulnerability in table creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_data (
      id INTEGER PRIMARY KEY,
      username TEXT,
      password TEXT,
      email TEXT,
      api_key TEXT
    )
  `);
}

// ISSUE: SQL injection vulnerability
export function getUserByUsername(username: string) {
  const query = `SELECT * FROM user_data WHERE username = '${username}'`;
  return db.prepare(query).all();
}

// ISSUE: Storing passwords in plain text
export function createUser(username: string, password: string, email: string) {
  const apiKey = Math.random().toString(36).substring(7);
  const query = `INSERT INTO user_data (username, password, email, api_key) VALUES ('${username}', '${password}', '${email}', '${apiKey}')`;
  return db.prepare(query).run();
}

// ISSUE: No input sanitization, SQL injection
export function searchUsers(searchTerm: string) {
  const query = `SELECT * FROM user_data WHERE username LIKE '%${searchTerm}%' OR email LIKE '%${searchTerm}%'`;
  return db.prepare(query).all();
}

// ISSUE: Exposing sensitive data
export function getAllUsersWithSecrets() {
  return db.prepare('SELECT * FROM user_data').all();
}

// ISSUE: No transaction safety
export function bulkUpdateUsers(updates: Array<{id: number, username: string}>) {
  updates.forEach(update => {
    db.prepare(`UPDATE user_data SET username = '${update.username}' WHERE id = ${update.id}`).run();
  });
}

// ISSUE: Direct string concatenation in SQL
export function deleteUsersByEmail(email: string) {
  const query = "DELETE FROM user_data WHERE email = '" + email + "'";
  db.prepare(query).run();
}

// ISSUE: No prepared statements
export function updatePassword(userId: number, newPassword: string) {
  db.exec(`UPDATE user_data SET password = '${newPassword}' WHERE id = ${userId}`);
}

