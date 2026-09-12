const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA = path.join(__dirname, '..', 'database', 'schema.sqlite.sql');
const SEED = path.join(__dirname, '..', 'database', 'seed.sqlite.sql');

// Tables whose writes produce sync events (uploaded to the cloud when online).
const SYNC_TABLES = [
  'sources', 'institutions', 'source_photos', 'source_history',
  'source_measurements', 'source_leak_tests',
];

function tableOf(sql) {
  const m = sql.match(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:`)?(\w+)(?:`)?/i);
  return m ? m[1] : null;
}

function rowIdOf(sql, params) {
  if (/INSERT\s+INTO/i.test(sql)) return null;
  if (!/WHERE\s+id\s*=\s*\?/i.test(sql)) return null;
  return params[params.length - 1];
}

// Rewrites MySQL-isms into SQLite SQL.
function adapt(sql, params) {
  if (params !== null && params !== undefined && typeof params === 'object' && !Array.isArray(params)) {
    params = [params]; // mysql2-style bare object for "SET ?"
  }
  let stmt = sql;
  let values = params == null ? [] : Array.from(params).map((v) => (v === undefined ? null : v));

  const hasObject = Boolean(values[0] && typeof values[0] === 'object' && !Array.isArray(values[0]));

  if (hasObject) {
    const insertSet = stmt.match(/^INSERT\s+INTO\s+(?:`)?(\w+)(?:`)?\s+SET\s+\?$/i);
    const updateSet = stmt.match(/^UPDATE\s+(?:`)?(\w+)(?:`)?\s+SET\s+\?(\s+WHERE.*)?$/i);
    const entries = Object.entries(values[0]).filter(([, v]) => v !== undefined);
    if (insertSet && entries.length) {
      const keys = entries.map(([k]) => k).join(', ');
      const ph = entries.map(() => '?').join(', ');
      stmt = `INSERT INTO ${insertSet[1]} (${keys}) VALUES (${ph})`;
      values = [...entries.map(([, v]) => v), ...values.slice(1)];
    } else if (updateSet && entries.length) {
      const sets = entries.map(([k]) => `${k} = ?`).join(', ');
      stmt = `UPDATE ${updateSet[1]} SET ${sets}${updateSet[2] || ''}`;
      values = [...entries.map(([, v]) => v), ...values.slice(1)];
    }
  }

  if (/VALUES\s+\?/i.test(stmt) && Array.isArray(values[0]) && Array.isArray(values[0][0])) {
    const rows = values[0];
    const width = rows[0].length;
    const tuples = rows.map(() => `(${new Array(width).fill('?').join(',')})`).join(', ');
    stmt = stmt.replace(/VALUES\s+\?/i, `VALUES ${tuples}`);
    values = [...rows.flat(), ...values.slice(1)];
  }

  return { sql: stmt, params: values };
}

function init(dbFile) {
  const isMemory = dbFile === ':memory:';
  if (!isMemory) fs.mkdirSync(path.dirname(dbFile), { recursive: true });

  const raw = new Database(dbFile);
  raw.pragma('foreign_keys = ON');
  raw.pragma('journal_mode = WAL');

  const fresh = raw.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='users'").get().c === 0;
  if (fresh) {
    raw.exec(fs.readFileSync(SCHEMA, 'utf8'));
    raw.exec(fs.readFileSync(SEED, 'utf8'));
  }

  // Idempotent schema upgrades for existing offline DBs.
  const hasCol = (t, c) => raw.prepare(`PRAGMA table_info(${t})`).all().some((col) => col.name === c);
  if (!hasCol('sync_events', 'row_uuid')) {
    raw.exec('ALTER TABLE sync_events ADD COLUMN row_uuid TEXT');
  }

  let suppressSyncLog = false;
  const stmtCache = new Map();

  const query = async (sql, params) => {
    const { sql: finalSql, params: finalParams } = adapt(sql, params);

    let statement = stmtCache.get(finalSql);
    if (!statement) {
      statement = raw.prepare(finalSql);
      stmtCache.set(finalSql, statement);
    }

    // For single-row deletes, capture the row's uuid before it is gone so the
    // delete event can remove the counterpart row on the cloud too.
    const preDeleteUuid = (() => {
      const table = tableOf(finalSql);
      if (!table || !SYNC_TABLES.includes(table)) return null;
      const m = /^\s*DELETE/i.exec(finalSql);
      if (!m) return null;
      const rowId = rowIdOf(finalSql, finalParams);
      if (rowId === null || rowId === undefined) return null;
      const pre = raw.prepare(`SELECT sync_uuid AS u FROM ${table} WHERE id = ?`).get(rowId);
      return (pre && pre.u) || null;
    })();

    const out = statement.reader ? statement.all(...finalParams) : statement.run(...finalParams);

    const table = tableOf(finalSql);
    if (!suppressSyncLog && table && SYNC_TABLES.includes(table)) {
      const op = /INSERT/i.test(finalSql) ? 'insert' : /DELETE/i.test(finalSql) ? 'delete' : 'update';

      if (op === 'insert' && Array.isArray(params[0]) && Array.isArray(params[0][0])) {
        // Multi-row `VALUES ?` insert (e.g. source_photos / source_history batches).
        // better-sqlite3 only exposes the LAST insert rowid, so look up every
        // fresh row id by the sync_uuid carried in each tuple and log one event
        // per row — otherwise N-1 rows never replicate to the cloud.
        const uuids = params[0].map((r) => r[0]).filter((u) => u != null && String(u).trim() !== '');
        if (uuids.length) {
          const ins = raw.prepare('INSERT INTO sync_events (table_name, row_id, op) VALUES (?, ?, ?)');
          const got = raw.prepare(
            `SELECT id FROM ${table} WHERE sync_uuid IN (${uuids.map(() => '?').join(',')})`
          ).all(...uuids);
          for (const g of got) ins.run(table, g.id, 'insert');
        }
      } else if (op === 'delete') {
        const rowId = rowIdOf(finalSql, finalParams);
        if (rowId !== null && rowId !== undefined) {
          raw.prepare('INSERT INTO sync_events (table_name, row_id, row_uuid, op) VALUES (?, ?, ?, ?)').run(
            table,
            typeof rowId === 'bigint' ? Number(rowId) : rowId,
            preDeleteUuid,
            op
          );
        }
      } else {
        let rowId = null;
        if (op === 'insert') rowId = out.lastInsertRowid;
        else rowId = rowIdOf(finalSql, finalParams);
        if (rowId !== null && rowId !== undefined) {
          raw.prepare('INSERT INTO sync_events (table_name, row_id, op) VALUES (?, ?, ?)').run(
            table,
            typeof rowId === 'bigint' ? Number(rowId) : rowId,
            op
          );
        }
      }
    }

    if (statement.reader) return [out];
    const insertId = typeof out.lastInsertRowid === 'bigint' ? Number(out.lastInsertRowid) : out.lastInsertRowid;
    return [{ insertId, affectedRows: out.changes, changedRows: out.changes, fieldCount: 0 }];
  };

  return {
    engine: 'sqlite',
    file: dbFile,
    query,
    raw,
    end: async () => {
      stmtCache.clear();
      raw.close();
    },
    withSyncLog: (fn) => {
      const prev = suppressSyncLog;
      suppressSyncLog = true;
      try {
        return fn();
      } finally {
        suppressSyncLog = prev;
      }
    },
    pendingEvents: () => raw.prepare(
      "SELECT id, table_name, row_id, row_uuid, op FROM sync_events WHERE pushed_at IS NULL ORDER BY id"
    ).all(),
    markPushed: (ids) => {
      if (!ids.length) return;
      const ph = ids.map(() => '?').join(',');
      raw.prepare(`UPDATE sync_events SET pushed_at = datetime('now') WHERE id IN (${ph})`).run(...ids);
    },
  };
}

module.exports = { init };