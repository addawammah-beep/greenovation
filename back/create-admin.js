const path = require('path');
const fs = require('fs');
const readline = require('readline/promises');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, 'db.env') });

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

const promptHidden = (question) => new Promise((resolve, reject) => {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    reject(new Error('Run this command in an interactive terminal to enter the admin password safely.'));
    return;
  }

  let value = '';
  const finish = (error) => {
    input.setRawMode(false);
    input.pause();
    input.removeListener('data', handleInput);
    process.stdout.write('\n');
    if (error) reject(error);
    else resolve(value);
  };
  const handleInput = (character) => {
    if (character === '\u0003') {
      finish(new Error('Admin account creation cancelled.'));
    } else if (character === '\r' || character === '\n') {
      finish();
    } else if (character === '\u0008' || character === '\u007f') {
      value = value.slice(0, -1);
    } else if (character >= ' ') {
      value += character;
      process.stdout.write('*');
    }
  };

  process.stdout.write(question);
  input.setEncoding('utf8');
  input.resume();
  input.setRawMode(true);
  input.on('data', handleInput);
});

const createAdmin = async () => {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  let email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  let name = String(process.env.ADMIN_NAME || '').trim();
  let password = process.env.ADMIN_PASSWORD || '';
  try {
    if (!email) email = (await prompt.question('Admin email: ')).trim().toLowerCase();
    if (!name) name = (await prompt.question('Admin display name: ')).trim();
    prompt.close();
    if (!password) password = await promptHidden('Admin password (minimum 12 characters): ');
  } finally {
    prompt.close();
  }

  if (!email || !email.includes('@')) {
    throw new Error('Enter a valid admin email address.');
  }
  if (!name) name = 'Administrator';
  if (password.length < 12) {
    throw new Error('Admin password must be at least 12 characters long.');
  }

  const migration = fs.readFileSync(path.join(__dirname, 'migrations', '006_admin_accounts.sql'), 'utf8');
  await db.query(migration);
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.query(`INSERT INTO admins (name, email, password_hash)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, name, email, active`, [name, email, passwordHash]);
  if (!result.rows.length) {
    throw new Error('An admin with that email already exists; no account was changed.');
  }
  console.log(`Created admin account ${result.rows[0].email} (ID ${result.rows[0].id}).`);
};

createAdmin()
  .catch(error => {
    console.error('Admin account creation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
