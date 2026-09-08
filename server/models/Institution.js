const pool = require('../config/db');

class Institution {
  static async list() {
    const [rows] = await pool.query('SELECT * FROM institutions WHERE is_active = 1 ORDER BY name');
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM institutions WHERE id = ?', [id]);
    return rows[0] || null;
  }

static async create(data) {
    const { name, code, address, contact_person, contact_phone, contact_email, license_number, rpo_rpe_name } = data;
    const [result] = await pool.query(
      'INSERT INTO institutions (name, code, address, contact_person, contact_phone, contact_email, license_number, rpo_rpe_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, code, address, contact_person, contact_phone, contact_email, license_number, rpo_rpe_name]
    );
    return result.insertId;
  }

  static async update(id, fields) {
    const allowed = ['name', 'code', 'address', 'contact_person', 'contact_phone', 'contact_email', 'license_number', 'rpo_rpe_name', 'is_active'];
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
    await pool.query(`UPDATE institutions SET ${updates.join(', ')} WHERE id = ?`, values);
    return true;
  }

  static async delete(id) {
    await pool.query('UPDATE institutions SET is_active = 0 WHERE id = ?', [id]);
  }
}

module.exports = Institution;
