// Headless E2E: boot sqlite local store + sync controller, sync against the
// real TiDB cloud configured in server/.env, print result, exit.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.whenReady().then(async () => {
  const dbFile = path.join(os.tmpdir(), 'dsrs-e2e.sqlite');
  try { fs.rmSync(dbFile, { force: true }); } catch {}
  process.env.DB_ENGINE = 'sqlite';
  process.env.DB_FILE = dbFile;

  const { init } = require('../server/config/sqlite');
  const { createSyncController } = require('../server/sync/controller');
  const local = init(dbFile);
  const ctl = createSyncController({ local });
  console.log('enabled:', ctl.status().enabled, 'online:', ctl.status().online);

  const t0 = Date.now();
  const result = await ctl.runSync();
  console.log('ELAPSED_MS:', Date.now() - t0);
  console.log('RESULT_STATUS:', JSON.stringify(result.enabled !== false ? {
    online: result.online !== undefined ? result.online : true,
    error: result.error || null,
    syncing: !!result.syncing,
    ...(result.result ? {
      pullSources: result.result.pull && result.result.pull.sources,
      pushSources: result.result.push && result.result.push.sources,
      pushHistory: result.result.push && result.result.push.source_history,
    } : {}),
  } : result));
  console.log('SUMMARY:', JSON.stringify({
    enabled: ctl.status().enabled,
    online: ctl.status().online,
    lastSyncAt: ctl.status().lastSyncAt,
    lastError: ctl.status().lastError,
  }));
  await local.end();
  try { fs.rmSync(dbFile, { force: true }); fs.rmSync(dbFile + '-wal', { force: true }); fs.rmSync(dbFile + '-shm', { force: true }); } catch {}
  process.exit(0);
});