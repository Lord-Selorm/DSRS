const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { SyncService } = require('./syncService');

// Sync controller for offline-first desktop mode. The local DB is the app DB
// (sqlite); the cloud is the TiDB cluster configured via DB_* env vars. When
// the app itself runs on the cloud engine (DB_ENGINE=mysql), sync is disabled
// so the live server never syncs with itself.
function createSyncController({ local, intervalMs = 60_000 }) {
  const engine = (process.env.DB_ENGINE || 'mysql').toLowerCase();
  const enabled = engine === 'sqlite' && Boolean(process.env.DB_HOST && process.env.DB_USER);

  let cloud = null;
  let service = null;
  let timer = null;
  const state = {
    enabled,
    online: false,
    syncing: false,
    lastSyncAt: null,
    lastCheckedAt: null,
    lastError: null,
    lastResult: null,
  };

  function loadCloud() {
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0,
      connectTimeout: 8000,
      ...(process.env.DB_SSL === 'true'
        ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } }
        : {}),
    });
    pool.engine = 'mysql';
    return pool;
  }

  async function pingCloud() {
    if (!cloud) cloud = loadCloud();
    try {
      await cloud.query('SELECT 1');
      state.online = true;
    } catch {
      state.online = false;
    }
    state.lastCheckedAt = new Date().toISOString();
    return state.online;
  }

  async function runSync() {
    if (!enabled) return { enabled: false };
    if (state.syncing) return { enabled: true, syncing: true };
    state.syncing = true;
    try {
      const online = await pingCloud();
      if (!online) {
        state.lastError = 'offline';
        return { enabled, online: false, error: 'offline' };
      }
      if (!service) service = new SyncService({ local, cloud });
      service.online = true;
      const pullResult = await service.pull();
      const pushResult = await service.push();
      state.lastResult = { pull: pullResult, push: pushResult };
      state.lastSyncAt = service.lastSyncAt = new Date().toISOString();
      state.lastError = null;
      return { enabled, online: true, result: state.lastResult };
    } catch (err) {
      state.lastError = err.message;
      return { enabled, online: state.online, error: err.message };
    } finally {
      state.syncing = false;
    }
  }

  function start() {
    if (!enabled || timer) return;
    runSync().catch(() => undefined);
    timer = setInterval(() => {
      runSync().catch(() => undefined);
    }, intervalMs);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function status() {
    return { ...state };
  }

  return { start, stop, runSync, status };
}

module.exports = { createSyncController };