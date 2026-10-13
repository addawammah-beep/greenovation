const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, 'db.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

const run = async () => {
  const migrationDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationDir).filter(file => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
    for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) {
      await pool.query(statement);
    }
    console.log(`Applied ${file}`);
  }
};

run().catch(error => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
