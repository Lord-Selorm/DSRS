const pool = require('../config/db');
const DValue = require('./DValue');
const { uuid } = require('../utils/uuid');

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

async function resolveOwnerId(name) {
  if (name == null || String(name).trim() === '') return null;
  const n = String(name).trim();
  const [rows] = await pool.query('SELECT id FROM institutions WHERE name = ? LIMIT 1', [n]);
  if (rows[0]) return rows[0].id;
  const [res] = await pool.query('INSERT INTO institutions (name) VALUES (?)', [n]);
  return res.insertId;
}

class Source {
  static readonlyFields = ['id', 'created_at', 'updated_at', 'source_classification', 'created_by'];

  // Normalizes a create/update payload: empty strings become NULL (strict SQL mode
  // rejects '' for DATE/DECIMAL columns), and free-text owner names are resolved
  // to institution ids (auto-creating the institution when the name is new).
  static async sanitize(data) {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      out[k] = v === '' ? null : v;
    }
    if (out.original_owner_name !== undefined) {
      out.original_owner_id = await resolveOwnerId(out.original_owner_name);
      delete out.original_owner_name;
    } else if (out.original_owner_id != null) {
      out.original_owner_id = Number(out.original_owner_id) || null;
    }
    if (out.current_owner_name !== undefined) {
      out.current_owner_id = await resolveOwnerId(out.current_owner_name);
      delete out.current_owner_name;
    } else if (out.current_owner_id != null) {
      out.current_owner_id = Number(out.current_owner_id) || null;
    }
    return out;
  }

  static async create(data, userId) {
    const dValue = await DValue.findById(data.radionuclide_id);
    if (!dValue) throw new Error(`Invalid radionuclide_id: ${data.radionuclide_id}`);

    const currentTbq = toTbq(data.current_activity, data.current_activity_unit);
    if (currentTbq == null) throw new Error('Current activity and unit are required');
    const classification = await DValue.calculateCategory(currentTbq, dValue.d_value_tbq);

    const insertData = await this.sanitize({ ...data, source_classification: classification, created_by: userId });
    insertData.sync_uuid = data.sync_uuid || uuid();
    delete insertData.id;
    delete insertData.created_at;
    delete insertData.updated_at;

    const [result] = await pool.query(
      `INSERT INTO sources SET ?`,
      [insertData]
    );
    const sourceId = result.insertId;

    // Auto-generate a scannable barcode when none was provided:
    // DSRS-<6-digit id><check digit> (check digit = sum of id digits mod 10)
    const providedBarcode = data.source_barcode != null ? String(data.source_barcode).trim() : '';
    if (!providedBarcode) {
      const padded = String(sourceId).padStart(6, '0');
      const check = [...padded].reduce((acc, ch) => acc + Number(ch), 0) % 10;
      const generated = `DSRS-${padded}${check}`;
      await pool.query('UPDATE sources SET source_barcode = ? WHERE id = ?', [generated, sourceId]);
    }

    await pool.query(
      'INSERT INTO source_history (sync_uuid, source_id, changed_by, change_type, field_changed, previous_value, new_value, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuid(), sourceId, userId, 'create', 'source_record', null, data.source_serial_no || data.source_barcode || `#${sourceId}`, 'Source registered']
    );
    return sourceId;
  }

  static async update(id, data, userId) {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Source not found');

    const updateFields = await this.sanitize({ ...data });
    delete updateFields.source_classification;
    delete updateFields.photo_path;
    delete updateFields.id;
    delete updateFields.created_at;
    delete updateFields.updated_at;
    delete updateFields.created_by;
    updateFields.sync_uuid = data.sync_uuid || existing.sync_uuid || uuid();

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

    // Translate owner id changes to institution names so the trace shows a readable
    // "Original owner / Current owner" history through transfer stages.
    if (historyRows.some(([k]) => k === 'current_owner_id' || k === 'original_owner_id')) {
      const idKeys = [...new Set(historyRows.flatMap(([k, a, b]) =>
        (k === 'current_owner_id' || k === 'original_owner_id') ? [String(a), String(b)] : [])
      )].map(Number).filter(Boolean);
      if (idKeys.length > 0) {
        const [institutions] = await pool.query(
          `SELECT id, name FROM institutions WHERE id IN (${idKeys.map(() => '?').join(',')})`,
          idKeys
        );
        const names = new Map(institutions.map((i) => [Number(i.id), i.name]));
        for (const row of historyRows) {
          if (row[0] === 'current_owner_id' || row[0] === 'original_owner_id') {
            const [, oldId, newId] = row;
            const label = row[0] === 'current_owner_id' ? 'current_owner' : 'original_owner';
            row[0] = label;
            row[1] = names.get(Number(oldId)) || (oldId ? `institution #${oldId}` : '—');
            row[2] = names.get(Number(newId)) || (newId ? `institution #${newId}` : '—');
          }
        }
      }
    }

    await pool.query('UPDATE sources SET ? WHERE id = ?', [updateFields, id]);

    if (historyRows.length > 0) {
      const stmt = 'INSERT INTO source_history (source_id, changed_by, change_type, field_changed, previous_value, new_value, sync_uuid) VALUES ?';
      const values = historyRows.map(([field, oldV, newV]) => [id, userId, 'update', field, String(oldV), String(newV), uuid()]);
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
    if (filters.high_risk === '1') {
      where.push('s.source_classification IN (1, 2)');
    } else if (filters.source_classification) {
      where.push('s.source_classification = ?');
      values.push(filters.source_classification);
    }
    if (filters.q) {
      where.push(
        `(s.source_serial_no LIKE ? OR s.device_serial_no LIKE ? OR s.nra_registration_no LIKE ? OR s.source_barcode LIKE ?
          OR d.radionuclide LIKE ? OR c.name LIKE ? OR s.storage_facility_unit LIKE ? OR s.storage_cage_address LIKE ?)`
      );
      values.push(...Array(8).fill(`%${filters.q}%`));
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
    const limit = Math.max(1, Number(pagination.limit) || 25);
    const offset = Math.max(0, Number(pagination.offset) || 0);

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
      `SELECT COUNT(*) AS total FROM sources s JOIN d_values d ON s.radionuclide_id = d.id
       LEFT JOIN institutions c ON s.current_owner_id = c.id ${whereSql}`,
      values
    );

    const [categoryTotals] = await pool.query(
      `SELECT source_classification, COUNT(*) AS count
       FROM sources s JOIN d_values d ON s.radionuclide_id = d.id
       LEFT JOIN institutions c ON s.current_owner_id = c.id ${whereSql}
       GROUP BY source_classification`,
      values
    );

    return { rows, total: countRows[0].total, categoryTotals };
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
      'INSERT INTO source_history (sync_uuid, source_id, changed_by, change_type, field_changed, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuid(), id, userId, 'update', 'photo_path', existing.photo_path || null, photoPath]
    );
  }

  static async addMeasurement(sourceId, data, userId) {
    const [result] = await pool.query('INSERT INTO source_measurements SET ?', { ...data, source_id: sourceId, sync_uuid: uuid() });
    await pool.query(
      'INSERT INTO source_history (sync_uuid, source_id, changed_by, change_type, field_changed, previous_value, new_value, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuid(), sourceId, userId, 'measurement', 'dose_rate_at_1m', null, String(data.dose_rate_at_1m), `Measurement on ${data.measurement_date}`]
    );
    return result.insertId;
  }

  static async measurements(sourceId) {
    const [rows] = await pool.query('SELECT * FROM source_measurements WHERE source_id = ? ORDER BY measurement_date DESC', [sourceId]);
    return rows;
  }

  static async addLeakTest(sourceId, data, userId) {
    const [result] = await pool.query('INSERT INTO source_leak_tests SET ?', { ...data, source_id: sourceId, sync_uuid: uuid() });
    await pool.query(
      'INSERT INTO source_history (sync_uuid, source_id, changed_by, change_type, field_changed, previous_value, new_value, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuid(), sourceId, userId, 'leak_test', 'leak_test_result', null, String(data.leak_test_result), `Leak test on ${data.leak_test_date}`]
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
module.exports.toTbq = toTbq;