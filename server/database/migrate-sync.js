/**
 * Adds the columns/tables that the offline-first sync layer needs.
 * Idempotent — safe to run against local MySQL or TiDB Cloud.
 * Also invoked by database/provision.js during cloud setup.
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_NAME = process.env.DB_NAME || 'dsrs_db';

const COLUMNS = [
  ['institutions', 'sync_uuid', 'VARCHAR(36) NULL'],
  ['sources', 'sync_uuid', 'VARCHAR(36) NULL'],
  ['source_photos', 'sync_uuid', 'VARCHAR(36) NULL'],
  ['source_history', 'sync_uuid', 'VARCHAR(36) NULL'],
  ['source_measurements', 'sync_uuid', 'VARCHAR(36) NULL'],
  ['source_leak_tests', 'sync_uuid', 'VARCHAR(36) NULL'],
];

async function migrateInto(conn, dbName) {
  const hasColumn = async (table, col) => {
    const [[r]] = await conn.query(
      'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [dbName, table, col]
    );
    return Number(r.c) > 0;
  };

  for (const [table, col, def] of COLUMNS) {
    if (!(await hasColumn(table, col))) {
      await conn.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    }
  }

  await conn.query(`CREATE TABLE IF NOT EXISTS sync_registry (
    table_name VARCHAR(30) NOT NULL,
    row_uuid CHAR(36) NOT NULL,
    cloud_id BIGINT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (table_name, row_uuid)
  ) ` );
}

module.exports = { migrateInto };

if (require.main === module) {
  (async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: DB_NAME,
      port: process.env.DB_PORT || 3306,
      multipleStatements: true,
      ...(process.env.DB_SSL === 'true' ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } } : {}),
    });
    await migrateInto(conn, DB_NAME);
    console.log('Sync schema migration complete.');
    await conn.end();
  })().catch((err) => {
    console.error('Sync schema migration failed:', err.message);
    process.exit(1);
  });
}