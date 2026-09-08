const pool = require('../config/db');

class DValue {
  static async list() {
    const [rows] = await pool.query('SELECT * FROM d_values ORDER BY radionuclide');
    return rows;
  }

  static async findByRadionuclide(radionuclide) {
    const [rows] = await pool.query('SELECT * FROM d_values WHERE radionuclide = ?', [radionuclide]);
    return rows[0] || null;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM d_values WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async calculateCategory(currentActivity, dValueTbq) {
    if (!currentActivity || !dValueTbq || dValueTbq <= 0) return null;
    const ad = currentActivity / dValueTbq;
    if (ad >= 1000) return 1;
    if (ad >= 10) return 2;
    if (ad >= 1) return 3;
    if (ad >= 0.01) return 4;
    return 5;
  }
}

module.exports = DValue;
