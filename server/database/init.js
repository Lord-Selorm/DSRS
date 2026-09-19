const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function init() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306,
    multipleStatements: true,
  });

  console.log('Connected to MySQL. Initializing database...');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(schema);
  console.log('Schema created successfully.');

  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  await conn.query(seed);
  console.log('Seed data inserted successfully.');

  await conn.end();
  console.log('Database initialization complete.');
}

init().catch((err) => {
  console.error('Database initialization failed:', err.message);
  process.exit(1);
});
