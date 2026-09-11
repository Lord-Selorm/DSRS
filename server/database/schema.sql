CREATE DATABASE IF NOT EXISTS dsrs_db;
USE dsrs_db;

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  role ENUM('admin', 'operator', 'viewer') DEFAULT 'operator',
  is_active TINYINT(1) DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. INSTITUTIONS
-- ============================================================
CREATE TABLE institutions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(20) UNIQUE,
  address TEXT,
  contact_person VARCHAR(100),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(100),
  license_number VARCHAR(100),
  rpo_rpe_name VARCHAR(100),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. D-VALUES (reference table)
-- ============================================================
CREATE TABLE d_values (
  id INT AUTO_INCREMENT PRIMARY KEY,
  radionuclide VARCHAR(50) NOT NULL UNIQUE,
  half_life_value DECIMAL(15,6),
  half_life_unit VARCHAR(20),
  d_value_tbq DECIMAL(15,6) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. SOURCES (main inventory table)
-- ============================================================
CREATE TABLE sources (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Unique ID variables
  device_serial_no VARCHAR(100),
  source_serial_no VARCHAR(100),
  nra_registration_no VARCHAR(100),
  source_barcode VARCHAR(100) UNIQUE,

  -- Radionuclide variables
  radionuclide_id INT NOT NULL,
  half_life_value DECIMAL(15,6),
  half_life_unit VARCHAR(20),
  original_activity DECIMAL(15,6),
  original_activity_unit ENUM('TBq','GBq','MBq','kBq','Bq','Ci','mCi','uCi') DEFAULT 'GBq',
  original_activity_date DATE,
  current_activity DECIMAL(15,6),
  current_activity_unit ENUM('TBq','GBq','MBq','kBq','Bq','Ci','mCi','uCi') DEFAULT 'GBq',
  current_activity_date DATE,

  -- Auto-calculated from A/D by the application layer
  -- (Activity converted to TBq, divided by d_value_tbq from d_values)
  source_classification TINYINT NOT NULL DEFAULT 5,

  -- Source physical properties
  source_physical_form ENUM('sealed','unsealed','solid','liquid','gas') DEFAULT 'sealed',
  source_length DECIMAL(10,2),
  source_diameter DECIMAL(10,2),
  source_mass DECIMAL(10,4),

  -- Manufacturer
  manufacturer VARCHAR(200),
  manufacturer_country VARCHAR(100),
  source_certificate_no VARCHAR(100),

  -- Ownership & usage
  original_owner_id INT,
  date_licensed DATE,
  original_application VARCHAR(200),
  current_owner_id INT,
  date_transferred DATE,
  current_application VARCHAR(200),
  reason_for_transfer TEXT,
  transfer_authorization VARCHAR(200),
  transporter VARCHAR(200),

  -- Physical location & control
  storage_facility_unit VARCHAR(100),
  storage_cage_address VARCHAR(200),
  date_placed_in_cage DATE,
  responsible_officer VARCHAR(100),
  date_last_verified DATE,
  photo_path VARCHAR(500),

  -- Radiological characterization
  radiation_type ENUM('alpha','beta','gamma','neutron','xray') DEFAULT 'gamma',
  dose_rate_at_1m DECIMAL(15,6),
  dose_rate_on_surface DECIMAL(15,6),
  background_radiation DECIMAL(15,6),
  measurement_date DATE,
  instrument_used VARCHAR(200),
  instrument_calibration_due_date DATE,

  -- Source integrity
  source_integrity ENUM('intact','damaged','unknown') DEFAULT 'intact',
  contamination_status ENUM('clean','contaminated','unknown') DEFAULT 'clean',
  visual_inspection_result VARCHAR(200),
  leak_test_method VARCHAR(100),
  leak_test_result ENUM('pass','fail','pending') DEFAULT 'pending',
  leak_test_date DATE,
  leak_test_instrument_used VARCHAR(200),
  leak_test_instrument_calibration_due_date DATE,
  return_to_supplier TINYINT(1) DEFAULT 0,
  reuse TINYINT(1) DEFAULT 0,

  -- Endpoint management
  conditioning_status ENUM('none','conditioned','disposed') DEFAULT 'none',
  conditioning_date DATE,
  no_on_source VARCHAR(100),
  capsule_no_id VARCHAR(100),
  capsule_height_mm DECIMAL(10,2),
  capsule_external_diameter DECIMAL(10,2),
  concrete_drum_no VARCHAR(100),
  borehole_disposal_intention TINYINT(1) DEFAULT 0,
  decay_storage TINYINT(1) DEFAULT 0,

  -- Metadata
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (radionuclide_id) REFERENCES d_values(id),
  FOREIGN KEY (original_owner_id) REFERENCES institutions(id),
  FOREIGN KEY (current_owner_id) REFERENCES institutions(id),
  FOREIGN KEY (created_by) REFERENCES users(id),

  INDEX idx_source_serial (source_serial_no),
  INDEX idx_device_serial (device_serial_no),
  INDEX idx_nra_reg (nra_registration_no),
  INDEX idx_barcode (source_barcode),
  INDEX idx_classification (source_classification),
  INDEX idx_radionuclide (radionuclide_id),
  INDEX idx_owner (current_owner_id),
  INDEX idx_location (storage_facility_unit, storage_cage_address)
);

-- ============================================================
-- 5. SOURCE MEASUREMENTS (radiological history)
-- ============================================================
CREATE TABLE source_measurements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id INT NOT NULL,
  radiation_type ENUM('alpha','beta','gamma','neutron','xray'),
  dose_rate_at_1m DECIMAL(15,6),
  dose_rate_on_surface DECIMAL(15,6),
  background_radiation DECIMAL(15,6),
  measurement_date DATE NOT NULL,
  instrument_used VARCHAR(200),
  instrument_calibration_due_date DATE,
  measured_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  INDEX idx_measurement_source (source_id),
  INDEX idx_measurement_date (measurement_date)
);

-- ============================================================
-- 6. SOURCE LEAK TESTS
-- ============================================================
CREATE TABLE source_leak_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id INT NOT NULL,
  leak_test_method VARCHAR(100),
  leak_test_result ENUM('pass','fail','pending') DEFAULT 'pending',
  leak_test_date DATE NOT NULL,
  source_integrity ENUM('intact','damaged','unknown'),
  contamination_status ENUM('clean','contaminated','unknown'),
  instrument_used VARCHAR(200),
  instrument_calibration_due_date DATE,
  visual_inspection_result VARCHAR(200),
  tested_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  INDEX idx_leak_source (source_id),
  INDEX idx_leak_date (leak_test_date)
);

-- ============================================================
-- 7. SOURCE HISTORY (audit log)
-- ============================================================
CREATE TABLE source_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id INT NOT NULL,
  changed_by INT,
  change_type ENUM('create','update','transfer','measurement','leak_test','conditioning','disposal','photo') NOT NULL,
  field_changed VARCHAR(100),
  previous_value TEXT,
  new_value TEXT,
  notes TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id),
  INDEX idx_history_source (source_id),
  INDEX idx_history_date (changed_at)
);

-- ============================================================
-- 8. SOURCE PHOTOS (multiple photos per source/device)
-- ============================================================
CREATE TABLE IF NOT EXISTS source_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id INT NOT NULL,
  photo_path VARCHAR(255) NOT NULL,
  caption VARCHAR(200),
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_photos_source (source_id)
);
