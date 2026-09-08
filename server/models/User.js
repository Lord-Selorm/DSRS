const pool = require('../config/db');

class User {
  static async findByUsername(username) {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT id, username, full_name, email, role, is_active FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create({ username, password_hash, full_name, email, role }) {
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)',
      [username, password_hash, full_name, email, role || 'operator']
    );
    return result.insertId;
  }

  static async update(id, fields) {
    const allowed = ['full_name', 'email', 'role', 'is_active', 'password_hash'];
    const updates = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key) && val !== undefined) {
        updates.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (updates.length === 0) return false;
    values.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    return true;
  }

  static async list() {
    const [rows] = await pool.query('SELECT id, username, full_name, email, role, is_active, created_at FROM users');
    return rows;
  }
}

module.exports = User;
