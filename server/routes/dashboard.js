const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const Source = require('../models/Source');

const ownerJoin = `
  FROM sources s
  JOIN d_values d ON s.radionuclide_id = d.id
  LEFT JOIN institutions c ON s.current_owner_id = c.id`;

router.get('/', async (req, res) => {
  try {
    const stats = await Source.stats();

    const [[highRisk]] = [
      await pool.query(
        `SELECT s.id, s.source_serial_no, s.device_serial_no, s.nra_registration_no,
                s.source_classification, s.storage_facility_unit, s.current_activity,
                s.current_activity_unit, d.radionuclide, c.name AS current_owner_name
         ${ownerJoin}
         WHERE s.source_classification IN (1, 2)
         ORDER BY s.source_classification, s.current_activity DESC`
      ),
    ];

    const [[calibrationDue]] = [
      await pool.query(
        `SELECT s.id, s.source_serial_no, s.device_serial_no, d.radionuclide,
                s.leak_test_instrument_calibration_due_date, s.storage_facility_unit,
                c.name AS current_owner_name
         ${ownerJoin}
         WHERE s.leak_test_instrument_calibration_due_date IS NOT NULL
           AND s.leak_test_instrument_calibration_due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
         ORDER BY s.leak_test_instrument_calibration_due_date`
      ),
    ];

    const [[recentActivity]] = [
      await pool.query(
        `SELECT h.change_type, h.field_changed, h.notes, h.changed_at,
                u.full_name AS changed_by_name, s.source_serial_no, d.radionuclide
         FROM source_history h
         JOIN sources s ON h.source_id = s.id
         LEFT JOIN d_values d ON s.radionuclide_id = d.id
         LEFT JOIN users u ON h.changed_by = u.id
         ORDER BY h.changed_at DESC
         LIMIT 10`
      ),
    ];

    const [[{ c: endUsers }]] = await pool.query(
      'SELECT COUNT(*) AS c FROM institutions WHERE is_active = 1'
    );
    const [[{ c: operators }]] = await pool.query(
      'SELECT COUNT(*) AS c FROM users WHERE is_active = 1'
    );

    res.json({
      ...stats,
      highRisk,
      calibrationDue,
      recentActivity,
      endUsers,
      operators,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;