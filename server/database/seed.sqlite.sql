-- Offline (SQLite) seed — mirrors the cloud provision data.
-- d_values, users (admin/op1/demo) and reference institutions.

INSERT INTO d_values (radionuclide, d_value_tbq, half_life_value, half_life_unit) VALUES
('Am-241',     0.06,    432.2,   'years'),
('Am-241/Be',  0.06,    432.2,   'years'),
('Au-198',     0.2,     2.695,   'days'),
('Cd-109',     20.0,    461.4,   'days'),
('Cf-252',     0.02,    2.645,   'years'),
('Cm-244',     0.05,    18.1,    'years'),
('Co-57',      0.7,     271.74,  'days'),
('Co-60',      0.03,    5.271,   'years'),
('Cs-137',     0.1,     30.17,   'years'),
('Fe-55',      800.0,   1002.3,  'days'),
('Gd-153',     1.0,     240.4,   'days'),
('Ge-68',      0.07,    270.95,  'days'),
('H-3',        2000.0,  4500.0,  'days'),
('I-125',      0.2,     59.41,   'days'),
('I-131',      0.2,     8.02,    'days'),
('Ir-192',     0.08,    73.83,   'days'),
('Kr-85',      30.0,    3934.4,  'days'),
('Mo-99',      0.3,     2.7487,  'days'),
('Ni-63',      0.3,     100.1,   'years'),
('P-32',       60.0,    14.29,   'days'),
('Pd-103',     90.0,    16.991,  'days'),
('Pm-147',     40.0,    2.6234,  'years'),
('Po-210',     0.06,    138.376, 'days'),
('Pu-238',     0.06,    87.7,    'years'),
('Pu-239/Be',  0.06,    24110.0, 'years'),
('Ra-226',     0.04,    1600.0,  'years'),
('Ru-106',     0.3,     373.6,   'days'),
('Se-75',      0.2,     119.78,  'days'),
('Sr-90',      1.0,     10512.0, 'days'),
('Tc-99m',     0.7,     0.25,    'days'),
('Tl-204',     20.0,    1306.0,  'days'),
('Tm-170',     20.0,    128.6,   'days');

INSERT INTO users (username, password_hash, full_name, email, role, must_change_password) VALUES
('admin', '$2a$10$GZQS5S4iOGmk2t3BqW0tO.yn8i4uXZ1oNc0XIQeqJHsrm1/td3dbq', 'System Administrator', 'admin@dsrs.local', 'admin', 0),
('demo',  '$2a$10$7N5oJWObRlaofxEHGCpxnu0US0yIJtPtrx4JjVg3UHjWLfzOdm5WW', 'Demo Operator', NULL, 'operator', 1),
('op1',   '$2a$10$raqKxmgsfBIgxlM/n2oyqOpj9dlmebXRm/rQZZIx0XMdMO0axi.b.', 'Operator One', NULL, 'operator', 1);

INSERT INTO institutions (name, code, address, contact_person, contact_phone, contact_email) VALUES
('Korle Bu Teaching Hospital', 'KBTH', 'Accra, Ghana', 'Dr. A. Mensah', '+233-302-123456', 'info@kbth.gov.gh'),
('Komfo Anokye Teaching Hospital', 'KATH', 'Kumasi, Ghana', 'Dr. K. Asare', '+233-322-654321', 'info@kath.gov.gh'),
('National Nuclear Research Institute', 'NNRI', 'Accra, Ghana', 'Prof. S. Adjei', '+233-302-789012', 'info@nnri.gov.gh'),
('Radiation Protection Institute', 'RPI', 'GAEC, Legon-Accra, Ghana', 'Director RPI', '+233-302-400307', 'rpi@gaec.gov.gh'),
('RPI 1', 'RPI-1', 'Demo end user 1', 'RPI Officer 1', '+233-302-400311', 'rpi1@gaec.gov.gh'),
('RPI 2', 'RPI-2', 'Demo end user 2', 'RPI Officer 2', '+233-302-400312', 'rpi2@gaec.gov.gh'),
('RPI 3', 'RPI-3', 'Demo end user 3', 'RPI Officer 3', '+233-302-400313', 'rpi3@gaec.gov.gh');

-- ============================================================
-- SAMPLE INVENTORY (mirrors cloud provisioning data so the
-- offline desktop opens with a populated registry)
-- radionuclide_id references seed order: Co-60=8 Cs-137=9 Sr-90=29
-- Ir-192=16 I-131=15 Ra-226=26 Am-241/Be=2 Am-241=1 Co-57=7 Fe-55=10
-- owners: KBTH=1 KATH=2 NNRI=3 RPI 1=5 RPI 2=6 RPI 3=7
-- ============================================================
INSERT INTO sources (
  device_serial_no, source_serial_no, nra_registration_no, source_barcode, no_on_source,
  radionuclide_id, half_life_value, half_life_unit, original_activity, original_activity_unit,
  original_activity_date, current_activity, current_activity_unit, current_activity_date,
  source_classification, source_physical_form, manufacturer, manufacturer_country,
  original_owner_id, date_licensed, original_application, current_owner_id, date_transferred,
  current_application, reason_for_transfer, transfer_authorization, transporter,
  storage_facility_unit, storage_cage_address, date_placed_in_cage, responsible_officer,
  date_last_verified, radiation_type, dose_rate_at_1m, dose_rate_on_surface, background_radiation,
  measurement_date, instrument_used, instrument_calibration_due_date, source_integrity,
  contamination_status, visual_inspection_result, leak_test_method, leak_test_result,
  leak_test_date, leak_test_instrument_used, leak_test_instrument_calibration_due_date,
  return_to_supplier, reuse, conditioning_status, conditioning_date, capsule_no_id,
  capsule_height_mm, capsule_external_diameter, concrete_drum_no, borehole_disposal_intention,
  created_by
) VALUES
('THERATRON-780', 'TT-001-2018', 'NRA-2018-001', 'SRC-TT-001', '1', 8, 5.271, 'years', 48000, 'GBq', '2018-01-15', 48000, 'GBq', '2026-07-01', 1, 'sealed', 'Demo Irradiation Ltd', 'United Kingdom', 1, '2018-01-20', 'External beam teletherapy', 1, NULL, 'External beam teletherapy', NULL, NULL, NULL, 'Radiotherapy Vault', 'Cage A1', '2018-02-01', 'Demonstration Officer', '2026-01-15', 'gamma', 850.5, 1200.0, 0.12, '2026-01-15', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-01-15', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('EXPORT-1', 'GG-114-2020', 'NRA-2020-002', 'SRC-GG-114', '1', 8, 5.271, 'years', 300, 'GBq', '2020-03-10', 300, 'GBq', '2026-07-01', 2, 'sealed', 'Demo Irradiation Ltd', 'United Kingdom', 3, '2020-03-15', 'Industrial gammagraphy', 3, NULL, 'Industrial gammagraphy', NULL, NULL, NULL, 'Neutron Hall C', 'Cage B3', '2020-04-01', 'Demonstration Officer', '2026-02-20', 'gamma', 12.4, 45.0, 0.10, '2026-02-20', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-02-20', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('GAMMACELL-220', 'IRR-007-2019', 'NRA-2019-003', 'SRC-IRR-007', '1', 9, 30.17, 'years', 1300, 'GBq', '2019-05-01', 1300, 'GBq', '2026-07-01', 2, 'sealed', 'Demo Irradiation Ltd', 'Canada', 3, '2019-05-10', 'Blood / tissue irradiator', 3, NULL, 'Blood / tissue irradiator', NULL, NULL, NULL, 'Irradiator Bunker', 'Cage C1', '2019-06-01', 'Demonstration Officer', '2026-03-05', 'gamma', 2100.0, 4600.0, 0.11, '2026-03-05', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-03-05', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('GAMMACELL-3000', 'IRR-020-2021', 'NRA-2021-004', 'SRC-IRR-020', '1', 9, 30.17, 'years', 100, 'GBq', '2021-07-15', 100, 'GBq', '2026-07-01', 3, 'sealed', 'Demo Irradiation Ltd', 'Canada', 1, '2021-07-20', 'Blood irradiator', 1, NULL, 'Blood irradiator', NULL, NULL, NULL, 'Blood Bank Annex', 'Cage C2', '2021-08-01', 'Demonstration Officer', '2026-04-10', 'gamma', 95.0, 330.0, 0.12, '2026-04-10', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-04-10', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('SOURCE-60', 'BR-302-2022', 'NRA-2022-005', 'SRC-BR-302', '1', 8, 5.271, 'years', 85, 'GBq', '2022-02-10', 85, 'GBq', '2026-07-01', 3, 'sealed', 'Demo Irradiation Ltd', 'United Kingdom', 2, '2022-02-15', 'High dose rate brachytherapy', 2, NULL, 'High dose rate brachytherapy', NULL, NULL, NULL, 'Brachytherapy Suite', 'Cage D1', '2022-03-01', 'Demonstration Officer', '2026-01-30', 'gamma', 25.0, 90.0, 0.10, '2026-01-30', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-01-30', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('OPTHA-90', 'OP-005-2023', 'NRA-2023-006', 'SRC-OP-005', '1', 29, 10512.0, 'days', 1200, 'GBq', '2023-04-01', 1200, 'GBq', '2026-07-01', 3, 'sealed', 'Demo Irradiation Ltd', 'United Kingdom', 2, '2023-04-10', 'Ophthalmic applicator', 2, NULL, 'Ophthalmic applicator', NULL, NULL, NULL, 'Ophthalmic Lab', 'Cage D2', '2023-05-01', 'Demonstration Officer', '2026-02-14', 'beta', 0.2, 55.0, 0.10, '2026-02-14', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-02-14', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('TG-210', 'RG-119-2019', 'NRA-2019-007', 'SRC-RG-119', '1', 9, 30.17, 'years', 1.5, 'GBq', '2019-09-01', 1.5, 'GBq', '2026-07-01', 4, 'sealed', 'Demo Irradiation Ltd', 'United Kingdom', 1, '2019-09-10', 'Density gauge', 1, NULL, 'Density gauge', NULL, NULL, NULL, 'Warehouse 1', 'Cage E1', '2019-10-01', 'Demonstration Officer', '2026-03-22', 'gamma', 0.4, 2.1, 0.12, '2026-03-22', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-03-22', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('SPEC-300', 'GT-401-2021', 'NRA-2021-008', 'SRC-GT-401', '1', 16, 73.83, 'days', 16, 'GBq', '2021-11-01', 16, 'GBq', '2026-07-01', 4, 'sealed', 'Demo Irradiation Ltd', 'Germany', 3, '2021-11-10', 'Industrial radiography', 3, NULL, 'Industrial radiography', NULL, NULL, NULL, 'Testing Lab B', 'Cage F2', '2021-12-01', 'Demonstration Officer', '2026-04-18', 'gamma', 1.8, 9.0, 0.11, '2026-04-18', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-04-18', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('DIAG-I131', 'RC-015-2024', 'NRA-2024-009', 'SRC-RC-015', '1', 15, 8.02, 'days', 40, 'GBq', '2024-01-10', 40, 'GBq', '2026-07-01', 4, 'sealed', 'Demo Irradiation Ltd', 'United Kingdom', 2, '2024-01-15', 'Thyroid uptake / therapy', 2, NULL, 'Thyroid uptake / therapy', NULL, NULL, NULL, 'Hot Lab', 'Cage G1', '2024-02-01', 'Demonstration Officer', '2026-02-28', 'gamma', 2.5, 11.0, 0.10, '2026-02-28', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-02-28', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('LR-226', 'LD-003-2017', 'NRA-2017-010', 'SRC-LD-003', '1', 26, 1600.0, 'years', 0.4, 'GBq', '2017-06-01', 0.4, 'GBq', '2026-07-01', 4, 'sealed', 'Korl Engineering', 'France', 3, '2017-06-15', 'Lightning rod (disused)', 3, '2025-11-12', 'Disposal pathway', 'End-of-life', 'NRA/DIS/2025/004', 'Astra Haulage Ltd', 'Conditioning Bay', 'Cage H1', '2025-11-20', 'Demonstration Officer', '2026-01-05', 'gamma', 0.05, 0.4, 0.12, '2026-01-05', 'RADOS Survey Meter RM-2101', '2026-12-01', 'damaged', 'contaminated', 'Surface contamination detected', 'wipe test', 'fail', '2026-01-05', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'disposed', '2025-12-01', NULL, NULL, NULL, 'DRM-010', 0, 1),
('NEUTRON-HP', 'NB-210-2020', 'NRA-2020-011', 'SRC-NB-210', '1', 2, 432.2, 'years', 6, 'GBq', '2020-08-01', 6, 'GBq', '2026-07-01', 4, 'sealed', 'Demo Irradiation Ltd', 'United States', 3, '2020-08-10', 'Neutron well logging', 3, NULL, 'Neutron well logging', NULL, NULL, NULL, 'Neutron Storage', 'Cage I1', '2020-09-01', 'Demonstration Officer', '2026-01-25', 'neutron', 0.3, 1.5, 0.15, '2026-01-25', 'NEUTRON SURVEY PRO', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-01-25', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'conditioned', '2025-08-15', 'CPL-011', 82.0, 70.0, 'DRM-011', 0, 1),
('SD-241', 'SM-011-2017', 'NRA-2017-012', 'SRC-SM-011', '1', 1, 432.2, 'years', 0.4, 'GBq', '2017-02-01', 0.4, 'GBq', '2026-07-01', 5, 'sealed', 'Fire Alert Systems', 'United States', 5, '2017-02-10', 'Smoke detector (disused)', 5, NULL, 'Smoke detector (disused)', NULL, NULL, NULL, 'Storage Cabinet A', 'Cage J1', '2017-03-01', 'Demonstration Officer', '2026-03-11', 'alpha', 0.001, 0.01, 0.10, '2026-03-11', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-03-11', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('CAL-57', 'CS-088-2023', 'NRA-2023-013', 'SRC-CS-088', '1', 7, 271.74, 'days', 0.5, 'GBq', '2023-12-01', 0.5, 'GBq', '2026-07-01', 5, 'sealed', 'Demo Irradiation Ltd', 'United Kingdom', 7, '2023-12-10', 'Calibration source', 7, NULL, 'Calibration source', NULL, NULL, NULL, 'Metrology Bench', 'Cage K1', '2024-01-05', 'Demonstration Officer', '2026-04-02', 'gamma', 0.002, 0.02, 0.10, '2026-04-02', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-04-02', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1),
('CAL-55', 'CS-102-2024', 'NRA-2024-014', 'SRC-CS-102', '1', 10, 1002.3, 'days', 200, 'GBq', '2024-06-01', 200, 'GBq', '2026-07-01', 5, 'sealed', 'Demo Irradiation Ltd', 'Netherlands', 6, '2024-06-10', 'Calibration / XRF source', 6, NULL, 'Calibration / XRF source', NULL, NULL, NULL, 'Metrology Bench', 'Cage K2', '2024-07-01', 'Demonstration Officer', '2026-01-18', 'xray', 0.01, 0.05, 0.10, '2026-01-18', 'RADOS Survey Meter RM-2101', '2026-12-01', 'intact', 'clean', 'No defects observed', 'wipe test', 'pass', '2026-01-18', 'Mini-Instruments 900', '2026-11-15', 0, 0, 'none', NULL, NULL, NULL, NULL, NULL, 0, 1);

-- Audit history for the seeded sources (created_by = admin = user id 1)
INSERT INTO source_history (source_id, changed_by, change_type, field_changed, previous_value, new_value, notes) VALUES
(1, 1, 'create', 'source_record', NULL, 'TT-001-2018', 'Registered during offline provisioning'),
(2, 1, 'create', 'source_record', NULL, 'GG-114-2020', 'Registered during offline provisioning'),
(3, 1, 'create', 'source_record', NULL, 'IRR-007-2019', 'Registered during offline provisioning'),
(4, 1, 'create', 'source_record', NULL, 'IRR-020-2021', 'Registered during offline provisioning'),
(5, 1, 'create', 'source_record', NULL, 'BR-302-2022', 'Registered during offline provisioning'),
(6, 1, 'create', 'source_record', NULL, 'OP-005-2023', 'Registered during offline provisioning'),
(7, 1, 'create', 'source_record', NULL, 'RG-119-2019', 'Registered during offline provisioning'),
(8, 1, 'create', 'source_record', NULL, 'GT-401-2021', 'Registered during offline provisioning'),
(9, 1, 'create', 'source_record', NULL, 'RC-015-2024', 'Registered during offline provisioning'),
(10, 1, 'disposal', 'conditioning_status', 'none', 'disposed', 'Disposed during offline provisioning'),
(11, 1, 'conditioning', 'conditioning_status', 'none', 'conditioned', 'Conditioned during offline provisioning'),
(11, 1, 'update', 'capsule_no_id', NULL, 'CPL-011', 'Capsule assigned'),
(11, 1, 'update', 'concrete_drum_no', NULL, 'DRM-011', 'Waste package assigned'),
(12, 1, 'create', 'source_record', NULL, 'SM-011-2017', 'Registered during offline provisioning'),
(13, 1, 'create', 'source_record', NULL, 'CS-088-2023', 'Registered during offline provisioning'),
(14, 1, 'create', 'source_record', NULL, 'CS-102-2024', 'Registered during offline provisioning');