USE dsrs_db;

-- ============================================================
-- D-VALUES REFERENCE DATA (32 radionuclides)
-- ============================================================
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

-- ============================================================
-- DEFAULT ADMIN USER (password: admin123)
-- bcrypt hash of 'admin123'
-- ============================================================
INSERT INTO users (username, password_hash, full_name, email, role) VALUES
('admin', '$2a$10$ikGdxcWlS7FI1ONy9pzq.e8UhZYEzF1EeSnv1gwwYAUjOWt3SDNFK', 'System Administrator', 'admin@dsrs.local', 'admin');

-- ============================================================
-- SAMPLE INSTITUTIONS
-- ============================================================
INSERT INTO institutions (name, code, address, contact_person, contact_phone, contact_email) VALUES
('Korle Bu Teaching Hospital', 'KBTH', 'Accra, Ghana', 'Dr. A. Mensah', '+233-302-123456', 'info@kbth.gov.gh'),
('Komfo Anokye Teaching Hospital', 'KATH', 'Kumasi, Ghana', 'Dr. K. Asare', '+233-322-654321', 'info@kath.gov.gh'),
('National Nuclear Research Institute', 'NNRI', 'Accra, Ghana', 'Prof. S. Adjei', '+233-302-789012', 'info@nnri.gov.gh');
