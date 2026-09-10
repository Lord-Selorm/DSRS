const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const engine = (process.env.DB_ENGINE || 'mysql').toLowerCase();

let db;

if (engine === 'sqlite') {
  db = require('./sqlite').init(process.env.DB_FILE || path.join(__dirname, '..', 'dsrs.sqlite'));
} else {
  const mysql = require('mysql2/promise');
  db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...(process.env.DB_SSL === 'true'
      ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } }
      : {}),
  });
  db.engine = 'mysql';
}

module.exports = db;