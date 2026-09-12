const { uuid } = require('../utils/uuid');

const SYNC_TABLES = [
  'institutions', 'sources', 'source_photos', 'source_history',
  'source_measurements', 'source_leak_tests',
];

const PARENT_LOOKUP = {
  source_photos: { table: 'sources', fk: 'source_id' },
  source_history: { table: 'sources', fk: 'source_id' },
  source_measurements: { table: 'sources', fk: 'source_id' },
  source_leak_tests: { table: 'sources', fk: 'source_id' },
};

function ts(v) {
  if (v == null) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function pick(row, ...keys) {
  const out = {};
  for (const k of keys) out[k] = row[k] === undefined ? null : row[k];
  return out;
}

// Maps a local DB connection (better-sqlite3/mysql pool alike) onto a uniform
// helper contract: [rows] / [{insertId,...}] + query(), withSyncLog() (sqlite).
function isSqlite(db) {
  return db && db.engine === 'sqlite';
}

function clean(o) {
  const c = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) c[k] = v;
  }
  return c;
}

class SyncService {
  constructor({ local, cloud, logger = console }) {
    this.local = local;
    this.cloud = cloud;
    this.logger = logger;
    this.lastSyncAt = null;
    this.lastResult = null;
  }

  async maps() {
    const cloudD = (await this.cloud.query('SELECT id, radionuclide FROM d_values'))[0];
    const localD = (await this.local.query('SELECT id, radionuclide FROM d_values'))[0];
    return {
      cloudRadById: new Map(cloudD.map((d) => [String(d.id), d.radionuclide])),
      cloudRadByName: new Map(cloudD.map((d) => [String(d.radionuclide).toLowerCase(), d.id])),
      localRadById: new Map(localD.map((d) => [String(d.id), d.radionuclide])),
      localRadByName: new Map(localD.map((d) => [String(d.radionuclide).toLowerCase(), d.id])),
    };
  }

  // Column sets per connection, cached. Works for sqlite (PRAGMA) and mysql
  // (information_schema) so payloads are stripped of columns the target lacks.
  async columnsOf(db, table) {
    if (!db._cols) db._cols = {};
    if (db._cols[table]) return db._cols[table];
    let rows;
    if (isSqlite(db)) {
      rows = (await db.query(`PRAGMA table_info(${table})`))[0];
      db._cols[table] = new Set(rows.map((r) => r.name));
    } else {
      rows = (await db.query(
        'SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table]
      ))[0];
      db._cols[table] = new Set(rows.map((r) => r.name));
    }
    return db._cols[table];
  }

  async keepColumns(db, table, payload) {
    const cols = await this.columnsOf(db, table);
    for (const k of Object.keys(payload)) {
      if (!cols.has(k)) delete payload[k];
    }
    return payload;
  }

  async cloudRegistry(table, uuidValue) {
    const [rows] = await this.cloud.query(
      'SELECT cloud_id FROM sync_registry WHERE table_name = ? AND row_uuid = ? LIMIT 1',
      [table, uuidValue]
    );
    return rows[0] ? rows[0].cloud_id : null;
  }

  async registerCloud(table, uuidValue, cloudId) {
    await this.cloud.query(
      'INSERT INTO sync_registry (table_name, row_uuid, cloud_id) VALUES (?, ?, ?)',
      [table, uuidValue, cloudId]
    );
  }

  // Deletes a cloud row tracked (or at least tagged) by its sync_uuid and drops
  // its registry mapping so nothing is left behind in the cloud.
  async pushDelete(table, rowUuid) {
    let cloudId = await this.cloudRegistry(table, rowUuid);
    if (cloudId != null) {
      await this.cloud.query(`DELETE FROM ${table} WHERE id = ?`, [cloudId]);
    } else {
      await this.cloud.query(`DELETE FROM ${table} WHERE sync_uuid = ?`, [rowUuid]);
    }
    await this.cloud.query('DELETE FROM sync_registry WHERE table_name = ? AND row_uuid = ?', [table, rowUuid]);
  }

  async push() {
    const m = await this.maps();
    const stats = { institutions: 0, sources: 0, source_photos: 0, source_history: 0, source_measurements: 0, source_leak_tests: 0 };
    for (const table of SYNC_TABLES) {
      stats[table] = await this.pushTable(table, m);
    }
    return stats;
  }

  async pushTable(table, m) {
    const events = this.local.pendingEvents().filter((e) => e.table_name === table);
    if (!events.length) return 0;
    let done = 0;
    const failed = [];
    for (const ev of events) {
      try {
        const [rows] = await this.local.query(`SELECT * FROM ${table} WHERE id = ?`, [ev.row_id]);
        if (!rows.length) {
          // Deleting a row that survived a prior push would otherwise leave an
          // orphan on the cloud: route the delete through the registry.
          if (ev.op === 'delete' && ev.row_uuid) {
            await this.pushDelete(table, ev.row_uuid);
          }
          this.local.markPushed([ev.id]);
          continue;
        }
        await this.pushRow(table, rows[0], m);
        this.local.markPushed([ev.id]);
        done += 1;
      } catch (err) {
        failed.push(ev.id);
        this.logger.warn(`[sync] ${table} row ${ev.row_id} (event ${ev.id}): ${err.message}`);
      }
    }
    if (failed.length) this.logger.warn(`[sync] ${table}: ${failed.length} events deferred`);
    return done;
  }

  async pushRow(table, localRow, m) {
    if (table === 'institutions') {
      await this.pushInstitution(localRow);
      return;
    }
    if (table === 'sources') {
      await this.pushSource(localRow, m);
      return;
    }
    await this.pushChild(table, localRow, m);
  }

  async ensureCloudInstitution(localInst) {
    const u = localInst.sync_uuid;
    if (u) {
      let cloudId = await this.cloudRegistry('institutions', u);
      if (cloudId) return cloudId;
      const [byUuid] = await this.cloud.query('SELECT id FROM institutions WHERE sync_uuid = ? LIMIT 1', [u]);
      if (byUuid[0]) {
        cloudId = byUuid[0].id;
        await this.registerCloud('institutions', u, cloudId);
        return cloudId;
      }
    }
    const [byName] = await this.cloud.query('SELECT id FROM institutions WHERE name = ? LIMIT 1', [localInst.name]);
    if (byName[0]) {
      const nid = byName[0].id;
      if (u) await this.registerCloud('institutions', u, nid);
      return nid;
    }
    const payload = clean({ ...localInst, sync_uuid: u });
    delete payload.id;
    const [res] = await this.cloud.query('INSERT INTO institutions SET ?', [payload]);
    const cloudId = res.insertId;
    if (u) await this.registerCloud('institutions', u, cloudId);
    return cloudId;
  }

  async pushInstitution(localInst) {
    const cloudId = await this.ensureCloudInstitution(localInst);
    const payload = clean({ ...localInst });
    delete payload.id;
    const [existing] = await this.cloud.query('SELECT id FROM institutions WHERE id = ?', [cloudId]);
    if (existing[0]) {
      const cloudPayload = await this.keepColumns(this.cloud, 'institutions', payload);
      await this.cloud.query('UPDATE institutions SET ? WHERE id = ?', [cloudPayload, cloudId]);
    }
  }

  async cloudSourceId(localSource) {
    if (localSource.sync_uuid) {
      let id = await this.cloudRegistry('sources', localSource.sync_uuid);
      if (id) return id;
      const [byUuid] = await this.cloud.query('SELECT id FROM sources WHERE sync_uuid = ? LIMIT 1', [localSource.sync_uuid]);
      if (byUuid[0]) {
        id = byUuid[0].id;
        await this.registerCloud('sources', localSource.sync_uuid, id);
        return id;
      }
    }
    if (localSource.source_serial_no || localSource.source_barcode) {
      const key = localSource.source_barcode || localSource.source_serial_no;
      const col = localSource.source_barcode ? 'source_barcode' : 'source_serial_no';
      const [byKey] = await this.cloud.query(`SELECT id FROM sources WHERE ${col} = ? LIMIT 1`, [key]);
      if (byKey[0]) {
        if (localSource.sync_uuid) await this.registerCloud('sources', localSource.sync_uuid, byKey[0].id);
        return byKey[0].id;
      }
    }
    return null;
  }

  async pushSource(localRow, m) {
    let cloudId = await this.cloudSourceId(localRow);
    const radName = m.localRadById.get(String(localRow.radionuclide_id));
    const cloudRadId = radName ? m.cloudRadByName.get(String(radName).toLowerCase()) : null;

    const owner = async (localId) => {
      if (!localId) return null;
      const [rows] = await this.local.query('SELECT * FROM institutions WHERE id = ?', [localId]);
      if (!rows[0]) return null;
      return this.ensureCloudInstitution(rows[0]);
    };

    const payload = clean({ ...localRow });
    delete payload.id;
    delete payload.created_by;
    payload.radionuclide_id = cloudRadId || null;
payload.original_owner_id = await owner(localRow.original_owner_id);
    payload.current_owner_id = await owner(localRow.current_owner_id);

    const cloudPayload = await this.keepColumns(this.cloud, 'sources', payload);
    if (cloudId) {
      await this.cloud.query('UPDATE sources SET ? WHERE id = ?', [cloudPayload, cloudId]);
    } else {
      const [res] = await this.cloud.query('INSERT INTO sources SET ?', [cloudPayload]);
      cloudId = res.insertId;
      if (localRow.sync_uuid) await this.registerCloud('sources', localRow.sync_uuid, cloudId);
    }
  }
  async pushChild(table, localRow, m) {
    const [parentLocal] = await this.local.query(
      `SELECT * FROM sources WHERE id = ?`, [localRow[PARENT_LOOKUP[table].fk]]
    );
    if (!parentLocal[0]) return;
    const cloudParentId = await this.cloudSourceId(parentLocal[0]);
    if (!cloudParentId) return;

    if (localRow.sync_uuid) {
      const byUuid = await this.cloudRegistry(table, localRow.sync_uuid);
      if (byUuid) {
        const payload = clean({ ...localRow });
        delete payload.id;
        payload.source_id = cloudParentId;
        const cloudPayload = await this.keepColumns(this.cloud, table, payload);
        await this.cloud.query(`UPDATE ${table} SET ? WHERE id = ?`, [cloudPayload, byUuid]);
        return;
      }
    }

    const payload = clean({ ...localRow });
    delete payload.id;
    payload.source_id = cloudParentId;
    const cloudPayload = await this.keepColumns(this.cloud, table, payload);
    const [res] = await this.cloud.query(`INSERT INTO ${table} SET ?`, [cloudPayload]);
    if (localRow.sync_uuid) await this.registerCloud(table, localRow.sync_uuid, res.insertId);
  }

  async pull() {
    const m = await this.maps();
    const stats = { institutions: 0, sources: 0, source_photos: 0, source_history: 0, source_measurements: 0, source_leak_tests: 0 };
    for (const table of SYNC_TABLES) {
      stats[table] = await this.pullTable(table, m);
    }
    return stats;
  }

  async pullTable(table, m) {
    const cloudRows = (await this.cloud.query(`SELECT * FROM ${table}`))[0];
    let inserted = 0;
    let updated = 0;
    let adopted = 0;
    let skipped = 0;
    for (const c of cloudRows) {
      let u = c.sync_uuid;
      if (!u) {
        u = uuid();
        await this.cloud.query(`UPDATE ${table} SET sync_uuid = ? WHERE id = ?`, [u, c.id]);
        await this.registerCloud(table, u, c.id);
        c.sync_uuid = u;
      }

      const existing = ((await this.local.query(`SELECT * FROM ${table} WHERE sync_uuid = ?`, [u]))[0] || [])[0];
      if (!existing) {
        const res = await this.adoptOrInsertLocal(table, c, m);
        if (res && res.adopted) adopted += 1;
        else inserted += 1;
        continue;
      }

      const cloudTs = ts(c.updated_at || c.created_at);
      const localTs = ts(existing.updated_at || existing.created_at);
      if (localTs > cloudTs) {
        skipped += 1;
        continue;
      }
      const payload = await this.translateForLocal(table, c, m);
      delete payload.id;
      delete payload.sync_uuid;
      await this.local.withSyncLog(() => this.local.query(`UPDATE ${table} SET ? WHERE sync_uuid = ?`, [payload, u]));
      updated += 1;
    }
    return { inserted, updated, adopted, skipped, total: cloudRows.length };
  }

  // Adopts a cloud row onto a matching local seed row (by natural key) when possible,
  // otherwise inserts a fresh local row. Returns the local id or null.
  async adoptOrInsertLocal(table, c, m) {
    let match = null;
    if (table === 'institutions' && c.name != null) {
      match = (await this.local.query('SELECT id, sync_uuid FROM institutions WHERE name = ? LIMIT 1', [c.name]))[0][0];
    } else if (table === 'sources') {
      const key = c.source_barcode || c.source_serial_no;
      if (key != null) {
        const col = c.source_barcode ? 'source_barcode' : 'source_serial_no';
        match = (await this.local.query(`SELECT id, sync_uuid FROM sources WHERE ${col} = ? LIMIT 1`, [key]))[0][0];
      }
    }
    if (match) {
      await this.local.withSyncLog(() =>
        this.local.query(`UPDATE ${table} SET sync_uuid = ? WHERE id = ?`, [c.sync_uuid, match.id])
      );
      if (c.sync_uuid) await this.local.query(
        'INSERT INTO sync_registry (table_name, row_uuid, cloud_id) VALUES (?, ?, ?)',
        [table, c.sync_uuid, c.id]
      );
      return { localId: match.id, adopted: true };
    }

    const payload = clean(await this.translateForLocal(table, c, m));
    delete payload.id;
    const [res] = await this.local.withSyncLog(() => this.local.query(`INSERT INTO ${table} SET ?`, [payload]));
    return { localId: res.insertId, adopted: false };
  }

  // Translates cloud FK ids into local ids before writing locally.
  async translateForLocal(table, c, m) {
    const payload = clean({ ...c });
    delete payload.id;
    for (const [k, v] of Object.entries(payload)) {
      if (v instanceof Date) payload[k] = v.toISOString().slice(0, 19).replace('T', ' ');
    }
    if (table === 'sources') {
      const radName = m.cloudRadById.get(String(c.radionuclide_id));
      payload.radionuclide_id = radName ? m.localRadByName.get(String(radName).toLowerCase()) : null;
      payload.original_owner_id = await this.localInstByCloudUuid(c.original_owner_id);
      payload.current_owner_id = await this.localInstByCloudUuid(c.current_owner_id);
      payload.created_by = null;
    } else if (PARENT_LOOKUP[table]) {
      payload.source_id = await this.localSourceByCloudId(c.source_id);
    }
    return this.keepColumns(this.local, table, payload);
  }

  async localInstByCloudUuid(cloudId) {
    if (cloudId == null) return null;
    const [reg] = await this.cloud.query('SELECT row_uuid FROM sync_registry WHERE table_name = ? AND cloud_id = ? LIMIT 1', ['institutions', cloudId]);
    if (!reg[0]) {
      const [inst] = await this.cloud.query('SELECT sync_uuid FROM institutions WHERE id = ?', [cloudId]);
      if (inst[0] && inst[0].sync_uuid) reg.push({ row_uuid: inst[0].sync_uuid });
    }
    if (!reg[0] || !reg[0].row_uuid) return null;
    const [local] = await this.local.query('SELECT id FROM institutions WHERE sync_uuid = ? LIMIT 1', [reg[0].row_uuid]);
    return local[0] ? local[0].id : null;
  }

  async localSourceByCloudId(cloudId) {
    if (cloudId == null) return null;
    const [reg] = await this.cloud.query('SELECT row_uuid FROM sync_registry WHERE table_name = ? AND cloud_id = ? LIMIT 1', ['sources', cloudId]);
    if (!reg[0]) {
      const [src] = await this.cloud.query('SELECT sync_uuid FROM sources WHERE id = ?', [cloudId]);
      if (src[0] && src[0].sync_uuid) reg.push({ row_uuid: src[0].sync_uuid });
    }
    if (!reg[0] || !reg[0].row_uuid) return null;
    const [local] = await this.local.query('SELECT id FROM sources WHERE sync_uuid = ? LIMIT 1', [reg[0].row_uuid]);
    return local[0] ? local[0].id : null;
  }

  status() {
    return {
      engine: 'sqlite',
      online: this.online !== false,
      lastSyncAt: this.lastSyncAt,
      lastResult: this.lastResult,
    };
  }
}

module.exports = { SyncService, SYNC_TABLES, isSqlite };