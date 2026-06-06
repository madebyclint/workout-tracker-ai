'use strict';
/**
 * db/update-12week.js
 * - UPDATEs program_file + label for all 36 new sessions already in the DB
 * - INSERTs the 6 new C entries (conflict = skip)
 * - Updates the manifest in the config table
 * Run: DATABASE_URL=<url> node db/update-12week.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const SESSIONS = [
  // Phase 1
  { id:'2026-W24-A', date:'2026-06-09', cycle:'A', label:'Phase 1 — Wk 1A: Lower Push + Vertical Pull', file:'workouts/workout-1A.md' },
  { id:'2026-W24-B', date:'2026-06-12', cycle:'B', label:'Phase 1 — Wk 1B: Hinge + Horizontal Push',    file:'workouts/workout-1B.md' },
  { id:'2026-W24-C', date:'2026-06-14', cycle:'C', label:'Phase 1 — Wk 1C: Active Recovery',            file:'workouts/workout-1C.md' },
  { id:'2026-W25-A', date:'2026-06-16', cycle:'A', label:'Phase 1 — Wk 2A: Squat Pattern + Row',        file:'workouts/workout-2A.md' },
  { id:'2026-W25-B', date:'2026-06-19', cycle:'B', label:'Phase 1 — Wk 2B: Single Leg + Press',         file:'workouts/workout-2B.md' },
  { id:'2026-W25-C', date:'2026-06-21', cycle:'C', label:'Phase 1 — Wk 2C: Active Recovery',            file:'workouts/workout-2C.md' },
  { id:'2026-W26-A', date:'2026-06-23', cycle:'A', label:'Phase 1 — Wk 3A: Deadlift Focus + Incline',   file:'workouts/workout-3A.md' },
  { id:'2026-W26-B', date:'2026-06-26', cycle:'B', label:'Phase 1 — Wk 3B: Hip Thrust Heavy + Vertical Press', file:'workouts/workout-3B.md' },
  { id:'2026-W26-C', date:'2026-06-28', cycle:'C', label:'Phase 1 — Wk 3C: Active Recovery',            file:'workouts/workout-3C.md' },
  { id:'2026-W27-A', date:'2026-06-30', cycle:'A', label:'Phase 1 — Wk 4A: Front Squat + Single-Arm Pull', file:'workouts/workout-4A.md' },
  { id:'2026-W27-B', date:'2026-07-03', cycle:'B', label:'Phase 1 — Wk 4B: Sumo Deadlift + Press',      file:'workouts/workout-4B.md' },
  { id:'2026-W27-C', date:'2026-07-05', cycle:'C', label:'Phase 1 — Wk 4C: Active Recovery',            file:'workouts/workout-4C.md' },
  // Phase 2
  { id:'2026-W28-A', date:'2026-07-07', cycle:'A', label:'Phase 2 — Wk 5A: Back Squat + Pull-Up Focus', file:'workouts/workout-5A.md' },
  { id:'2026-W28-B', date:'2026-07-10', cycle:'B', label:'Phase 2 — Wk 5B: Hip Thrust Loaded + Arnold Press', file:'workouts/workout-5B.md' },
  { id:'2026-W28-C', date:'2026-07-12', cycle:'C', label:'Phase 2 — Wk 5C: Active Recovery',            file:'workouts/workout-5C.md' },
  { id:'2026-W29-A', date:'2026-07-14', cycle:'A', label:'Phase 2 — Wk 6A: Trap Bar Deadlift + Incline', file:'workouts/workout-6A.md' },
  { id:'2026-W29-B', date:'2026-07-17', cycle:'B', label:'Phase 2 — Wk 6B: Bulgarian Split Squat Heavy', file:'workouts/workout-6B.md' },
  { id:'2026-W29-C', date:'2026-07-19', cycle:'C', label:'Phase 2 — Wk 6C: Active Recovery',            file:'workouts/workout-6C.md' },
  { id:'2026-W30-A', date:'2026-07-21', cycle:'A', label:'Phase 2 — Wk 7A: Paused Squat + Wide Pull',   file:'workouts/workout-7A.md' },
  { id:'2026-W30-B', date:'2026-07-24', cycle:'B', label:'Phase 2 — Wk 7B: Deficit RDL + Landmine Press', file:'workouts/workout-7B.md' },
  { id:'2026-W30-C', date:'2026-07-26', cycle:'C', label:'Phase 2 — Wk 7C: Active Recovery',            file:'workouts/workout-7C.md' },
  { id:'2026-W31-A', date:'2026-07-28', cycle:'A', label:'Phase 2 — Wk 8A: Power Complex + Core Intensive', file:'workouts/workout-8A.md' },
  { id:'2026-W31-B', date:'2026-07-31', cycle:'B', label:'Phase 2 — Wk 8B: Deadlift PR Attempt + Shoulders', file:'workouts/workout-8B.md' },
  { id:'2026-W31-C', date:'2026-08-02', cycle:'C', label:'Phase 2 — Wk 8C: Active Recovery',            file:'workouts/workout-8C.md' },
  // Phase 3
  { id:'2026-W32-A', date:'2026-08-04', cycle:'A', label:'Phase 3 — Wk 9A: Heavy Squat + Chin-Up',      file:'workouts/workout-9A.md' },
  { id:'2026-W32-B', date:'2026-08-07', cycle:'B', label:'Phase 3 — Wk 9B: Trap Bar + Landmine Row',    file:'workouts/workout-9B.md' },
  { id:'2026-W32-C', date:'2026-08-09', cycle:'C', label:'Phase 3 — Wk 9C: Active Recovery',            file:'workouts/workout-9C.md' },
  { id:'2026-W33-A', date:'2026-08-11', cycle:'A', label:'Phase 3 — Wk 10A: Heavy Hip Thrust + Pull Complex', file:'workouts/workout-10A.md' },
  { id:'2026-W33-B', date:'2026-08-14', cycle:'B', label:'Phase 3 — Wk 10B: KB Complex + Vertical Push', file:'workouts/workout-10B.md' },
  { id:'2026-W33-C', date:'2026-08-16', cycle:'C', label:'Phase 3 — Wk 10C: Active Recovery',           file:'workouts/workout-10C.md' },
  { id:'2026-W34-A', date:'2026-08-18', cycle:'A', label:'Phase 3 — Wk 11A: Squat Variation + Advanced Pull', file:'workouts/workout-11A.md' },
  { id:'2026-W34-B', date:'2026-08-21', cycle:'B', label:'Phase 3 — Wk 11B: Deadlift Max + Complex Upper', file:'workouts/workout-11B.md' },
  { id:'2026-W34-C', date:'2026-08-23', cycle:'C', label:'Phase 3 — Wk 11C: Active Recovery',           file:'workouts/workout-11C.md' },
  { id:'2026-W35-A', date:'2026-08-25', cycle:'A', label:'Phase 3 — Wk 12A: Peak Full Body Complex',    file:'workouts/workout-12A.md' },
  { id:'2026-W35-B', date:'2026-08-28', cycle:'B', label:'Phase 3 — Wk 12B: Peak Lower Dominant',       file:'workouts/workout-12B.md' },
  { id:'2026-W35-C', date:'2026-08-30', cycle:'C', label:'Phase 3 — Wk 12C: Active Recovery',           file:'workouts/workout-12C.md' },
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let updates = 0, inserts = 0;

    for (const s of SESSIONS) {
      // Try UPDATE first
      const res = await client.query(
        `UPDATE weeks SET label=$1, program_file=$2 WHERE week=$3`,
        [s.label, s.file, s.id]
      );
      if (res.rowCount > 0) {
        updates++;
      } else {
        // Row doesn't exist — INSERT it
        await client.query(
          `INSERT INTO weeks (week, date, cycle, label, program_file)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (week) DO NOTHING`,
          [s.id, s.date, s.cycle, s.label, s.file]
        );
        inserts++;
      }
    }

    // Update manifest in config
    const manifest = {
      currentWeek: '2026-W24-A',
      currentCycleWeek: 'A',
      programsIndex: 'workouts/index.json',
      exerciseReference: 'exercises/reference.md',
      historyLog: 'logs/history.md',
      programCycle: ['A', 'B', 'C'],
      cycleLabels: { A: 'Workout A', B: 'Workout B', C: 'Active Recovery' },
      athletes: {
        clint: { name: 'Clint', height: "5'7\"", weight: 206 },
        wife:  { name: 'Wife',  height: "5'3\"", weight: 118 },
      },
      program: {
        name: '12-Week Couples Program',
        description: 'Full body balance · weight loss + lean muscle · 2–3x/week · NYC commercial gym',
        phases: [
          { name: 'Phase 1 — Foundation', weeks: '1–4' },
          { name: 'Phase 2 — Build',      weeks: '5–8' },
          { name: 'Phase 3 — Peak',       weeks: '9–12' },
        ],
      },
    };

    await client.query(
      `INSERT INTO config (key, value)
       VALUES ('manifest', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(manifest)]
    );

    await client.query('COMMIT');
    console.log(`Done: ${updates} rows updated, ${inserts} rows inserted.`);
    console.log('Manifest updated in config table.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
