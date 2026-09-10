const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { init } = require('../config/sqlite');
const { SyncService } = require('../sync/syncService');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dsrs-sync-'));
let local, cloud, svc;

before(async () => {
  local = init(path.join(DIR, 'local.sqlite'));
  cloud = init(path.join(DIR, 'cloud.sqlite'));
  cloud.engine = 'sqlite';

  // Cloud fixture: wipe seed sources/history, add two UUID-bearing sources.
  await cloud.query('DELETE FROM source_history');
  await cloud.query('DELETE FROM sources');
  await cloud.query("INSERT INTO sources SET ?", {
    sync_uuid: 'uu-cl-1-000000000000', device_serial_no: 'CLU-STD', source_serial_no: 'CLOUD-1',
    source_barcode: 'CLOUD-BAR-1', radionuclide_id: 8, current_activity: 5, current_activity_unit: 'GBq',
    source_classification: 3, original_owner_id: 1, current_owner_id: 2, created_by: 1,
    measurement_date: '2026-01-01',
  });
  await cloud.query("INSERT INTO sources SET ?", {
    sync_uuid: 'uu-cl-2-000000000000', device_serial_no: 'CLU-REF', source_serial_no: 'CLOUD-2',
    source_barcode: 'CLOUD-BAR-2', radionuclide_id: 9, current_activity: 2, current_activity_unit: 'GBq',
    source_classification: 4, original_owner_id: 1, current_owner_id: 1, created_by: 1,
  });

  svc = new SyncService({ local, cloud });
});

after(async () => {
  await local.end();
  await cloud.end();
  fs.rmSync(DIR, { recursive: true, force: true });
});

test('pull mirrors cloud rows into a fresh local database', async () => {
  const res = await svc.pull();
  assert.strictEqual(res.sources.inserted, 2, 'cloud sources pulled');
  assert.ok(res.institutions.adopted >= 7, 'seed institutions adopted by name');

  const [rows] = await local.query("SELECT s.*, o.name AS owner FROM sources s LEFT JOIN institutions o ON s.current_owner_id = o.id WHERE s.source_serial_no = 'CLOUD-1'");
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].sync_uuid, 'uu-cl-1-000000000000');
  assert.strictEqual(rows[0].owner, 'Komfo Anokye Teaching Hospital', 'owner FK translated by uuid');

  const [photoRes] = await local.query('SELECT COUNT(*) AS c FROM sources WHERE sync_uuid IS NULL');
  assert.ok(Number(photoRes[0].c) >= 14, 'seed sources untouched');
});

test('push uploads locally-created rows (with owner + radionuclide translation)', async () => {
  await local.query("INSERT INTO sources SET ?", {
    sync_uuid: 'uu-lo-7-000000000000', device_serial_no: 'LOC-STD', source_serial_no: 'LOCAL-1',
    source_barcode: 'LOCAL-BAR-1', radionuclide_id: 8, current_activity: 7, current_activity_unit: 'GBq',
    source_classification: 3, original_owner_id: 1, current_owner_id: 2, created_by: 1,
  });
  const [srcId] = await local.query("SELECT id FROM sources WHERE source_serial_no = 'LOCAL-1'");
  await local.query("INSERT INTO source_history (sync_uuid, source_id, changed_by, change_type, field_changed, previous_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ['uu-lo-h1-000000000000', srcId[0].id, 1, 'create', 'source_record', null, 'LOCAL-1']);

  assert.ok(local.pendingEvents().length >= 2, 'sync events recorded');
  const res = await svc.push();
  assert.strictEqual(res.sources, 1);
  assert.ok(res.source_history >= 1);

  const [cloudRows] = await cloud.query("SELECT * FROM sources WHERE source_serial_no = 'LOCAL-1'");
  assert.strictEqual(cloudRows.length, 1);
  assert.strictEqual(cloudRows[0].sync_uuid, 'uu-lo-7-000000000000');
  assert.strictEqual(cloudRows[0].radionuclide_id, 8, 'radionuclide map preserved across stores');
  assert.strictEqual(cloudRows[0].current_owner_id, 2, 'owner id translated to cloud id');
  assert.strictEqual(cloudRows[0].created_by, null);

  const [cloudHist] = await cloud.query("SELECT * FROM source_history WHERE new_value = 'LOCAL-1'");
  assert.strictEqual(cloudHist.length, 1);
  assert.ok(cloudHist[0].source_id === cloudRows[0].id, 'child linked to cloud parent');

  assert.strictEqual(local.pendingEvents().length, 0, 'events cleared after push');
});

test('subsequent push updates instead of duplicating', async () => {
  const [src] = await local.query("SELECT id FROM sources WHERE source_serial_no = 'LOCAL-1'");
  await local.query('UPDATE sources SET current_activity = 11 WHERE id = ?', [src[0].id]);
  await svc.push();
  const [cloudRows] = await cloud.query("SELECT * FROM sources WHERE source_serial_no = 'LOCAL-1'");
  assert.strictEqual(cloudRows.length, 1, 'no duplicate rows');
  assert.strictEqual(Number(cloudRows[0].current_activity), 11);
});

test('concurrent cloud change is pulled down when cloud is newer', async () => {
  await cloud.query("UPDATE sources SET current_activity = 42 WHERE source_serial_no = 'CLOUD-2'");
  // ensure cloud updated_at is newer than local
  await cloud.query("UPDATE sources SET current_activity = 43 WHERE source_serial_no = 'CLOUD-2'");
  const res = await svc.pull();
  assert.ok(res.sources.updated >= 1, 'cloud-newer rows refreshed');
  const [localRows] = await local.query("SELECT current_activity FROM sources WHERE source_serial_no = 'CLOUD-2'");
  assert.strictEqual(Number(localRows[0].current_activity), 43);
});