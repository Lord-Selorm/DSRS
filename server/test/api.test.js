const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index');
const pool = require('../config/db');
const XLSX = require('xlsx');

const DEMO_USERNAME = process.env.DEMO_USERNAME || 'demo';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!';

let server;
let base;
let token;
let testSourceId;
let seedSourceId;
const createStamp = `TEST-${Date.now()}`;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.on('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const [[row]] = await pool.query('SELECT id FROM sources ORDER BY id LIMIT 1');
  seedSourceId = row?.id;
});

after(async () => {
  await pool.query("DELETE FROM sources WHERE source_barcode LIKE 'TEST-%' OR source_serial_no LIKE '%TEST-%' OR source_serial_no LIKE 'IMP-TEST-%' OR nra_registration_no LIKE '%TEST-%'");
  await pool.end();
  await new Promise((resolve) => server.close(resolve));
});

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.token !== false && token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined && !opts.raw) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? (opts.raw ? opts.body : JSON.stringify(opts.body)) : undefined,
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

test('public trace endpoint returns a source without auth', async () => {
  const { status, data } = await api(`/api/public/sources/${seedSourceId}`, { token: false });
  assert.strictEqual(status, 200);
  assert.strictEqual(data.id, seedSourceId);
  assert.ok(Array.isArray(data.history));
  assert.ok(Array.isArray(data.measurements));
});

test('public trace returns 404 for unknown source', async () => {
  const { status } = await api('/api/public/sources/999999', { token: false });
  assert.strictEqual(status, 404);
});

test('public trace qrcode returns a PNG without auth', async () => {
  const { status, data } = await api(`/api/public/sources/${seedSourceId}/qrcode`, { token: false });
  assert.strictEqual(status, 200);
  assert.strictEqual(data.contentType, 'image/png');
  assert.ok(data.buffer.length > 100);
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

test('duplicate username is rejected when changing credentials', async () => {
  const { status } = await api('/api/auth/password', {
    method: 'POST',
    body: { current_password: DEMO_PASSWORD, new_password: 'SomeNewPass!2026', new_username: 'admin' },
  });
  assert.strictEqual(status, 400);
});

test('user can set own username + password on forced setup, then login with the new username', async () => {
  const uname = `setown_${Date.now().toString(36)}`;
  const pass = 'BrandNew#Pass123';
  const { status, data } = await api('/api/auth/password', {
    method: 'POST',
    body: { current_password: DEMO_PASSWORD, new_password: pass, new_username: uname },
  });
  assert.strictEqual(status, 200);
  assert.strictEqual(data.user.username, uname);
  assert.strictEqual(data.user.must_change_password, false);
  assert.ok(data.token);

  const login = await api('/api/auth/login', {
    method: 'POST',
    token: false,
    body: { username: uname, password: pass },
  });
  assert.strictEqual(login.status, 200);
  assert.strictEqual(login.data.user.username, uname);

  // restore demo credentials for other tests
  token = data.token;
  const restore = await api('/api/auth/password', {
    method: 'POST',
    body: { current_password: pass, new_password: DEMO_PASSWORD, new_username: DEMO_USERNAME },
  });
  assert.strictEqual(restore.status, 200);
  token = restore.data.token;
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

test('list paginates with limit/offset and returns category totals', async () => {
  const page1 = await api('/api/sources?limit=2&offset=0');
  assert.strictEqual(page1.status, 200);
  assert.strictEqual(page1.data.rows.length, 2);
  assert.ok(Number(page1.data.total) >= 2);
  assert.ok(Array.isArray(page1.data.categoryTotals));

  const page2 = await api('/api/sources?limit=2&offset=2');
  assert.strictEqual(page2.status, 200);
  assert.strictEqual(page2.data.rows.length, 2);
  assert.notStrictEqual(page2.data.rows[0].id, page1.data.rows[0].id);
});

test('generic q search covers serial and owner name, high_risk keeps cat 1-2', async () => {
  assert.ok(testSourceId, 'requires previous test');
  const byQ = await api(`/api/sources?q=${createStamp}`);
  assert.strictEqual(byQ.status, 200);
  assert.strictEqual(byQ.data.total, 1);
  assert.strictEqual(byQ.data.rows[0].id, testSourceId);

  const risky = await api('/api/sources?high_risk=1&limit=100&offset=0');
  assert.strictEqual(risky.status, 200);
  for (const row of risky.data.rows) {
    assert.ok(row.source_classification === 1 || row.source_classification === 2);
  }
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

test('bulk import registers sources from an xlsx workbook and reports bad rows', async () => {
  const stamp = Date.now().toString(36);
  const ws = XLSX.utils.json_to_sheet([
    {
      'Source Serial No.': `IMP-TEST-${stamp}`,
      Radionuclide: 'Co-60',
      'Original Activity': 1,
      'Original Activity Unit': 'GBq',
      'Original Activity Date': '2020-01-01',
      'Current Activity': 0.9,
      'Current Activity Unit': 'GBq',
      'Current Activity Date': '2026-01-01',
      Date: 'not-a-column',
    },
    {
      'Source Serial No.': `IMP-TEST-${stamp}-BAD`,
      Radionuclide: 'NotARealNuclide',
      'Current Activity': 1,
    },
    {
      'Source Serial No.': `IMP-TEST-${stamp}-NOACT`,
      Radionuclide: 'Cs-137',
    },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sources');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `imp-${stamp}.xlsx`);

  const { status, data } = await api('/api/sources/import', { method: 'POST', raw: true, body: fd });
  assert.strictEqual(status, 201);
  assert.strictEqual(data.created, 1);
  assert.strictEqual(data.skipped, 2);
  assert.ok(data.errors.some((e) => /not-a-column/i.test(e.reason) === false));
  assert.ok(data.errors.some((e) => e.reason.includes('unknown radionuclide')));
  assert.ok(data.errors.some((e) => e.reason.includes('missing current activity')));
  assert.ok(Array.isArray(data.unmappedHeaders) && data.unmappedHeaders.includes('Date'));

  const listed = await api('/api/sources');
  assert.strictEqual(listed.status, 200);
  const found = listed.data.rows.find((r) => r.source_serial_no === `IMP-TEST-${stamp}`);
  assert.ok(found, 'imported source should be listed');
  assert.strictEqual(found.radionuclide, 'Co-60');
});

test('bulk import auto-detects a category banner row above the real headers', async () => {
  const stamp = Date.now().toString(36) + 'b';
  const aoa = [
    ['Unique ID variables', null, null, null, 'Radionuclide Variables', null],
    ['Device Serial No.', 'Source serial No.', 'NRA Registration No.', 'Source barcode', 'Radionuclide', 'Current Activity', 'Source Certficate No.'],
    ['IMP-BANNER-DEV', `IMP-TEST-${stamp}`, 'NRA/B/1', 'SRC-BANNER', 'Co-60', 0.5, 'SRC-CERT/1'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sources');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `banner-${stamp}.xlsx`);

  const { status, data } = await api('/api/sources/import', { method: 'POST', raw: true, body: fd });
  assert.strictEqual(status, 201);
  assert.strictEqual(data.created, 1);
  assert.strictEqual(data.skipped, 0);
  assert.ok(data.unmappedHeaders.includes('Source Certficate No.'), 'unrecognised header labels surface as unmapped');

  const listed = await api('/api/sources');
  const found = listed.data.rows.find((r) => r.source_serial_no === `IMP-TEST-${stamp}`);
  assert.ok(found, 'banner-format import should register the source');
  assert.strictEqual(found.device_serial_no, 'IMP-BANNER-DEV');
  assert.strictEqual(found.nra_registration_no, 'NRA/B/1');
});

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