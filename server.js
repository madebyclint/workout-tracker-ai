require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────
//  Database
// ─────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
});

// ─────────────────────────────────────
//  Middleware
// ─────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────────
//  API: Config / Manifest
// ─────────────────────────────────────
app.get('/api/config', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM config WHERE key = 'manifest'");
    res.json(result.rows[0]?.value || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
//  API: Weeks index
// ─────────────────────────────────────
app.get('/api/weeks', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT week, date, cycle, label FROM weeks ORDER BY date ASC'
    );
    res.json({ weeks: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
//  API: Program markdown for a week
// ─────────────────────────────────────
app.get('/api/weeks/:week/program', async (req, res) => {
  try {
    const { week } = req.params;
    const result = await pool.query('SELECT program_file FROM weeks WHERE week = $1', [week]);
    if (!result.rows.length) return res.status(404).send('Week not found');
    const filePath = path.join(__dirname, result.rows[0].program_file);
    if (!fs.existsSync(filePath)) return res.status(404).send('Program file not found');
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
//  API: Exercise reference
// ─────────────────────────────────────
app.get('/api/reference', (req, res) => {
  const filePath = path.join(__dirname, 'exercises', 'reference.md');
  if (!fs.existsSync(filePath)) return res.status(404).send('Reference not found');
  res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
});

// ─────────────────────────────────────
//  API: Get log for a week
// ─────────────────────────────────────
app.get('/api/weeks/:week/log', async (req, res) => {
  try {
    const { week } = req.params;
    const weekResult = await pool.query('SELECT * FROM weeks WHERE week = $1', [week]);
    if (!weekResult.rows.length) return res.status(404).json({ error: 'Week not found' });

    const logResult = await pool.query(
      'SELECT * FROM session_logs WHERE week = $1 ORDER BY updated_at DESC LIMIT 1',
      [week]
    );

    const w = weekResult.rows[0];
    const l = logResult.rows[0];

    res.json({
      week: w.week,
      date: w.date,
      cycle: w.cycle,
      label: w.label,
      session: l ? {
        savedAt: l.saved_at,
        notes: l.notes,
        exercises: l.exercises,
      } : null,
      athletes: l?.athletes || {
        clint: { bodyweight: 205, exercises: [] },
        wife: { bodyweight: 110, exercises: [] },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
//  API: Save / update log for a week
// ─────────────────────────────────────
app.put('/api/weeks/:week/log', async (req, res) => {
  try {
    const { week } = req.params;
    const { exercises, notes, savedAt, athletes } = req.body;

    const weekCheck = await pool.query('SELECT week FROM weeks WHERE week = $1', [week]);
    if (!weekCheck.rows.length) return res.status(404).json({ error: 'Week not found' });

    await pool.query(
      `INSERT INTO session_logs (week, saved_at, notes, exercises, athletes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (week) DO UPDATE
         SET saved_at = $2, notes = $3, exercises = $4, athletes = $5, updated_at = NOW()`,
      [
        week,
        savedAt ? new Date(savedAt) : new Date(),
        notes || '',
        JSON.stringify(exercises || {}),
        JSON.stringify(athletes || {}),
      ]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
//  API: Add a new week
// ─────────────────────────────────────
app.post('/api/weeks', async (req, res) => {
  try {
    const { week, date, cycle, label, program_file } = req.body;
    if (!week || !date || !cycle || !label) {
      return res.status(400).json({ error: 'week, date, cycle, and label are required' });
    }
    await pool.query(
      'INSERT INTO weeks (week, date, cycle, label, program_file) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (week) DO NOTHING',
      [week, date, cycle, label, program_file || null]
    );

    // Update current week in config
    await pool.query(
      `UPDATE config SET value = value || $1 WHERE key = 'manifest'`,
      [JSON.stringify({ currentWeek: week, currentCycleWeek: cycle })]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
//  Version info — read from version.json (committed to repo)
// ─────────────────────────────────────
let _version = null;
function getVersion() {
  if (_version) return _version;
  try {
    _version = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
  } catch {
    _version = { hash: 'dev', date: new Date().toISOString(), message: 'local dev' };
  }
  return _version;
}
app.get('/api/version', (_req, res) => res.json(getVersion()));

// ─────────────────────────────────────
//  SPA fallback — serve index.html for
//  any non-API, non-static route
// ─────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// ─────────────────────────────────────
//  Start
// ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Workout Tracker running at http://localhost:${PORT}`);
});
