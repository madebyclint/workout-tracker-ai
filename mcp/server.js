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

const PROGRAM_MD_FORMAT_HINT = `Expected markdown format for program_md:

# Week <cycle> — <Title>
**Week of**: <date> | **Cycle**: <cycle> of 4 | **Est. Time**: 40–45 min
**Focus**: <focus>

> [1–2 sentence philosophy for this week.]
> Rest 45–60 seconds between sets.

---

## Block 1 — <Block Name> (25–28 min)

### 1. <Exercise Name> \`3 x 12\`
- **Target muscles**: <muscles>
- **Weight**: <weight range>
- <form cue>

[... more exercises ...]

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

      const fs = require('fs');
      const path = require('path');
      let programMd = w.program_md || null;
      if (!programMd && w.program_file) {
        const filePath = path.join(__dirname, '..', w.program_file);
        if (fs.existsSync(filePath)) programMd = fs.readFileSync(filePath, 'utf8');
      }

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
                  ? { savedAt: l.saved_at, notes: l.notes, exercises: l.exercises, athletes: l.athletes }
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
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '..', 'exercises', 'reference.md');
      const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
      return { content: [{ type: 'text', text }] };
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

  return server;
}

module.exports = { createMcpServer };
