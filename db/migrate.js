/**
 * db/migrate.js
 *
 * Creates tables from schema.sql and seeds existing JSON data into Postgres.
 * Run once: DATABASE_URL=... node db/migrate.js
 */

require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Apply schema ──────────────────────────────────────────
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema applied.');

    // ── Seed config from data.json ────────────────────────────
    const dataJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8'));
    await client.query(
      `INSERT INTO config (key, value) VALUES ('manifest', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(dataJson)]
    );
    console.log('Config seeded.');

    // ── Seed weeks from workouts/index.json ───────────────────
    const indexJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'workouts', 'index.json'), 'utf8')
    );
    for (const w of indexJson.weeks) {
      await client.query(
        `INSERT INTO weeks (week, date, cycle, label, program_file)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (week) DO NOTHING`,
        [w.week, w.date, w.cycle, w.label, w.program || null]
      );
      console.log(`Week inserted: ${w.week}`);
    }

    // ── Seed session logs from logs/*.json ────────────────────
    const logsDir = path.join(__dirname, '..', 'logs');
    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('-log.json'));

    for (const file of logFiles) {
      const log = JSON.parse(fs.readFileSync(path.join(logsDir, file), 'utf8'));
      if (!log.session) {
        console.log(`Skipping ${file} — no session data.`);
        continue;
      }

      // Ensure the week exists before inserting log (it might not be in index.json)
      const weekCheck = await client.query('SELECT week FROM weeks WHERE week = $1', [log.week]);
      if (!weekCheck.rows.length) {
        console.log(`Skipping ${file} — week ${log.week} not in weeks table.`);
        continue;
      }

      await client.query(
        `INSERT INTO session_logs (week, saved_at, notes, exercises, athletes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (week) DO UPDATE
           SET saved_at = $2, notes = $3, exercises = $4, athletes = $5, updated_at = NOW()`,
        [
          log.week,
          log.session.savedAt ? new Date(log.session.savedAt) : new Date(),
          log.session.notes || '',
          JSON.stringify(log.session.exercises || {}),
          JSON.stringify(log.athletes || {}),
        ]
      );
      console.log(`Session log seeded: ${log.week}`);
    }

    await client.query('COMMIT');
    console.log('Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
