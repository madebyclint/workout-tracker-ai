// ─────────────────────────────────────
//  Exercise → muscle category map
// ─────────────────────────────────────
const EXERCISE_CATEGORIES = {
  // ── Push ──────────────────────────
  'Dumbbell Bench Press':              'push',
  'Incline Dumbbell Press':            'push',
  'Dumbbell Shoulder Press (Standing)':'push',
  'Lateral Raises':                    'push',
  'Tricep Pushdown (Cable)':           'push',
  'Dumbbell Push Press':               'push',
  'Cable Crunch (Kneeling)':           'push',
  // ── Pull ──────────────────────────
  'Lat Pulldown (Cable)':              'pull',
  'Lat Pulldown':                      'pull',
  'Face Pull (Cable)':                 'pull',
  'Face Pulls (Cable Rope)':           'pull',
  'Single-Arm Dumbbell Row':           'pull',
  'Seated Cable Row':                  'pull',
  'Hammer Curl':                       'pull',
  'Renegade Row':                      'pull',
  'TRX Row (or Ring Row)':             'pull',
  // ── Legs ──────────────────────────
  'Goblet Squat':                      'legs',
  'Goblet Squat to Press':             'legs',
  'Romanian Deadlift (RDL)':           'legs',
  'Bulgarian Split Squat':             'legs',
  'Hip Thrust (Glute Bridge)':         'legs',
  'Glute Bridge / Hip Thrust':         'legs',
  'Calf Raises (Standing)':            'legs',
  'Walking Lunges':                    'legs',
  'Single-Leg Romanian Deadlift':      'legs',
  'Step-Up (Box or Bench)':            'legs',
  "Farmer's Carry":                    'legs',
  'Dumbbell Deadlift':                 'legs',
  'Kettlebell Swing':                  'legs',
  'Dumbbell Thruster (Squat to Press)':'legs',
  // ── Core ──────────────────────────
  'Dead Bug':                          'core',
  'Pallof Press':                      'core',
  'RKC Plank':                         'core',
  'Cable Woodchop (High to Low)':      'core',
  'Cable Woodchop (Low to High)':      'core',
  'Hollow Body Hold':                  'core',
  'Side Plank':                        'core',
  'Side Plank with Hip Dip':           'core',
  'Ab Rollout (from knees)':           'core',
  'Bicycle Crunch':                    'core',
  'L-Sit Hold':                        'core',
  'Hanging Knee Raise':                'core',
  'Hanging Leg Raise (straight legs)': 'core',
  'Bird Dog':                          'core',
  'Plank Shoulder Tap':                'core',
  'Russian Twist':                     'core',
};

function categorizeExercise(name) {
  if (EXERCISE_CATEGORIES[name]) return EXERCISE_CATEGORIES[name];
  const n = name.toLowerCase();
  if (n.includes('squat') || n.includes('lunge') || n.includes('deadlift') ||
      n.includes('hip thrust') || n.includes('glute') || n.includes('calf') ||
      n.includes('step-up') || n.includes('carry') || n.includes('swing')) return 'legs';
  if (n.includes('row') || n.includes('pulldown') || n.includes('pull-up') ||
      n.includes('curl') || n.includes('face pull')) return 'pull';
  if (n.includes('press') || n.includes('fly') || n.includes('raise') ||
      n.includes('pushdown') || n.includes('dip')) return 'push';
  return 'core';
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
    const index = await fetchJSON(_manifest?.programsIndex || 'workouts/index.json');
    const weeks = [...(index.weeks || [])].reverse();
    for (const w of weeks) {
      if (!w.log) continue;
      try {
        const logFile = await fetchJSON(w.log);
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

  // Build layout
  el.innerHTML = `
    ${_buildLastSessionHtml(last, lastWeek)}
    <div class="card" style="margin-top:14px">
      <div class="card-title" style="margin-bottom:10px">Body Balance</div>
      <div class="log-time-tabs">
        <button class="log-time-tab${_logWindow==='week'?' active':''}"  data-win="week"  onclick="switchLogWindow('week')">7 days</button>
        <button class="log-time-tab${_logWindow==='month'?' active':''}" data-win="month" onclick="switchLogWindow('month')">30 days</button>
        <button class="log-time-tab${_logWindow==='year'?' active':''}"  data-win="year"  onclick="switchLogWindow('year')">Year</button>
        <button class="log-time-tab${_logWindow==='all'?' active':''}"   data-win="all"   onclick="switchLogWindow('all')">All time</button>
      </div>
      <div id="logBalanceContent"></div>
    </div>`;

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
      <span>${name}</span>
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
    const index = await fetchJSON('workouts/index.json');
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
    const index = await fetchJSON('workouts/index.json');
    const entry = (index.weeks || []).find(w => w.week === weekId);
    if (!entry) return;
    const md = await fetchText(entry.program);
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

