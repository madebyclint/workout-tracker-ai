/**
 * mcp/server.js
 *
 * MCP tools exposing the same data/actions as the REST API in server.js, so
 * Claude (via the claude.ai remote connector) can read past workouts/stats
 * and create new week programs directly, instead of the old copy/paste
 * "Generate" tab flow.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');

// Same per-cycle context the old js/generate.js prompt template used, so
// Claude has the training-philosophy background without that tab existing.
const CYCLE_PROFILES = {
  A: {
    title: 'Upper Push + Core',
    focus: 'Horizontal Push · Shoulder Health · Triceps · Core',
    description: 'Upper body push day. Emphasis on chest, shoulders, and triceps. Antagonist to pulling/climbing. Prioritizes shoulder health.',
  },
  B: {
    title: 'Lower + Pull + Glutes',
    focus: 'Squat Pattern · Vertical Pull · Glute Emphasis · Rear Delts',
    description: 'Lower body and pull day. Full-body with emphasis on glutes and lat width. Face pulls for shoulder longevity.',
  },
  C: {
    title: 'Unilateral + Hinge + Press',
    focus: 'Single-Leg Stability · Hamstrings · Upper Chest · Lats · Core',
    description: 'Unilateral/single-limb work to expose and correct left/right imbalances. Critical for injury prevention.',
  },
  D: {
    title: 'Power + Carry + Conditioning',
    focus: 'Explosive Power · Full-Body Integration · Athletic Conditioning',
    description: 'Most metabolically demanding week. Compound/explosive movements, loaded carries, high calorie burn. Closes the 4-week cycle.',
  },
};

// Mirrors the keyword fallback in js/log.js's getExerciseMeta() — that's a
// client-side, name-only lookup (no structured tag field anywhere), so this
// is exposed read-only via list_exercise_categories rather than duplicated
// into a new schema. Keep in sync manually if js/log.js's rules change.
const EXERCISE_CATEGORY_RULES = [
  { keywords: ['hip thrust', 'glute bridge'], cat: 'legs', sub: 'Glute' },
  { keywords: ['deadlift', 'rdl'], cat: 'legs', sub: 'Hinge' },
  { keywords: ['squat', 'lunge', 'step-up', 'calf'], cat: 'legs', sub: 'Quad' },
  { keywords: ['swing', 'carry', 'thruster'], cat: 'legs', sub: 'Power' },
  { keywords: ['row', 'pulldown', 'pull-up'], cat: 'pull', sub: 'Back' },
  { keywords: ['curl'], cat: 'pull', sub: 'Biceps' },
  { keywords: ['face pull'], cat: 'pull', sub: 'Rear Delt' },
  { keywords: ['bench', 'fly'], cat: 'push', sub: 'Chest' },
  { keywords: ['shoulder', 'lateral', 'raise'], cat: 'push', sub: 'Shoulder' },
  { keywords: ['tricep', 'pushdown', 'dip'], cat: 'push', sub: 'Triceps' },
  { keywords: ['plank', 'hollow', 'bird dog'], cat: 'core', sub: 'Stability' },
  { keywords: ['woodchop', 'pallof', 'twist'], cat: 'core', sub: 'Anti-Rot' },
  { keywords: ['crunch', 'rollout'], cat: 'core', sub: 'Flexion' },
  { keywords: ['press'], cat: 'push', sub: 'Chest' },
];

async function getReferenceMd(pool) {
  const dbResult = await pool.query("SELECT value FROM config WHERE key = 'reference'");
  if (dbResult.rows.length) return dbResult.rows[0].value;
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, '..', 'exercises', 'reference.md');
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

const PROGRAM_MD_FORMAT_HINT = `Expected markdown format for program_md:

# Week <cycle> — <Title>
**Week of**: <date> | **Cycle**: <cycle> of 4 | **Est. Time**: 40–45 min
**Focus**: <focus>

> [1–2 sentence philosophy for this week.]
> Rest 45–60 seconds between sets.

---

## Block 1 — <Block Name> (25–28 min)

### 1. <Exercise Name> [<exercise_id>] \`3 x 12\`
- **Target muscles**: <muscles>
- **Weight**: <weight range>
- <form cue>

[... more exercises ...]

The optional \`[exercise_id]\` tag (check list_exercises first for canonical ids) links
this exercise to the structured reference table for category/subtag/cues/links instead
of relying on keyword-matching the name text. Omit it and the app falls back to
keyword-matching, same as before.

---

## Block 2 — Core (12–15 min)

### N. <Core Exercise> \`3 x <reps or time>\`
- <form cue>

---

## Notes
- <benefit note>
`;

/**
 * @param {import('pg').Pool} pool
 */
function createMcpServer(pool) {
  const server = new McpServer({
    name: 'workout-tracker',
    version: '1.0.0',
  });

  server.registerTool(
    'list_weeks',
    {
      title: 'List weeks',
      description:
        'List all training weeks with their cycle (A/B/C/D), date, label, and whether a session log exists. Use this to find the most recent week(s) before generating a new one.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const result = await pool.query(`
        SELECT w.week, w.date, w.cycle, w.label,
               (sl.week IS NOT NULL) AS has_log
        FROM weeks w
        LEFT JOIN session_logs sl ON w.week = sl.week
        ORDER BY w.date ASC
      `);
      return {
        content: [{ type: 'text', text: JSON.stringify({ weeks: result.rows, cycleProfiles: CYCLE_PROFILES }, null, 2) }],
      };
    }
  );

  server.registerTool(
    'get_week',
    {
      title: 'Get week detail',
      description:
        'Get full detail for one training week: its program markdown, and (if logged) the saved session — exercises, sets/reps/weight actually performed, notes, and per-athlete bodyweight.',
      inputSchema: { week: z.string().describe('Week identifier, e.g. "2026-W17"') },
      annotations: { readOnlyHint: true },
    },
    async ({ week }) => {
      const weekResult = await pool.query('SELECT * FROM weeks WHERE week = $1', [week]);
      if (!weekResult.rows.length) {
        return { content: [{ type: 'text', text: `Week not found: ${week}` }], isError: true };
      }
      const w = weekResult.rows[0];

      const logResult = await pool.query(
        'SELECT * FROM session_logs WHERE week = $1 ORDER BY updated_at DESC LIMIT 1',
        [week]
      );
      const l = logResult.rows[0];
      const programMd = await getWeekProgramMd(w);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                week: w.week,
                date: w.date,
                cycle: w.cycle,
                label: w.label,
                cycleProfile: CYCLE_PROFILES[w.cycle],
                program_md: programMd,
                session: l
                  ? { savedAt: l.saved_at, notes: l.notes, exercises: l.exercises, exercise_ids: l.exercise_ids, athletes: l.athletes }
                  : null,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    'get_reference',
    {
      title: 'Get exercise reference',
      description: 'Get the exercise reference library (cues, equipment, form notes) as markdown.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const text = await getReferenceMd(pool);
      return { content: [{ type: 'text', text }] };
    }
  );

  server.registerTool(
    'update_reference',
    {
      title: 'Update exercise reference',
      description:
        'Overwrite the exercise reference library shown in the Reference tab. Stored in the database (not the reference.md file), so it survives redeploys and takes priority over the file once set.',
      inputSchema: { reference_md: z.string().describe('Full replacement markdown for the reference library') },
      annotations: { destructiveHint: true },
    },
    async ({ reference_md }) => {
      await pool.query(
        `INSERT INTO config (key, value) VALUES ('reference', $1::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
        [JSON.stringify(reference_md)]
      );
      return { content: [{ type: 'text', text: 'Reference library updated.' }] };
    }
  );

  server.registerTool(
    'list_exercise_categories',
    {
      title: 'List exercise category rules',
      description:
        'Returns the keyword rules the app falls back to for auto-tagging exercises (e.g. "squat" → Legs/Quad) when program_md doesn\'t tag an exercise with an [exercise_id]. Prefer list_exercises + an [exercise_id] tag in program_md for reliable categorization; these keyword rules are only a fallback for untagged exercises.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      return { content: [{ type: 'text', text: JSON.stringify({ rules: EXERCISE_CATEGORY_RULES, fallback: 'core/Stability' }, null, 2) }] };
    }
  );

  const exerciseSchema = {
    id: z.string().describe('Stable slug, e.g. "single_arm_db_row"'),
    name: z.string().describe('Display name, e.g. "Single-Arm Dumbbell Row"'),
    category: z.enum(['push', 'pull', 'legs', 'core', 'full_body']),
    subtag: z.string().optional().describe('Body Balance chart subtag, e.g. "Back", "Anti-Rot", "Glute"'),
    cues: z.string().optional().describe('Form notes / coaching cues'),
    video_url: z.string().optional(),
    thumbnail_url: z.string().optional(),
    favorite: z.boolean().optional(),
  };

  function rowToExercise(r) {
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      subtag: r.subtag,
      cues: r.cues,
      video_url: r.video_url,
      thumbnail_url: r.thumbnail_url,
      favorite: r.favorite,
    };
  }

  async function upsertExerciseRow(client, ex) {
    const result = await client.query(
      `INSERT INTO exercises (id, name, category, subtag, cues, video_url, thumbnail_url, favorite)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, FALSE))
       ON CONFLICT (id) DO UPDATE SET
         name = $2, category = $3, subtag = $4, cues = $5,
         video_url = $6, thumbnail_url = $7, favorite = COALESCE($8, exercises.favorite),
         updated_at = NOW()
       RETURNING *`,
      [ex.id, ex.name, ex.category, ex.subtag ?? null, ex.cues ?? null, ex.video_url ?? null, ex.thumbnail_url ?? null, ex.favorite ?? null]
    );
    return rowToExercise(result.rows[0]);
  }

  server.registerTool(
    'upsert_exercise',
    {
      title: 'Create or update an exercise',
      description: 'Add a new exercise to the structured reference table, or overwrite an existing one by id.',
      inputSchema: exerciseSchema,
      annotations: { destructiveHint: false },
    },
    async (ex) => {
      const exercise = await upsertExerciseRow(pool, ex);
      return { content: [{ type: 'text', text: JSON.stringify(exercise, null, 2) }] };
    }
  );

  server.registerTool(
    'bulk_upsert_exercises',
    {
      title: 'Create or update many exercises',
      description: 'Seed or replace the whole exercise pool in one call instead of one exercise at a time.',
      inputSchema: { exercises: z.array(z.object(exerciseSchema)) },
      annotations: { destructiveHint: false },
    },
    async ({ exercises }) => {
      const client = await pool.connect();
      const updated = [];
      try {
        await client.query('BEGIN');
        for (const ex of exercises) {
          updated.push(await upsertExerciseRow(client, ex));
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return { content: [{ type: 'text', text: JSON.stringify({ updated: updated.length, exercises: updated }, null, 2) }] };
    }
  );

  server.registerTool(
    'get_exercise',
    {
      title: 'Get an exercise',
      description: 'Look up one exercise by its id or exact display name.',
      inputSchema: { name_or_id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ name_or_id }) => {
      const result = await pool.query(
        'SELECT * FROM exercises WHERE id = $1 OR LOWER(name) = LOWER($1)',
        [name_or_id]
      );
      if (!result.rows.length) {
        return { content: [{ type: 'text', text: 'null' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(rowToExercise(result.rows[0]), null, 2) }] };
    }
  );

  server.registerTool(
    'list_exercises',
    {
      title: 'List exercises',
      description:
        'List exercises from the structured reference table, optionally filtered by category. Check this for canonical ids/names before writing a session, instead of guessing text and hoping list_exercise_categories\' keyword matcher tags it correctly.',
      inputSchema: { category: z.enum(['push', 'pull', 'legs', 'core', 'full_body']).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ category }) => {
      const result = category
        ? await pool.query('SELECT * FROM exercises WHERE category = $1 ORDER BY name ASC', [category])
        : await pool.query('SELECT * FROM exercises ORDER BY category ASC, name ASC');
      return { content: [{ type: 'text', text: JSON.stringify(result.rows.map(rowToExercise), null, 2) }] };
    }
  );

  server.registerTool(
    'delete_exercise',
    {
      title: 'Delete an exercise',
      description: 'Remove an exercise from the structured reference table by id.',
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => {
      const result = await pool.query('DELETE FROM exercises WHERE id = $1', [id]);
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: !!result.rowCount }) }] };
    }
  );

  server.registerTool(
    'create_week_program',
    {
      title: 'Create a new week program',
      description:
        `Create a new training week with a generated program. Stores the markdown directly in the database (not a file), so it survives redeploys. ${PROGRAM_MD_FORMAT_HINT}`,
      inputSchema: {
        week: z.string().describe('Week identifier, e.g. "2026-W20"'),
        date: z.string().describe('ISO date for the week start, e.g. "2026-05-11"'),
        cycle: z.enum(['A', 'B', 'C', 'D']).describe('Cycle letter for this week'),
        label: z.string().describe('Short human label, e.g. "Upper Push + Core"'),
        program_md: z.string().describe('Full program markdown, see format hint in tool description'),
        activate: z.boolean().optional().describe('If true, sets this as the current active week shown in the app'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ week, date, cycle, label, program_md, activate }) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO weeks (week, date, cycle, label, program_md)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (week) DO UPDATE SET date = $2, cycle = $3, label = $4, program_md = $5`,
          [week, date, cycle, label, program_md]
        );
        if (activate) {
          await client.query(
            `UPDATE config SET value = value || $1::jsonb, updated_at = NOW() WHERE key = 'manifest'`,
            [JSON.stringify({ currentWeek: week, currentCycleWeek: cycle })]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return { content: [{ type: 'text', text: `Created week ${week}${activate ? ' and set it as the active week' : ''}.` }] };
    }
  );

  server.registerTool(
    'update_week_program',
    {
      title: 'Update an existing week program',
      description: `Overwrite the program markdown for an existing week (edits/corrections). ${PROGRAM_MD_FORMAT_HINT}`,
      inputSchema: {
        week: z.string().describe('Week identifier, e.g. "2026-W20"'),
        program_md: z.string().describe('Replacement program markdown'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ week, program_md }) => {
      const result = await pool.query('UPDATE weeks SET program_md = $1 WHERE week = $2', [program_md, week]);
      if (!result.rowCount) {
        return { content: [{ type: 'text', text: `Week not found: ${week}` }], isError: true };
      }
      return { content: [{ type: 'text', text: `Updated program for week ${week}.` }] };
    }
  );

  server.registerTool(
    'update_week_metadata',
    {
      title: 'Update week metadata',
      description:
        'Rename a week\'s label/date/cycle without touching its program_md or session log. Use this to fix a stale title after replacing a week\'s content, without needing to resend the whole program.',
      inputSchema: {
        week: z.string().describe('Week identifier, e.g. "2026-W20"'),
        label: z.string().optional().describe('New label, e.g. "Upper Push + Core"'),
        date: z.string().optional().describe('New ISO date for the week start'),
        cycle: z.enum(['A', 'B', 'C', 'D']).optional().describe('New cycle letter'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ week, label, date, cycle }) => {
      if (label === undefined && date === undefined && cycle === undefined) {
        return { content: [{ type: 'text', text: 'Provide at least one of label, date, or cycle.' }], isError: true };
      }
      const result = await pool.query(
        `UPDATE weeks SET
           label = COALESCE($2, label),
           date = COALESCE($3, date),
           cycle = COALESCE($4, cycle)
         WHERE week = $1`,
        [week, label ?? null, date ?? null, cycle ?? null]
      );
      if (!result.rowCount) {
        return { content: [{ type: 'text', text: `Week not found: ${week}` }], isError: true };
      }
      return { content: [{ type: 'text', text: `Updated metadata for week ${week}.` }] };
    }
  );

  server.registerTool(
    'delete_week',
    {
      title: 'Delete a week',
      description:
        'Permanently delete a week that has no session log — for cleaning up stale/unused future weeks. Refuses if the week has a saved session log, to protect real logged history; there is no override.',
      inputSchema: { week: z.string().describe('Week identifier, e.g. "2026-W35"') },
      annotations: { destructiveHint: true },
    },
    async ({ week }) => {
      const logResult = await pool.query('SELECT 1 FROM session_logs WHERE week = $1', [week]);
      if (logResult.rows.length) {
        return {
          content: [{ type: 'text', text: `Refusing to delete ${week}: it has a saved session log. Deleting weeks with real logged history is not supported.` }],
          isError: true,
        };
      }
      const result = await pool.query('DELETE FROM weeks WHERE week = $1', [week]);
      if (!result.rowCount) {
        return { content: [{ type: 'text', text: `Week not found: ${week}` }], isError: true };
      }
      return { content: [{ type: 'text', text: `Deleted week ${week}.` }] };
    }
  );

  server.registerTool(
    'delete_weeks',
    {
      title: 'Delete multiple weeks',
      description:
        'Delete several weeks in one call — same log-guard as delete_week (refuses any week with a saved session log), but reports a per-week result instead of failing the whole batch when one week is protected.',
      inputSchema: { weeks: z.array(z.string()).describe('Week identifiers to delete, e.g. ["2026-W35", "2026-W36"]') },
      annotations: { destructiveHint: true },
    },
    async ({ weeks }) => {
      const results = [];
      for (const week of weeks) {
        const logResult = await pool.query('SELECT 1 FROM session_logs WHERE week = $1', [week]);
        if (logResult.rows.length) {
          results.push({ week, deleted: false, reason: 'has_log' });
          continue;
        }
        const deleteResult = await pool.query('DELETE FROM weeks WHERE week = $1', [week]);
        if (!deleteResult.rowCount) {
          results.push({ week, deleted: false, reason: 'not_found' });
          continue;
        }
        results.push({ week, deleted: true });
      }
      return { content: [{ type: 'text', text: JSON.stringify({ results }, null, 2) }] };
    }
  );

  server.registerTool(
    'delete_weeks_before',
    {
      title: 'Delete all weeks before a cutoff date',
      description:
        'Delete every week dated before cutoff_date that has no saved session log — for bulk cleanup of a stale future stretch. Weeks with a session log are always left alone and reported with deleted: false. Pass dry_run: true first to preview exactly what would be deleted, since real deletes are irreversible.',
      inputSchema: {
        cutoff_date: z.string().describe('ISO date; weeks with date < cutoff_date are candidates for deletion'),
        dry_run: z.boolean().optional().describe('If true, compute the result without deleting anything'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ cutoff_date, dry_run }) => {
      const candidates = await pool.query(
        `SELECT w.week, w.date, (sl.week IS NOT NULL) AS has_log
         FROM weeks w
         LEFT JOIN session_logs sl ON w.week = sl.week
         WHERE w.date < $1
         ORDER BY w.date ASC`,
        [cutoff_date]
      );

      const weeksResult = [];
      for (const row of candidates.rows) {
        if (row.has_log) {
          weeksResult.push({ week: row.week, date: row.date, has_log: true, deleted: false });
          continue;
        }
        let deleted = false;
        if (!dry_run) {
          const deleteResult = await pool.query('DELETE FROM weeks WHERE week = $1', [row.week]);
          deleted = !!deleteResult.rowCount;
        }
        weeksResult.push({ week: row.week, date: row.date, has_log: false, deleted });
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ cutoff_date, weeks: weeksResult }, null, 2) }],
      };
    }
  );

  server.registerTool(
    'duplicate_week',
    {
      title: 'Duplicate a week',
      description:
        'Clone an existing week\'s program (and label/cycle, adjustable) into a new week ID, without touching the source week\'s log. Useful for rotating a 4-week block forward instead of retyping content.',
      inputSchema: {
        source_week: z.string().describe('Week identifier to copy from, e.g. "2026-W24-A"'),
        new_week: z.string().describe('New week identifier, e.g. "2026-W28-A"'),
        date: z.string().describe('ISO date for the new week start'),
        label: z.string().optional().describe('Label for the new week; defaults to the source week\'s label'),
        cycle: z.enum(['A', 'B', 'C', 'D']).optional().describe('Cycle for the new week; defaults to the source week\'s cycle'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ source_week, new_week, date, label, cycle }) => {
      const sourceResult = await pool.query('SELECT * FROM weeks WHERE week = $1', [source_week]);
      if (!sourceResult.rows.length) {
        return { content: [{ type: 'text', text: `Source week not found: ${source_week}` }], isError: true };
      }
      const src = sourceResult.rows[0];
      const programMd = src.program_md || (await getWeekProgramMd(src));

      await pool.query(
        `INSERT INTO weeks (week, date, cycle, label, program_md)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (week) DO UPDATE SET date = $2, cycle = $3, label = $4, program_md = $5`,
        [new_week, date, cycle || src.cycle, label || src.label, programMd]
      );
      return { content: [{ type: 'text', text: `Duplicated ${source_week} into ${new_week}.` }] };
    }
  );

  server.registerTool(
    'list_sessions',
    {
      title: 'List logged sessions',
      description:
        'Read actual logged performance (exercises, sets/reps/weight done, notes, per-athlete bodyweight) across every week that has a saved session — in one call, instead of calling get_week per week. Use this to progress off real lift history instead of estimated ranges.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const result = await pool.query(`
        SELECT sl.week, w.date, w.cycle, w.label, sl.saved_at, sl.notes, sl.exercises, sl.exercise_ids, sl.athletes
        FROM session_logs sl
        JOIN weeks w ON w.week = sl.week
        ORDER BY w.date ASC
      `);
      const sessions = result.rows.map(r => ({
        week: r.week,
        date: r.date,
        cycle: r.cycle,
        label: r.label,
        savedAt: r.saved_at,
        notes: r.notes,
        exercises: r.exercises,
        exercise_ids: r.exercise_ids,
        athletes: r.athletes,
      }));
      return { content: [{ type: 'text', text: JSON.stringify({ sessions }, null, 2) }] };
    }
  );

  return server;
}

async function getWeekProgramMd(w) {
  if (w.program_md) return w.program_md;
  if (!w.program_file) return null;
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, '..', w.program_file);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

module.exports = { createMcpServer };
