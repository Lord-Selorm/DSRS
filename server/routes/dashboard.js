const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const Source = require('../models/Source');

const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const todayStr = () => day(0);
const inDaysStr = (n) => day(n);

const ownerJoin = `
  FROM sources s
  JOIN d_values d ON s.radionuclide_id = d.id
  LEFT JOIN institutions c ON s.current_owner_id = c.id`;

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function buildAlerts(rows) {
  const twelveMonthsAgo = new Date(Date.now() - 365.25 * 24 * 60 * 60 * 1000);
  const out = [];
  for (const r of rows) {
    const base = {
      sourceId: r.id,
      label: r.source_serial_no || r.device_serial_no || `#${r.id}`,
      radionuclide: r.radionuclide,
      owner: r.current_owner_name,
      storage: r.storage_facility_unit,
    };
    const lt = toDate(r.leak_test_date);
    if (!lt) out.push({ ...base, type: 'leak_test', severity: 'high', date: null, title: 'No leak test recorded' });
    else if (lt < twelveMonthsAgo) out.push({ ...base, type: 'leak_test', severity: 'high', date: lt.toISOString(), title: 'Leak test overdue' });

    const vf = toDate(r.date_last_verified);
    if (!vf) out.push({ ...base, type: 'verification', severity: 'medium', date: null, title: 'No verification recorded' });
    else if (vf < twelveMonthsAgo) out.push({ ...base, type: 'verification', severity: 'medium', date: vf.toISOString(), title: 'Periodic verification overdue' });

    const cal = toDate(r.leak_test_instrument_calibration_due_date) || toDate(r.instrument_calibration_due_date);
    if (cal) {
      const days = Math.ceil((cal.getTime() - Date.now()) / 86400000);
      if (days <= 90) {
        const severity = days <= 30 ? 'high' : days <= 60 ? 'medium' : 'low';
        const title = days < 0 ? `Calibration overdue` : days === 0 ? 'Calibration due today' : `Calibration due in ${days}d`;
        out.push({ ...base, type: 'calibration', severity, date: cal.toISOString(), days, title });
      }
    }
  }
  const order = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || String(a.date || '').localeCompare(String(b.date || '')));
}

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
           AND s.leak_test_instrument_calibration_due_date BETWEEN ? AND ?
         ORDER BY s.leak_test_instrument_calibration_due_date`,
        [todayStr(), inDaysStr(90)]
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

    const [[rows]] = await pool.query(
      `SELECT s.id, s.source_serial_no, s.device_serial_no, s.source_classification,
              s.storage_facility_unit,
              s.leak_test_date, s.date_last_verified,
              s.leak_test_instrument_calibration_due_date, s.instrument_calibration_due_date,
              d.radionuclide, c.name AS current_owner_name
       ${ownerJoin}`
    );
    const alerts = buildAlerts(rows);

    res.json({
      ...stats,
      highRisk,
      calibrationDue,
      recentActivity,
      alerts,
      endUsers,
      operators,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;