// ─────────────────────────────────────
//  Exercise → {cat, sub} map
//
//  Main cats (for chart):  push · pull · legs · core
//  Arms subcats:  chest · shoulder · triceps · back · biceps
//  Legs subcats:  quad · glute · hinge · power
//  Core subcats:  stability · anti-rot · flexion
// ─────────────────────────────────────
const EXERCISE_META = {
  // ── Push ──────────────────────────────────────────────────
  'Dumbbell Bench Press':               { cat:'push', sub:'Chest' },
  'Incline Dumbbell Press':             { cat:'push', sub:'Chest' },
  'Dumbbell Shoulder Press (Standing)': { cat:'push', sub:'Shoulder' },
  'Lateral Raises':                     { cat:'push', sub:'Shoulder' },
  'Tricep Pushdown (Cable)':            { cat:'push', sub:'Triceps' },
  'Dumbbell Push Press':                { cat:'push', sub:'Shoulder' },
  'Cable Crunch (Kneeling)':            { cat:'core', sub:'Flexion' },
  // ── Pull ──────────────────────────────────────────────────
  'Lat Pulldown (Cable)':               { cat:'pull', sub:'Back' },
  'Lat Pulldown':                       { cat:'pull', sub:'Back' },
  'Face Pull (Cable)':                  { cat:'pull', sub:'Rear Delt' },
  'Face Pulls (Cable Rope)':            { cat:'pull', sub:'Rear Delt' },
  'Single-Arm Dumbbell Row':            { cat:'pull', sub:'Back' },
  'Seated Cable Row':                   { cat:'pull', sub:'Back' },
  'Hammer Curl':                        { cat:'pull', sub:'Biceps' },
  'Renegade Row':                       { cat:'pull', sub:'Back' },
  'TRX Row (or Ring Row)':              { cat:'pull', sub:'Back' },
  // ── Legs: Quad ────────────────────────────────────────────
  'Goblet Squat':                       { cat:'legs', sub:'Quad' },
  'Goblet Squat to Press':              { cat:'legs', sub:'Quad' },
  'Bulgarian Split Squat':              { cat:'legs', sub:'Quad' },
  'Calf Raises (Standing)':             { cat:'legs', sub:'Quad' },
  'Walking Lunges':                     { cat:'legs', sub:'Quad' },
  'Step-Up (Box or Bench)':             { cat:'legs', sub:'Quad' },
  // ── Legs: Glute ───────────────────────────────────────────
  'Hip Thrust (Glute Bridge)':          { cat:'legs', sub:'Glute' },
  'Glute Bridge / Hip Thrust':          { cat:'legs', sub:'Glute' },
  // ── Legs: Hinge (Hamstring/Posterior) ─────────────────────
  'Romanian Deadlift (RDL)':            { cat:'legs', sub:'Hinge' },
  'Single-Leg Romanian Deadlift':       { cat:'legs', sub:'Hinge' },
  'Dumbbell Deadlift':                  { cat:'legs', sub:'Hinge' },
  // ── Legs: Power ───────────────────────────────────────────
  'Kettlebell Swing':                   { cat:'legs', sub:'Power' },
  'Dumbbell Thruster (Squat to Press)': { cat:'legs', sub:'Power' },
  "Farmer's Carry":                     { cat:'legs', sub:'Power' },
  // ── Core: Stability (isometric/anti-extension) ────────────
  'Dead Bug':                           { cat:'core', sub:'Stability' },
  'RKC Plank':                          { cat:'core', sub:'Stability' },
  'Hollow Body Hold':                   { cat:'core', sub:'Stability' },
  'Side Plank':                         { cat:'core', sub:'Stability' },
  'Side Plank with Hip Dip':            { cat:'core', sub:'Stability' },
  'Bird Dog':                           { cat:'core', sub:'Stability' },
  'Plank Shoulder Tap':                 { cat:'core', sub:'Stability' },
  'L-Sit Hold':                         { cat:'core', sub:'Stability' },
  // ── Core: Anti-Rotation ───────────────────────────────────
  'Pallof Press':                       { cat:'core', sub:'Anti-Rot' },
  'Cable Woodchop (High to Low)':       { cat:'core', sub:'Anti-Rot' },
  'Cable Woodchop (Low to High)':       { cat:'core', sub:'Anti-Rot' },
  'Russian Twist':                      { cat:'core', sub:'Anti-Rot' },
  // ── Core: Flexion ─────────────────────────────────────────
  'Ab Rollout (from knees)':            { cat:'core', sub:'Flexion' },
  'Bicycle Crunch':                     { cat:'core', sub:'Flexion' },
  'Hanging Knee Raise':                 { cat:'core', sub:'Flexion' },
  'Hanging Leg Raise (straight legs)':  { cat:'core', sub:'Flexion' },
};

// Returns { cat, sub } — falls back gracefully for unknown exercises
function getExerciseMeta(name) {
  if (EXERCISE_META[name]) return EXERCISE_META[name];
  const n = name.toLowerCase();
  if (n.includes('hip thrust') || n.includes('glute bridge')) return { cat:'legs', sub:'Glute' };
  if (n.includes('deadlift') || n.includes('rdl'))            return { cat:'legs', sub:'Hinge' };
  if (n.includes('squat') || n.includes('lunge') || n.includes('step-up') || n.includes('calf')) return { cat:'legs', sub:'Quad' };
  if (n.includes('swing') || n.includes('carry') || n.includes('thruster')) return { cat:'legs', sub:'Power' };
  if (n.includes('row') || n.includes('pulldown') || n.includes('pull-up')) return { cat:'pull', sub:'Back' };
  if (n.includes('curl'))                                      return { cat:'pull', sub:'Biceps' };
  if (n.includes('face pull'))                                 return { cat:'pull', sub:'Rear Delt' };
  if (n.includes('bench') || n.includes('fly'))                return { cat:'push', sub:'Chest' };
  if (n.includes('shoulder') || n.includes('lateral') || n.includes('raise')) return { cat:'push', sub:'Shoulder' };
  if (n.includes('tricep') || n.includes('pushdown') || n.includes('dip'))    return { cat:'push', sub:'Triceps' };
  if (n.includes('plank') || n.includes('hollow') || n.includes('bird dog'))  return { cat:'core', sub:'Stability' };
  if (n.includes('woodchop') || n.includes('pallof') || n.includes('twist'))  return { cat:'core', sub:'Anti-Rot' };
  if (n.includes('crunch') || n.includes('rollout') || n.includes('raise'))   return { cat:'core', sub:'Flexion' };
  if (n.includes('press') || n.includes('fly') || n.includes('pushdown'))     return { cat:'push', sub:'Chest' };
  return { cat:'core', sub:'Stability' };
}

// Convenience: just the main cat (for chart aggregation)
function categorizeExercise(name) {
  return getExerciseMeta(name).cat;
}

// Returns an HTML badge string for an exercise
function exCatBadgeHtml(name) {
  const { cat, sub } = getExerciseMeta(name);
  return `<span class="ex-cat-badge ex-cat-${cat}">${cat.charAt(0).toUpperCase()+cat.slice(1)}</span><span class="ex-sub-badge">${sub}</span>`;
}

// ─────────────────────────────────────
//  Log state
// ─────────────────────────────────────
let _logWindow = 'all';
let _allLogSessions = [];
let _logDonutChart = null;

// ─────────────────────────────────────
//  Render LOG tab
// ─────────────────────────────────────
async function renderLog() {
  if (_logLoaded) return;
  _logLoaded = true;

  const el = document.getElementById('logContent');
  _allLogSessions = [];

  // Collect sessions from all log files (most-recent first)
  const seen = new Set();
  try {
    const index = await fetchJSON('/api/weeks');
    const weeks = [...(index.weeks || [])].reverse();
    for (const w of weeks) {
      try {
        const logFile = await fetchJSON(`/api/weeks/${w.week}/log`);
        if (logFile.session?.exercises && Object.values(logFile.session.exercises).some(v => v)) {
          const key = logFile.session.savedAt || w.week;
          if (!seen.has(key)) {
            seen.add(key);
            _allLogSessions.push({ ...logFile.session, _week: w });
          }
        }
      } catch (e) { /* skip */ }
    }
  } catch (e) { /* no index */ }

  // Also include URL session if it has data not already in a log file
  const urlHasData = Object.values(_sessionState.exercises || {}).some(v => v);
  if (urlHasData) {
    const key = _sessionState.savedAt || '_url';
    if (!seen.has(key)) {
      seen.add(key);
      _allLogSessions.unshift({ ..._sessionState });
    }
  }

  if (_allLogSessions.length === 0) {
    el.innerHTML = `<div class="card">
      <div class="empty-state">
        <div class="icon">📋</div>
        <strong>No session data yet</strong><br>
        Mark exercises in the Session tab and hit Save Session.
      </div>
    </div>`;
    return;
  }

  const last = _allLogSessions[0];
  const lastWeek = last._week || null;

  // Build layout — balance chart first, last session below
  el.innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:10px">Body Balance</div>
      <div class="log-time-tabs">
        <button class="log-time-tab${_logWindow==='week'?' active':''}"  data-win="week"  onclick="switchLogWindow('week')">7 days</button>
        <button class="log-time-tab${_logWindow==='month'?' active':''}" data-win="month" onclick="switchLogWindow('month')">30 days</button>
        <button class="log-time-tab${_logWindow==='year'?' active':''}"  data-win="year"  onclick="switchLogWindow('year')">Year</button>
        <button class="log-time-tab${_logWindow==='all'?' active':''}"   data-win="all"   onclick="switchLogWindow('all')">All time</button>
      </div>
      <div id="logBalanceContent"></div>
    </div>
    <div style="margin-top:14px">${_buildLastSessionHtml(last, lastWeek)}</div>`;

  _renderLogBalance();
}

function _buildLastSessionHtml(s, w) {
  const exs = s.exercises || {};
  const wLabel = w ? `${w.week} · Week ${w.cycle}: ${w.label}` : 'Current Session';
  const savedLabel = s.savedAt
    ? new Date(s.savedAt).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })
    : 'Not yet saved';

  const done   = Object.values(exs).filter(v => v === 'complete').length;
  const partial = Object.values(exs).filter(v => v === 'partial').length;
  const skipped = Object.values(exs).filter(v => v === 'skip').length;
  const total  = Object.values(exs).filter(v => v).length;

  const statusLabel = { complete: 'Done', partial: 'Partial', skip: 'Skipped' };
  const statusClass = { complete: 'log-status-complete', partial: 'log-status-partial', skip: 'log-status-skip' };

  let exRows = '';
  for (const [name, status] of Object.entries(exs)) {
    if (!status) continue;
    exRows += `<div class="log-ex-row">
      <span class="log-ex-name-wrap">${exCatBadgeHtml(name)}<span class="log-ex-name">${name}</span></span>
      <span class="log-status-badge ${statusClass[status]}">${statusLabel[status]}</span>
    </div>`;
  }

  const summaryParts = [];
  if (done)    summaryParts.push(`<span style="color:var(--green)">${done} done</span>`);
  if (partial) summaryParts.push(`<span style="color:var(--yellow)">${partial} partial</span>`);
  if (skipped) summaryParts.push(`<span style="color:var(--text2)">${skipped} skipped</span>`);

  const notesHtml = s.notes
    ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:0.8rem;color:var(--text2);line-height:1.5"><strong style="color:var(--text)">Notes:</strong> ${s.notes}</div>`
    : '';

  return `<div class="card">
    <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text2);margin-bottom:4px">Last Workout</div>
    <div class="card-title" style="margin-bottom:2px">${wLabel}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
      <span style="font-size:0.72rem;color:var(--text2)">${savedLabel}</span>
      <span style="font-size:0.72rem">${summaryParts.join('<span style="color:var(--border)"> · </span>')}</span>
    </div>
    ${exRows}
    ${notesHtml}
  </div>`;
}

// ─────────────────────────────────────
//  Time window switching
// ─────────────────────────────────────
function switchLogWindow(w) {
  _logWindow = w;
  document.querySelectorAll('.log-time-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.win === w);
  });
  _renderLogBalance();
}

// ─────────────────────────────────────
//  Balance chart renderer
// ─────────────────────────────────────
function _renderLogBalance() {
  const el = document.getElementById('logBalanceContent');
  if (!el) return;

  const now = Date.now();
  const windowDays = { week: 7, month: 30, year: 365, all: null }[_logWindow];
  const cutoff = windowDays ? now - windowDays * 86400000 : 0;

  const counts = { push: 0, pull: 0, legs: 0, core: 0 };
  let sessionCount = 0;

  for (const s of _allLogSessions) {
    const t = s.savedAt ? new Date(s.savedAt).getTime() : now;
    if (t < cutoff) continue;
    sessionCount++;
    for (const [name, status] of Object.entries(s.exercises || {})) {
      if (status !== 'complete' && status !== 'partial') continue;
      counts[categorizeExercise(name)]++;
    }
  }

  const total = counts.push + counts.pull + counts.legs + counts.core;
  const periodLabel = { week:'last 7 days', month:'last 30 days', year:'last year', all:'all time' }[_logWindow];

  if (total === 0) {
    el.innerHTML = `<div style="color:var(--text2);font-size:0.82rem;padding:8px 0">No completed exercises in this period.</div>`;
    return;
  }

  const pct = k => Math.round(counts[k] / total * 100);

  // Colors match existing tag system
  const cats = [
    { key:'push', label:'Push',  color:'#7c6af7' },
    { key:'pull', label:'Pull',  color:'#3ecf8e' },
    { key:'legs', label:'Legs',  color:'#e05c97' },
    { key:'core', label:'Core',  color:'#f5c542' },
  ];

  el.innerHTML = `
    <div style="font-size:0.72rem;color:var(--text2);margin-bottom:14px">
      ${sessionCount} session${sessionCount!==1?'s':''} · ${total} exercises · ${periodLabel}
    </div>
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
      <div style="position:relative;width:130px;height:130px;flex-shrink:0">
        <canvas id="logDonutCanvas" width="130" height="130"></canvas>
      </div>
      <div class="log-legend">
        ${cats.map(c => `
          <div class="log-legend-item">
            <span class="log-legend-dot" style="background:${c.color}"></span>
            <span class="log-legend-label">${c.label}</span>
            <div class="log-legend-bar-wrap">
              <div class="log-legend-bar" style="width:${pct(c.key)}%;background:${c.color}"></div>
            </div>
            <span class="log-legend-pct" style="color:${c.color}">${pct(c.key)}%</span>
            <span class="log-legend-count">${counts[c.key]}</span>
          </div>`).join('')}
      </div>
    </div>`;

  if (_logDonutChart) { _logDonutChart.destroy(); _logDonutChart = null; }
  const ctx = document.getElementById('logDonutCanvas')?.getContext('2d');
  if (!ctx) return;

  _logDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c.label),
      datasets: [{
        data: cats.map(c => counts[c.key]),
        backgroundColor: cats.map(c => c.color),
        borderColor: '#0f0f13',
        borderWidth: 3,
        hoverOffset: 4,
      }]
    },
    options: {
      cutout: '68%',
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.label}: ${ctx.parsed} ex (${pct(cats[ctx.dataIndex].key)}%)`
        }
      }},
      animation: { duration: 350 },
    }
  });
}

// ─────────────────────────────────────
//  Render REFERENCE tab
// ─────────────────────────────────────
function renderReference(md) {
  const el = document.getElementById('referenceContent');
  el.innerHTML = `<div class="card ref-content">${mdToHtml(md)}</div>`;
}

// ─────────────────────────────────────
//  Render ARCHIVE tab
// ─────────────────────────────────────
async function renderArchive() {
  if (_archiveLoaded) return;
  _archiveLoaded = true;

  const el = document.getElementById('archiveContent');
  try {
    const index = await fetchJSON('/api/weeks');
    const weeks = index.weeks || [];

    if (!weeks.length) {
      el.innerHTML = '<div class="empty-state"><div class="icon">📅</div>No past sessions yet.</div>';
      return;
    }

    const sorted = [...weeks].reverse();
    let html = `<div class="card-title" style="padding:0 4px 8px">Past Sessions</div>`;

    for (const w of sorted) {
      html += `<div class="history-item" onclick="loadArchivedWeek('${w.week}')">
        <div class="history-item-header">
          <span class="history-week">${w.week}</span>
          <span class="history-date">${w.date}</span>
        </div>
        <div class="history-cycle">Week ${w.cycle} — ${w.label}</div>
      </div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="error-msg">Could not load archive: ${e.message}</div>`;
  }
}

async function loadArchivedWeek(weekId) {
  try {
    const md = await fetchText(`/api/weeks/${weekId}/program`);
    document.getElementById('archiveContent').innerHTML =
      `<button onclick="renderArchive();_archiveLoaded=false;" style="background:none;border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:6px 12px;cursor:pointer;font-size:0.78rem;margin-bottom:14px">← Back to archive</button>
       <div class="card ref-content">${mdToHtml(md)}</div>`;
  } catch (e) {
    showToast("Could not load that week's program");
  }
}

// ─────────────────────────────────────
//  Save session to log JSON (download)
// ─────────────────────────────────────
function saveSessionToLog() {
  if (!_manifest || !_parsedProgram) return;

  const exercises = [];
  for (const block of _parsedProgram) {
    for (const ex of block.exercises) {
      const status = (_sessionState.exercises || {})[ex.name] || '';
      if (status) exercises.push({ name: ex.name, block: block.label, status });
    }
  }

  const logData = {
    week: _manifest.currentWeek,
    date: new Date().toISOString().split('T')[0],
    cycle: _manifest.currentCycleWeek,
    label: _manifest.cycleLabels[_manifest.currentCycleWeek],
    exercises
  };

  const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${_manifest.currentWeek}-log.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Log downloaded — save to logs/ folder');
}

