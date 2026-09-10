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

  let suppressSyncLog = false;
  const stmtCache = new Map();

  const query = async (sql, params) => {
    const { sql: finalSql, params: finalParams } = adapt(sql, params);

    let statement = stmtCache.get(finalSql);
    if (!statement) {
      statement = raw.prepare(finalSql);
      stmtCache.set(finalSql, statement);
    }

    const out = statement.reader ? statement.all(...finalParams) : statement.run(...finalParams);

    const table = tableOf(finalSql);
    if (!suppressSyncLog && table && SYNC_TABLES.includes(table)) {
      const op = /INSERT/i.test(finalSql) ? 'insert' : /DELETE/i.test(finalSql) ? 'delete' : 'update';
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
      "SELECT id, table_name, row_id, op FROM sync_events WHERE pushed_at IS NULL ORDER BY id"
    ).all(),
    markPushed: (ids) => {
      if (!ids.length) return;
      const ph = ids.map(() => '?').join(',');
      raw.prepare(`UPDATE sync_events SET pushed_at = datetime('now') WHERE id IN (${ph})`).run(...ids);
    },
  };
}

module.exports = { init };