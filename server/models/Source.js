const pool = require('../config/db');
const DValue = require('./DValue');

const UNIT_TO_TBQ = {
  TBq: 1,
  GBq: 1e-3,
  MBq: 1e-6,
  kBq: 1e-9,
  Bq: 1e-12,
  Ci: 3.7e-2,
  mCi: 3.7e-5,
  uCi: 3.7e-8,
};

function toTbq(activity, unit) {
  if (!activity || !unit) return null;
  return activity * (UNIT_TO_TBQ[unit] || 0);
}

class Source {
  static readonlyFields = ['id', 'created_at', 'updated_at', 'source_classification', 'created_by'];

  static async create(data, userId) {
    const dValue = await DValue.findById(data.radionuclide_id);
    if (!dValue) throw new Error(`Invalid radionuclide_id: ${data.radionuclide_id}`);

    const currentTbq = toTbq(data.current_activity, data.current_activity_unit);
    const classification = await DValue.calculateCategory(currentTbq, dValue.d_value_tbq);

    const [result] = await pool.query(
      `INSERT INTO sources SET ?`,
      [{ ...data, source_classification: classification, created_by: userId }]
    );
    return result.insertId;
  }

  static async update(id, data, userId) {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Source not found');

    const updateFields = { ...data };
    delete updateFields.source_classification;

    // Recalculate classification if activity or radionuclide changed
    if (data.current_activity !== undefined || data.radionuclide_id !== undefined ||
        data.current_activity_unit !== undefined) {
      const dValue = await DValue.findById(data.radionuclide_id || existing.radionuclide_id);
      const activity = data.current_activity !== undefined ? data.current_activity : existing.current_activity;
      const unit = data.current_activity_unit || existing.current_activity_unit;
      updateFields.source_classification = await DValue.calculateCategory(toTbq(activity, unit), dValue.d_value_tbq);
    }

    // Build audit log
    const historyRows = [];
    for (const [key, newVal] of Object.entries(updateFields)) {
      if (key === 'updated_at' || key === 'source_classification') {
        if (key === 'source_classification' && existing.source_classification !== newVal) {
          historyRows.push(['source_classification', existing.source_classification, newVal]);
        }
        continue;
      }
      const oldVal = existing[key];
      if (oldVal !== newVal && oldVal !== undefined) {
        historyRows.push([key, oldVal, newVal]);
      }
    }

    await pool.query('UPDATE sources SET ? WHERE id = ?', [updateFields, id]);

    if (historyRows.length > 0) {
      const stmt = 'INSERT INTO source_history (source_id, changed_by, change_type, field_changed, previous_value, new_value) VALUES ?';
      const values = historyRows.map(([field, oldV, newV]) => [id, userId, 'update', field, String(oldV), String(newV)]);
      await pool.query(stmt, [values]);
    }

    return { id, changed_fields: historyRows.length };
  }

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT s.*, d.radionuclide, d.d_value_tbq,
              o.name AS original_owner_name, c.name AS current_owner_name
       FROM sources s
       JOIN d_values d ON s.radionuclide_id = d.id
       LEFT JOIN institutions o ON s.original_owner_id = o.id
       LEFT JOIN institutions c ON s.current_owner_id = c.id
       WHERE s.id = ?`, [id]
    );
    return rows[0] || null;
  }

  static async search(filters = {}, pagination = {}) {
    const where = [];
    const values = [];

    const strFields = [
      'device_serial_no', 'source_serial_no', 'nra_registration_no', 'source_barcode', 'no_on_source',
      'manufacturer', 'source_certificate_no', 'storage_facility_unit', 'storage_cage_address',
      'responsible_officer', 'transporter', 'current_application', 'original_application',
      'capsule_no_id', 'concrete_drum_no', 'leak_test_instrument_used'
    ];
    for (const field of strFields) {
      if (filters[field]) {
        where.push(`s.${field} LIKE ?`);
        values.push(`%${filters[field]}%`);
      }
    }

    if (filters.radionuclide) {
      where.push('d.radionuclide LIKE ?');
      values.push(`%${filters.radionuclide}%`);
    }
    if (filters.source_classification) {
      where.push('s.source_classification = ?');
      values.push(filters.source_classification);
    }
    if (filters.current_owner_id) {
      where.push('s.current_owner_id = ?');
      values.push(filters.current_owner_id);
    }
    if (filters.conditioning_status) {
      where.push('s.conditioning_status = ?');
      values.push(filters.conditioning_status);
    }
    if (filters.contamination_status) {
      where.push('s.contamination_status = ?');
      values.push(filters.contamination_status);
    }
    if (filters.min_activity) {
      where.push('s.current_activity >= ?');
      values.push(filters.min_activity);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = pagination.limit || 50;
    const offset = pagination.offset || 0;

    const [rows] = await pool.query(
      `SELECT s.*, d.radionuclide, d.d_value_tbq,
              o.name AS original_owner_name, c.name AS current_owner_name
       FROM sources s
       JOIN d_values d ON s.radionuclide_id = d.id
       LEFT JOIN institutions o ON s.original_owner_id = o.id
       LEFT JOIN institutions c ON s.current_owner_id = c.id
       ${whereSql}
       ORDER BY s.id DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM sources s JOIN d_values d ON s.radionuclide_id = d.id ${whereSql}`,
      values
    );

    return { rows, total: countRows[0].total };
  }

  static async history(sourceId) {
    const [rows] = await pool.query(
      `SELECT h.*, u.full_name AS changed_by_name
       FROM source_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.source_id = ?
       ORDER BY h.changed_at DESC`, [sourceId]
    );
    return rows;
  }

  static async updatePhoto(id, photoPath, userId) {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Source not found');
    await pool.query('UPDATE sources SET photo_path = ? WHERE id = ?', [photoPath, id]);
    await pool.query(
      'INSERT INTO source_history (source_id, changed_by, change_type, field_changed, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, 'update', 'photo_path', existing.photo_path || null, photoPath]
    );
  }

  static async addMeasurement(sourceId, data, userId) {
    const [result] = await pool.query('INSERT INTO source_measurements SET ?', { ...data, source_id: sourceId });
    await pool.query(
      'INSERT INTO source_history (source_id, changed_by, change_type, field_changed, previous_value, new_value, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sourceId, userId, 'measurement', 'dose_rate_at_1m', null, String(data.dose_rate_at_1m), `Measurement on ${data.measurement_date}`]
    );
    return result.insertId;
  }

  static async measurements(sourceId) {
    const [rows] = await pool.query('SELECT * FROM source_measurements WHERE source_id = ? ORDER BY measurement_date DESC', [sourceId]);
    return rows;
  }

  static async addLeakTest(sourceId, data, userId) {
    const [result] = await pool.query('INSERT INTO source_leak_tests SET ?', { ...data, source_id: sourceId });
    await pool.query(
      'INSERT INTO source_history (source_id, changed_by, change_type, field_changed, previous_value, new_value, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sourceId, userId, 'leak_test', 'leak_test_result', null, String(data.leak_test_result), `Leak test on ${data.leak_test_date}`]
    );
    await pool.query(
      'UPDATE sources SET leak_test_method = ?, leak_test_result = ?, leak_test_date = ?, leak_test_instrument_used = ?, leak_test_instrument_calibration_due_date = ? WHERE id = ?',
      [data.leak_test_method || null, data.leak_test_result || 'pending', data.leak_test_date || null,
       data.leak_test_instrument_used || null, data.leak_test_instrument_calibration_due_date || null, sourceId]
    );
    return result.insertId;
  }

  static async leakTests(sourceId) {
    const [rows] = await pool.query('SELECT * FROM source_leak_tests WHERE source_id = ? ORDER BY leak_test_date DESC', [sourceId]);
    return rows;
  }

  static async stats() {
    const [byLocation] = await pool.query(
      `SELECT storage_facility_unit, storage_cage_address, COUNT(*) AS count
       FROM sources GROUP BY storage_facility_unit, storage_cage_address ORDER BY count DESC`
    );
    const [byClassification] = await pool.query(
      `SELECT source_classification, COUNT(*) AS count FROM sources GROUP BY source_classification ORDER BY source_classification`
    );
    const [byConditioning] = await pool.query(
      `SELECT conditioning_status, COUNT(*) AS count FROM sources GROUP BY conditioning_status`
    );
    const [byOwner] = await pool.query(
      `SELECT c.name AS owner, COUNT(*) AS count FROM sources s LEFT JOIN institutions c ON s.current_owner_id = c.id GROUP BY c.name ORDER BY count DESC`
    );
    const [total] = await pool.query(`SELECT COUNT(*) AS total FROM sources`);
    return {
      total: total[0].total,
      byLocation,
      byClassification,
      byConditioning,
      byOwner,
    };
  }
}

module.exports = Source;