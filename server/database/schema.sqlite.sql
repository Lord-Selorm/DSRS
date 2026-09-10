-- ============================================================
-- DSRS offline (local) schema — SQLite
-- Mirrors server/database/schema.sql with portable DDL plus
-- sync columns/triggers that power offline-first operation.
-- ============================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin','operator','viewer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS institutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_uuid TEXT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  address TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  license_number TEXT,
  rpo_rpe_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS d_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  radionuclide TEXT NOT NULL UNIQUE,
  half_life_value REAL,
  half_life_unit TEXT,
  d_value_tbq REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_uuid TEXT,
  device_serial_no TEXT,
  source_serial_no TEXT,
  nra_registration_no TEXT,
  source_barcode TEXT UNIQUE,
  radionuclide_id INTEGER NOT NULL,
  half_life_value REAL,
  half_life_unit TEXT,
  original_activity REAL,
  original_activity_unit TEXT NOT NULL DEFAULT 'GBq',
  original_activity_date TEXT,
  current_activity REAL,
  current_activity_unit TEXT NOT NULL DEFAULT 'GBq',
  current_activity_date TEXT,
  source_classification INTEGER NOT NULL DEFAULT 5,
  source_physical_form TEXT NOT NULL DEFAULT 'sealed',
  source_length REAL,
  source_diameter REAL,
  source_mass REAL,
  manufacturer TEXT,
  manufacturer_country TEXT,
  source_certificate_no TEXT,
  original_owner_id INTEGER,
  date_licensed TEXT,
  original_application TEXT,
  current_owner_id INTEGER,
  date_transferred TEXT,
  current_application TEXT,
  reason_for_transfer TEXT,
  transfer_authorization TEXT,
  transporter TEXT,
  storage_facility_unit TEXT,
  storage_cage_address TEXT,
  date_placed_in_cage TEXT,
  responsible_officer TEXT,
  date_last_verified TEXT,
  photo_path TEXT,
  radiation_type TEXT NOT NULL DEFAULT 'gamma',
  dose_rate_at_1m REAL,
  dose_rate_on_surface REAL,
  background_radiation REAL,
  measurement_date TEXT,
  instrument_used TEXT,
  instrument_calibration_due_date TEXT,
  source_integrity TEXT NOT NULL DEFAULT 'intact',
  contamination_status TEXT NOT NULL DEFAULT 'clean',
  visual_inspection_result TEXT,
  leak_test_method TEXT,
  leak_test_result TEXT NOT NULL DEFAULT 'pending',
  leak_test_date TEXT,
  leak_test_instrument_used TEXT,
  leak_test_instrument_calibration_due_date TEXT,
  return_to_supplier INTEGER NOT NULL DEFAULT 0,
  reuse INTEGER NOT NULL DEFAULT 0,
  conditioning_status TEXT NOT NULL DEFAULT 'none',
  conditioning_date TEXT,
  no_on_source TEXT,
  capsule_no_id TEXT,
  capsule_height_mm REAL,
  capsule_external_diameter REAL,
  concrete_drum_no TEXT,
  borehole_disposal_intention INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (radionuclide_id) REFERENCES d_values(id),
  FOREIGN KEY (original_owner_id) REFERENCES institutions(id),
  FOREIGN KEY (current_owner_id) REFERENCES institutions(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS source_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_uuid TEXT,
  source_id INTEGER NOT NULL,
  radiation_type TEXT,
  dose_rate_at_1m REAL,
  dose_rate_on_surface REAL,
  background_radiation REAL,
  measurement_date TEXT NOT NULL,
  instrument_used TEXT,
  instrument_calibration_due_date TEXT,
  measured_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS source_leak_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_uuid TEXT,
  source_id INTEGER NOT NULL,
  leak_test_method TEXT,
  leak_test_result TEXT NOT NULL DEFAULT 'pending',
  leak_test_date TEXT NOT NULL,
  source_integrity TEXT,
  contamination_status TEXT,
  instrument_used TEXT,
  instrument_calibration_due_date TEXT,
  visual_inspection_result TEXT,
  tested_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS source_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_uuid TEXT,
  source_id INTEGER NOT NULL,
  changed_by INTEGER,
  change_type TEXT NOT NULL,
  field_changed TEXT,
  previous_value TEXT,
  new_value TEXT,
  notes TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS source_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_uuid TEXT,
  source_id INTEGER NOT NULL,
  photo_path TEXT NOT NULL,
  caption TEXT,
  uploaded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- updated_at auto-maintenance (MySQL does this with ON UPDATE)
CREATE TRIGGER IF NOT EXISTS trg_sources_upt AFTER UPDATE ON sources FOR EACH ROW
BEGIN UPDATE sources SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_institutions_upt AFTER UPDATE ON institutions FOR EACH ROW
BEGIN UPDATE institutions SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_users_upt AFTER UPDATE ON users FOR EACH ROW
BEGIN UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id; END;

-- ============================================================
-- Offline sync bookkeeping
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_registry (
  table_name TEXT NOT NULL,
  row_uuid TEXT NOT NULL,
  cloud_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (table_name, row_uuid)
);

CREATE TABLE IF NOT EXISTS sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id INTEGER NOT NULL,
  op TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  pushed_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_meta (
  k TEXT PRIMARY KEY,
  v TEXT
);