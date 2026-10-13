const path = require('path');
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
    reject(new Error('Run this command in an interactive terminal to enter the password safely.'));
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
      finish(new Error('Password reset cancelled.'));
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

const resetAdminPassword = async () => {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const email = (await prompt.question('Admin email: ')).trim().toLowerCase();
    prompt.close();
    
    const password = await promptHidden('New password (minimum 12 characters): ');
    const confirmation = await promptHidden('Confirm new password: ');

    if (!email || !email.includes('@')) throw new Error('Enter a valid admin email address.');
    if (password.length < 12) throw new Error('Password must be at least 12 characters long.');
    if (password !== confirmation) throw new Error('Passwords do not match.');

    const passwordHash = await bcrypt.hash(password, 12);
    
    const result = await db.query(
      'UPDATE admins SET password_hash = $1 WHERE email = $2 RETURNING id',
      [passwordHash, email]
          );
    if (!result.rows.length) throw new Error('No admin account exists for that email.');
    console.log('Admin password updated. The new password was not displayed.');
  } finally {
    prompt.close();
  }
};

resetAdminPassword()
  .catch(error => {
    console.error('Admin password reset failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
