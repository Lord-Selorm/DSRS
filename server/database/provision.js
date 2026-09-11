/**
 * Cloud provisioning script (idempotent).
 * Creates the schema, reference data, demo users and sample inventory
 * on any MySQL-compatible host (works with TiDB Cloud Serverless).
 *
 * Env vars (all optional except DB_*):
 *   DB_HOST, DB_PORT (default 3306), DB_USER, DB_PASSWORD, DB_NAME (default dsrs_db)
 *   DB_SSL=true            -> connect with TLS (required by TiDB Serverless)
 *   ADMIN_PASSWORD         -> strong password for the 'admin' user (required in cloud)
 *   DEMO_USERNAME (default demo), DEMO_PASSWORD (default demo2026)
 *   SEED_SAMPLE_SOURCES=0  -> skip the sample inventory rows
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { migrateInto } = require('./migrate-sync');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_NAME = process.env.DB_NAME || 'dsrs_db';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306,
    multipleStatements: true,
    ...(process.env.DB_SSL === 'true' ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } } : {}),
  });
  console.log('Connected to host', process.env.DB_HOST);

  // 1. Schema (CREATE DATABASE IF NOT EXISTS + tables)
  const [[dbRow]] = await conn.query(
    "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
    [DB_NAME]
  );
  if (!dbRow) {
    await conn.query("CREATE DATABASE IF NOT EXISTS " + DB_NAME);
    console.log('Database created:', DB_NAME);
  }
  await conn.query('USE ' + DB_NAME);

  const [[userTable]] = await conn.query(
    "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
    [DB_NAME]
  );
  if (!Number(userTable.c)) {
    let schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    schema = schema.replace(/dsrs_db/g, DB_NAME);
    await conn.query(schema);
    console.log('Schema applied.');
  } else {
    console.log('Schema already present, skipping.');
  }

  // 1.5 Offline-sync schema (idempotent)
  await migrateInto(conn, DB_NAME);
  console.log('Sync schema present.');

  // 2. Reference data: d-values
  const [[dCount]] = await conn.query('SELECT COUNT(*) AS c FROM d_values');
  if (!Number(dCount.c)) {
    let seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    seed = seed.replace(/dsrs_db/g, DB_NAME);
    await conn.query(seed);
    console.log('Reference data seeded (d-values, institutions).');
  } else {
    console.log('Reference data present, skipping.');
  }

  // 3. Users: strong admin + demo account
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    console.warn('WARNING: ADMIN_PASSWORD is not set — keeping existing admin, not resetting.');
  }
  const demoUser = process.env.DEMO_USERNAME || 'demo';
  const demoPass = process.env.DEMO_PASSWORD || 'demo2026';

  const upsertUser = async (username, password, fullName, role) => {
    await conn.query(
      `INSERT INTO users (username, password_hash, full_name, role, must_change_password)
       VALUES (?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), full_name = VALUES(full_name), role = VALUES(role), is_active = 1, must_change_password = VALUES(must_change_password)`,
      [username, bcrypt.hashSync(password, 10), fullName, role]
    );
  };

  if (adminPass) await upsertUser('admin', adminPass, 'System Administrator', 'admin');
  await upsertUser(demoUser, demoPass, 'Demo Operator', 'operator');
  console.log(`Users ready. admin ${adminPass ? '(password set from env)' : '(unchanged)'} | ${demoUser}/${demoPass}`);

  // 4. Sample inventory so the client sees a populated system
  if (process.env.SEED_SAMPLE_SOURCES === '0') {
    console.log('Sample sources skipped.');
    await conn.end();
    return;
  }
  const [[srcCount]] = await conn.query('SELECT COUNT(*) AS c FROM sources');
  if (Number(srcCount.c)) {
    console.log('Sources exist, sample data skipped.');
    await conn.end();
    return;
  }

  const [dValues] = await conn.query('SELECT id, radionuclide, d_value_tbq FROM d_values');
  const dById = new Map(dValues.map((d) => [d.radionuclide, d]));
  const [owners] = await conn.query('SELECT id, name FROM institutions');
  const ownerByName = new Map(owners.map((o) => [o.name, o.id]));
  const [[adminRow]] = await conn.query("SELECT id FROM users WHERE username = 'admin'");

  const SAMPLE_SOURCES = [
    // radionuclide, device, serial, owner, activityGBq, year, storage, application, integrity, conditioning, extras
    ['Co-60', 'THERATRON-780', 'TT-001-2018', 'Korle Bu Teaching Hospital', 48000, 2018, 'Radiotherapy Vault', 'External beam teletherapy', 'intact', 'none'],
    ['Co-60', 'EXPORT-1', 'GG-114-2020', 'National Nuclear Research Institute', 300, 2020, 'Neutron Hall C', 'Industrial gammagraphy', 'intact', 'none'],
    ['Cs-137', 'GAMMACELL-220', 'IRR-007-2019', 'National Nuclear Research Institute', 1300, 2019, 'Irradiator Bunker', 'Blood / tissue irradiator', 'intact', 'none'],
    ['Cs-137', 'GAMMACELL-3000', 'IRR-020-2021', 'Korle Bu Teaching Hospital', 100, 2021, 'Blood Bank Annex', 'Blood irradiator', 'intact', 'none'],
    ['Co-60', 'SOURCE-60', 'BR-302-2022', 'Komfo Anokye Teaching Hospital', 85, 2022, 'Brachytherapy Suite', 'High dose rate brachytherapy', 'intact', 'none'],
    ['Sr-90', 'OPTHA-90', 'OP-005-2023', 'Komfo Anokye Teaching Hospital', 1200, 2023, 'Ophthalmic Lab', 'Ophthalmic applicator', 'intact', 'none'],
    ['Cs-137', 'TG-210', 'RG-119-2019', 'Korle Bu Teaching Hospital', 1.5, 2019, 'Warehouse 1', 'Density gauge', 'intact', 'none'],
    ['Ir-192', 'SPEC-300', 'GT-401-2021', 'National Nuclear Research Institute', 16, 2021, 'Testing Lab B', 'Industrial radiography', 'intact', 'none'],
    ['I-131', 'DIAG-I131', 'RC-015-2024', 'Komfo Anokye Teaching Hospital', 40, 2024, 'Hot Lab', 'Thyroid uptake / therapy', 'intact', 'none'],
    ['Ra-226', 'LR-226', 'LD-003-2017', 'National Nuclear Research Institute', 0.4, 2017, 'Conditioning Bay', 'Lightning rod (disused)', 'damaged', 'disposed'],
    ['Am-241/Be', 'NEUTRON-HP', 'NB-210-2020', 'National Nuclear Research Institute', 6, 2020, 'Neutron Storage', 'Neutron well logging', 'intact', 'conditioned'],
    ['Am-241', 'SD-241', 'SM-011-2017', 'RPI 1', 0.4, 2017, 'Storage Cabinet A', 'Smoke detector (disused)', 'intact', 'none'],
    ['Co-57', 'CAL-57', 'CS-088-2023', 'RPI 3', 0.5, 2023, 'Metrology Bench', 'Calibration source', 'intact', 'none'],
    ['Tc-99m', 'GEN-99M', 'GN-330-2026', 'Komfo Anokye Teaching Hospital', 0.07, 2026, 'Hot Lab', 'Generator (short-lived)', 'intact', 'none'],
    ['Fe-55', 'CAL-55', 'CS-102-2024', 'RPI 2', 200, 2024, 'Metrology Bench', 'Calibration / XRF source', 'intact', 'none'],
  ];

  let catCount = {};
  let inserted = 0;
  for (const [rad, device, serial, ownerName, gbq, year, storage, app, integrity, conditioning] of SAMPLE_SOURCES) {
    const d = dById.get(rad);
    if (!d) { console.warn('  skip radionuclide not in d_values:', rad); continue; }
    const tbq = gbq / 1000;
    const ad = tbq / Number(d.d_value_tbq);
    let cat;
    if (ad >= 1000) cat = 1;
    else if (ad >= 10) cat = 2;
    else if (ad >= 1) cat = 3;
    else if (ad >= 0.01) cat = 4;
    else cat = 5;

    const res = await conn.query(
      `INSERT INTO sources
        (device_serial_no, source_serial_no, nra_registration_no, source_barcode, no_on_source,
         radionuclide_id, original_activity, original_activity_unit, original_activity_date,
         current_activity, current_activity_unit, current_activity_date, source_classification,
         source_physical_form, manufacturer, manufacturer_country, source_integrity,
         storage_facility_unit, current_owner_id, current_application, responsible_officer,
         radiation_type, conditioning_status, return_to_supplier, reuse, borehole_disposal_intention,
         decay_storage, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        device, serial, 'NRA-' + year + '-' + String(inserted + 1).padStart(3, '0'), serial, '1',
        d.id, gbq, 'GBq', new Date(year, 0, 15), gbq, 'GBq', new Date(year, 6, 1), cat,
        'sealed', 'Demo Irradiation Ltd', 'United Kingdom', integrity,
        storage, ownerByName.get(ownerName), app, 'Demonstration Officer', 'gamma',
        conditioning, 0, 0, 0, 0,
        adminRow ? adminRow.id : null,
      ]
    );
    const srcId = res[0].insertId;
    catCount[cat] = (catCount[cat] || 0) + 1;
    inserted += 1;

    // Status-change history so the Traceability table has rows
    const uid = adminRow ? adminRow.id : null;
    if (conditioning === 'conditioned') {
      const capsule = 'CPL-' + String(srcId).padStart(3, '0');
      const drum = 'DRM-' + String(srcId).padStart(3, '0');
      await conn.query(
        `INSERT INTO source_history (source_id, changed_by, change_type, field_changed, previous_value, new_value, notes) VALUES
           (?, ?, 'conditioning', 'conditioning_status', 'none', 'conditioned', 'Conditioned in demonstration data'),
           (?, ?, 'update', 'capsule_no_id', '', ?, 'Capsule assigned'),
           (?, ?, 'update', 'concrete_drum_no', '', ?, 'Waste package assigned')`,
        [srcId, uid, srcId, uid, capsule, srcId, uid, drum]
      );
      await conn.query('UPDATE sources SET capsule_no_id = ?, concrete_drum_no = ? WHERE id = ?', [capsule, drum, srcId]);
    } else if (conditioning === 'disposed') {
      await conn.query(
        "INSERT INTO source_history (source_id, changed_by, change_type, field_changed, previous_value, new_value, notes) VALUES (?, ?, 'disposal', 'conditioning_status', 'none', 'disposed', 'Disposed in demonstration data')",
        [srcId, uid]
      );
    }
    await conn.query(
      "INSERT INTO source_history (source_id, changed_by, change_type, field_changed, previous_value, new_value, notes) VALUES (?, ?, 'create', 'source', '', ?, 'Registered during provisioning')",
      [srcId, uid, serial]
    );
  }

  console.log(`Sample inventory added: ${inserted} sources; category spread: ${JSON.stringify(catCount)}`);
  console.log('Provision complete.');
  await conn.end();
}

main().catch((err) => {
  console.error('Provision failed:', err.message);
  process.exit(1);
});