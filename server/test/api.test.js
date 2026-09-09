const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index');
const pool = require('../config/db');

const DEMO_USERNAME = process.env.DEMO_USERNAME || 'demo';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!';

let server;
let base;
let token;
let testSourceId;
const createStamp = `TEST-${Date.now()}`;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.on('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await pool.query("DELETE FROM sources WHERE source_barcode LIKE 'TEST-%' OR source_serial_no LIKE 'TEST-%' OR nra_registration_no LIKE '%TEST-%'");
  await pool.end();
  await new Promise((resolve) => server.close(resolve));
});

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.token !== false && token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json')
    ? await res.json()
    : { buffer: Buffer.from(await res.arrayBuffer()), contentType: ct };
  return { status: res.status, data };
}

// ---------------------------------------------------------------
// Health & auth
// ---------------------------------------------------------------
test('GET /api/health returns ok', async () => {
  const { status, data } = await api('/api/health', { token: false });
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(data, { status: 'ok' });
});

test('sources require auth', async () => {
  const { status } = await api('/api/sources', { token: false });
  assert.strictEqual(status, 401);
});

test('login rejects bad credentials', async () => {
  const { status } = await api('/api/auth/login', {
    method: 'POST',
    token: false,
    body: { username: DEMO_USERNAME, password: 'wrong-password' },
  });
  assert.strictEqual(status, 401);
});

test('demo login returns a token', async () => {
  const { status, data } = await api('/api/auth/login', {
    method: 'POST',
    token: false,
    body: { username: DEMO_USERNAME, password: DEMO_PASSWORD },
  });
  assert.strictEqual(status, 200);
  assert.ok(data.token);
  token = data.token;
});

test('non-admin cannot list users', async () => {
  const { status } = await api('/api/users');
  assert.strictEqual(status, 403);
});

// ---------------------------------------------------------------
// Reference data: d-values table must match the source document
// ---------------------------------------------------------------
test('d_values table has 32 radionuclides', async () => {
  const { status, data } = await api('/api/sources/d-values');
  assert.strictEqual(status, 200);
  assert.strictEqual(data.length, 32);
});

test('spot-check documented D-values (TBq)', async () => {
  const { data } = await api('/api/sources/d-values');
  const byName = Object.fromEntries(data.map((d) => [d.radionuclide, Number(d.d_value_tbq)]));
  const expected = {
    'Am-241': 0.06, 'Co-60': 0.03, 'Cs-137': 0.1, 'Fe-55': 800,
    'H-3': 2000, 'Ir-192': 0.08, 'Ra-226': 0.04, 'Tc-99m': 0.7,
    'Tl-204': 20, 'Tm-170': 20, 'Sr-90': 1, 'Ru-106': 0.3,
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.ok(byName[name], `missing ${name}`);
    assert.ok(Math.abs(byName[name] - value) < 1e-6, `${name} expected ${value} got ${byName[name]}`);
  }
});

// ---------------------------------------------------------------
// Categorization logic (A/D thresholds from the source document)
// ---------------------------------------------------------------
test('category thresholds match A/D boundaries', async () => {
  const { data: dValues } = await api('/api/sources/d-values');
  const co60 = dValues.find((d) => d.radionuclide === 'Co-60');
  assert.ok(co60);
  const cases = [ // current_activity in TBq, expected category
    [30, 1],       // A/D = 1000  -> Cat 1
    [15, 2],       // A/D = 500   -> Cat 2
    [0.3, 2],      // A/D = 10    -> Cat 2
    [0.15, 3],     // A/D = 5     -> Cat 3
    [0.03, 3],     // A/D = 1     -> Cat 3
    [0.015, 4],    // A/D = 0.5   -> Cat 4
    [0.0003, 4],   // A/D = 0.01  -> Cat 4
    [0.00003, 5],  // A/D = 0.001 -> Cat 5
  ];
  for (const [activity, expectedCat] of cases) {
    const { status, data } = await api('/api/sources/calculate-category', {
      method: 'POST',
      body: { radionuclide_id: co60.id, current_activity: activity },
    });
    assert.strictEqual(status, 200, `activity=${activity}`);
    assert.strictEqual(data.category, expectedCat, `activity=${activity} expected Cat ${expectedCat}`);
  }
});

// ---------------------------------------------------------------
// Source CRUD + auto-classification + audit + search
// ---------------------------------------------------------------
test('create source auto-classifies with unit conversion (GBq -> TBq)', async () => {
  const { data: dValues } = await api('/api/sources/d-values');
  const co60 = dValues.find((d) => d.radionuclide === 'Co-60');
  const payload = {
    radionuclide_id: co60.id,
    current_activity: 30000,       // 30000 GBq = 30 TBq -> A/D = 1000 -> Cat 1
    current_activity_unit: 'GBq',
    source_barcode: `${createStamp}-001`,
    source_serial_no: `${createStamp}-001S`,
    device_serial_no: `${createStamp}-D`,
    nra_registration_no: `NRA/T/${createStamp}`,
    manufacturer: 'Test Manufacturing Ltd',
    storage_facility_unit: 'Test Vault A',
  };
  const { status, data } = await api('/api/sources', { method: 'POST', body: payload });
  assert.strictEqual(status, 201);
  testSourceId = data.id;
});

test('created source detail has category, join data and audit history', async () => {
  assert.ok(testSourceId, 'requires previous test');
  const { status, data } = await api(`/api/sources/${testSourceId}`);
  assert.strictEqual(status, 200);
  assert.strictEqual(data.source_classification, 1);
  assert.strictEqual(data.radionuclide, 'Co-60');
  assert.ok(Number(data.d_value_tbq) > 0);
  const createEvent = (data.history || []).find((h) => h.change_type === 'create');
  assert.ok(createEvent, 'expected a create audit event');
});

test('update recalculates category and appends history', async () => {
  assert.ok(testSourceId, 'requires previous test');
  // 0.03 TBq -> A/D = 1 -> Cat 3
  const { status } = await api(`/api/sources/${testSourceId}`, {
    method: 'PUT',
    body: { current_activity: 0.03, current_activity_unit: 'TBq', current_owner_id: 1 },
  });
  assert.strictEqual(status, 200);
  const { data } = await api(`/api/sources/${testSourceId}`);
  assert.strictEqual(data.source_classification, 3);
  assert.ok((data.history || []).some((h) => h.field_changed === 'current_activity'));
});

test('search filters by radionuclide and partial serial', async () => {
  assert.ok(testSourceId, 'requires previous test');
  const byRadio = await api(`/api/sources?radionuclide=Co-60`)
  assert.strictEqual(byRadio.status, 200);
  assert.ok(String(byRadio.data.total) >= '1');
  for (const row of byRadio.data.rows) { assert.strictEqual(row.radionuclide, 'Co-60'); }

  const bySerial = await api(`/api/sources?nra_registration_no=${createStamp}`);
  assert.strictEqual(bySerial.status, 200);
  assert.strictEqual(bySerial.data.total, 1);
  assert.strictEqual(bySerial.data.rows[0].id, testSourceId);
});

// ---------------------------------------------------------------
// QR + barcode rendering
// ---------------------------------------------------------------
async function readPng(path) {
  const res = await api(path);
  assert.strictEqual(res.status, 200);
  assert.ok(res.data.contentType.includes('image/png'), `expected png, got ${res.data.contentType}`);
  assert.ok(res.data.buffer.length > 100, 'image too small');
  assert.strictEqual(res.data.buffer.readUInt32BE(0), 0x89504e47, 'not a PNG signature');
  return res.data.buffer;
}

test('QR code is generated as PNG', async () => {
  assert.ok(testSourceId, 'requires previous test');
  await readPng(`/api/sources/${testSourceId}/qrcode`);
});

test('barcode is generated as PNG (code128 of source_barcode)', async () => {
  assert.ok(testSourceId, 'requires previous test');
  await readPng(`/api/sources/${testSourceId}/barcode`);
});

test('barcode falls back to source_serial_no', async () => {
  const { data: dValues } = await api('/api/sources/d-values');
  const co60 = dValues.find((d) => d.radionuclide === 'Co-60');
  const created = await api('/api/sources', {
    method: 'POST',
    body: {
      radionuclide_id: co60.id,
      current_activity: 0.01,
      current_activity_unit: 'TBq',
      source_serial_no: `${createStamp}-NOSERIAL`,
      source_barcode: '',
    },
  });
  assert.strictEqual(created.status, 201);
  await readPng(`/api/sources/${created.data.id}/barcode`);
});

test('unknown source returns 404 for both code endpoints', async () => {
  assert.strictEqual((await api(`/api/sources/999999/qrcode`)).status, 404);
  assert.strictEqual((await api(`/api/sources/999999/barcode`)).status, 404);
});

// ---------------------------------------------------------------
// Reference data that seed loading guarantees
// ---------------------------------------------------------------
test('seed institutions present', async () => {
  const { status, data } = await api('/api/institutions');
  assert.strictEqual(status, 200);
  assert.ok(data.length >= 3, `expected >=3 institutions, got ${data.length}`);
});