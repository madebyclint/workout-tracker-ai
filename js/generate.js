// ─────────────────────────────────────
//  Prompt Generator
// ─────────────────────────────────────

const CYCLE_PROFILES = {
  A: {
    title: 'Upper Push + Core',
    focus: 'Horizontal Push · Shoulder Health · Triceps · Core',
    description: 'Upper body push day. Emphasis on chest, shoulders, and triceps. Antagonist to pulling/climbing. Prioritizes shoulder health.',
    prevExercises: 'Goblet squat to press, push press, renegade rows, farmer\'s carries, step-ups, hanging knee raises, bicycle crunches, plank shoulder taps (Week D)'
  },
  B: {
    title: 'Lower + Pull + Glutes',
    focus: 'Squat Pattern · Vertical Pull · Glute Emphasis · Rear Delts',
    description: 'Lower body and pull day. Full-body with emphasis on glutes and lat width. Face pulls for shoulder longevity.',
    prevExercises: 'Dumbbell bench press, incline dumbbell press, shoulder press, lateral raises, tricep pushdowns, planks, deadbugs (Week A)'
  },
  C: {
    title: 'Unilateral + Hinge + Press',
    focus: 'Single-Leg Stability · Hamstrings · Upper Chest · Lats · Core',
    description: 'Unilateral/single-limb work to expose and correct left/right imbalances. Critical for injury prevention.',
    prevExercises: 'Goblet squats, lat pulldowns, hip thrusts, face pulls, Bulgarian split squats (Week B)'
  },
  D: {
    title: 'Power + Carry + Conditioning',
    focus: 'Explosive Power · Full-Body Integration · Athletic Conditioning',
    description: 'Most metabolically demanding week. Compound/explosive movements, loaded carries, high calorie burn. Closes the 4-week cycle.',
    prevExercises: 'Walking lunges, single-arm rows, incline dumbbell press, single-leg RDLs, seated cable rows, bird dog, hollow body hold, Pallof press (Week C)'
  }
};

const CYCLE_ORDER = ['A', 'B', 'C', 'D'];

function getNextCycle(currentCycle) {
  const idx = CYCLE_ORDER.indexOf(currentCycle);
  return CYCLE_ORDER[(idx + 1) % 4];
}

function getNextISOWeek(currentWeek) {
  const match = currentWeek && currentWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return '';
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  if (week >= 52) return `${year + 1}-W01`;
  return `${year}-W${String(week + 1).padStart(2, '0')}`;
}

function getWeekStartDate(isoWeek) {
  const match = isoWeek && isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return '';
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  // ISO week 1 contains Jan 4
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (dayOfWeek - 1));
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  return monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildPrompt({ cycleWeek, isoWeek, weekDate, userNotes }) {
  const profile = CYCLE_PROFILES[cycleWeek];
  const cyclePos = CYCLE_ORDER.indexOf(cycleWeek) + 1;

  return `Generate a workout program for Week ${cycleWeek} of my 4-week fitness cycle.

## Context: 4-Week Cycle System

I follow a 4-week rotation (A → B → C → D) that systematically covers all movement patterns. Each week is distinct to prevent adaptation. Sessions are ~40–45 min with 45–60s rest between sets. Two athletes use the same program (I use heavier weights, my wife uses lighter ranges).

### Cycle Overview
- **Week A** — Upper Push + Core: Chest, shoulders, triceps. Antagonist to pulling/climbing.
- **Week B** — Lower + Pull + Glutes: Squats, lat pulldowns, hip thrusts, face pulls.
- **Week C** — Unilateral + Hinge + Press: Single-leg/arm work to fix imbalances. Incline press, RDLs.
- **Week D** — Power + Carry + Conditioning: Explosive, full-body, metabolically demanding. Closes the cycle.

---

## Request: Week ${cycleWeek} — ${profile.title}

**ISO Week**: ${isoWeek}
**Week of**: ${weekDate}
**Cycle position**: Week ${cyclePos} of 4
**Focus**: ${profile.focus}

**Week ${cycleWeek} philosophy**: ${profile.description}
${userNotes ? `\n**Additional notes / constraints**: ${userNotes}\n` : ''}

---

## Output Format Required

Return the complete program as a markdown file exactly matching this structure:

\`\`\`markdown
# Week ${cycleWeek} — ${profile.title}
**Week of**: ${weekDate} | **Cycle**: ${cycleWeek} of 4 | **Est. Time**: 40–45 min
**Focus**: ${profile.focus}

> [1–2 sentence philosophy/motivation for this week's approach.]
> Rest 45–60 seconds between sets.

---

## Block 1 — [Descriptive Block Name] (25–28 min)

### 1. [Exercise Name] \`3 × 12\`
- **Target muscles**: [Primary muscles]
- **Weight**: [My weight range, e.g. 60–70 lbs total (2 DBs)]
- [Form cue — 1 concise sentence]

### 2. [Exercise Name] \`3 × 12 each side\`
- **Target muscles**: [Primary muscles]
- **Weight**: [weight range]
- [Form cue]

[Continue for 5 total exercises in Block 1]

---

## Block 2 — Core (12–15 min)

### 6. [Core Exercise] \`3 × [reps or time]\`
- [Brief form cue — 1 sentence]

### 7. [Core Exercise] \`3 × [reps]\`
- [Brief form cue]

### 8. [Core Exercise] \`3 × [reps or time]\`
- [Brief form cue — optionally add weight for weighted core work]

---

## Notes
- [Benefit note for exercise 1 — connect to real-world activity like hiking, climbing, or daily movement]
- [Benefit note for exercise 2]
- [Benefit note for exercise 3]
- [Benefit note for exercise 4]
- [Benefit note for exercise 5 — include why this week's theme matters]
\`\`\`

---

## Constraints

- **Equipment**: Dumbbells, cables, barbell, bench, pull-up bar, resistance bands — standard commercial gym
- **My weight ranges (Block 1)**: ~25–80 lb dumbbells depending on exercise; heavier for compound, lighter for isolation/unilateral
- **Sets/reps**: 3 sets standard; 10–15 reps for hypertrophy; unilateral = "each side/leg/arm"; time-based for holds
- **Core (Block 2)**: 3 exercises, bodyweight or light resistance only
- **Block 1**: Exactly 5 exercises covering the week's focus pattern — vary the movement patterns and muscle emphasis
- **Notes section**: 4–5 bullet points with short, motivating insights about why each exercise is valuable. Connect to real-world activities (hiking, climbing, bouldering) where relevant.
- **Variety**: Do not repeat exercises from the previous week (listed below)

---

## Previous Week Exercises to Avoid Repeating

${profile.prevExercises}

---

Generate the complete markdown file for Week ${cycleWeek}.`;
}

function renderGenerate() {
  const container = document.getElementById('generateContent');

  const currentCycle = (_manifest && _manifest.currentCycleWeek) || 'A';
  const currentWeek  = (_manifest && _manifest.currentWeek)      || '';
  const nextCycle    = getNextCycle(currentCycle);
  const nextISO      = getNextISOWeek(currentWeek);
  const nextDate     = getWeekStartDate(nextISO);

  container.innerHTML = `
    <div class="gen-intro">
      <p class="gen-subtitle">Build a prompt to generate the next workout program. Paste the result into Copilot, ChatGPT, or Claude.</p>
    </div>

    <div class="card">
      <div class="card-title">Next Workout</div>
      <div class="gen-fields">

        <div class="gen-field">
          <label>Cycle Week</label>
          <div class="gen-cycle-buttons">
            ${CYCLE_ORDER.map(c => `
              <button class="gen-cycle-btn${c === nextCycle ? ' active' : ''}" data-cycle="${c}">
                <span class="gen-cycle-letter">Week ${c}</span>
                <span class="gen-cycle-desc">${CYCLE_PROFILES[c].title}</span>
              </button>`).join('')}
          </div>
        </div>

        <div class="gen-field-row">
          <div class="gen-field">
            <label for="genISOWeek">ISO Week</label>
            <input type="text" id="genISOWeek" value="${nextISO}" placeholder="e.g. 2026-W20" />
          </div>
          <div class="gen-field">
            <label for="genWeekDate">Week of Date</label>
            <input type="text" id="genWeekDate" value="${nextDate}" placeholder="e.g. May 11, 2026" />
          </div>
        </div>

        <div class="gen-field">
          <label for="genNotes">Notes / Constraints <span class="gen-optional">(optional)</span></label>
          <textarea id="genNotes" rows="2" placeholder="e.g. avoid overhead press this week, focus on grip, skip farmer carries…"></textarea>
        </div>
      </div>
    </div>

    <button class="btn-primary gen-build-btn" id="genBuildBtn">Generate Prompt</button>

    <div id="genOutput" class="gen-output hidden">
      <div class="gen-output-header">
        <div class="card-title">Generated Prompt</div>
        <button class="btn-secondary gen-copy-btn" id="genCopyBtn">Copy</button>
      </div>
      <textarea id="genPromptText" readonly></textarea>
    </div>
  `;

  let selectedCycle = nextCycle;

  // Cycle button selection
  container.querySelectorAll('.gen-cycle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.gen-cycle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCycle = btn.dataset.cycle;
      // Update ISO week date auto-fill if week date hasn't been manually changed
      const isoEl  = document.getElementById('genISOWeek');
      const dateEl = document.getElementById('genWeekDate');
      if (isoEl.value && dateEl.value === getWeekStartDate(isoEl.value)) {
        dateEl.value = getWeekStartDate(isoEl.value);
      }
    });
  });

  // Auto-update date when ISO week changes
  document.getElementById('genISOWeek').addEventListener('input', e => {
    const date = getWeekStartDate(e.target.value.trim());
    if (date) document.getElementById('genWeekDate').value = date;
  });

  // Build prompt
  document.getElementById('genBuildBtn').addEventListener('click', () => {
    const isoWeek  = document.getElementById('genISOWeek').value.trim();
    const weekDate = document.getElementById('genWeekDate').value.trim();
    const userNotes = document.getElementById('genNotes').value.trim();

    const prompt = buildPrompt({ cycleWeek: selectedCycle, isoWeek, weekDate, userNotes });

    const outputEl = document.getElementById('genOutput');
    const textEl   = document.getElementById('genPromptText');
    textEl.value   = prompt;
    textEl.rows    = prompt.split('\n').length + 2;
    outputEl.classList.remove('hidden');
    outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Copy
  document.getElementById('genCopyBtn').addEventListener('click', () => {
    const text = document.getElementById('genPromptText').value;
    navigator.clipboard.writeText(text).then(() => showToast('Prompt copied!'));
  });
}
