// ─────────────────────────────────────
//  State
// ─────────────────────────────────────
let _manifest = null;
let _programText = '';
let _referenceText = '';
let _archiveLoaded = false;
let _logLoaded = false;
let _sessionState = { exercises: {}, notes: '', savedAt: null }; // exercises: { "ExName": "complete" | "partial" | "skip" | "" }
let _parsedProgram = null;
let _charts = {};

// ─────────────────────────────────────
//  URL ?session= persistence
// ─────────────────────────────────────
function encodeSession(state) {
  try {
    return btoa(encodeURIComponent(JSON.stringify(state)));
  } catch { return ''; }
}
function decodeSession(str) {
  try {
    return JSON.parse(decodeURIComponent(atob(str)));
  } catch { return null; }
}
function saveSessionToURL() {
  const url = new URL(window.location.href);
  url.searchParams.set('session', encodeSession(_sessionState));
  window.history.replaceState(null, '', url.toString());
}
function loadSessionFromURL() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('session');
  if (raw) {
    const decoded = decodeSession(raw);
    if (decoded) {
      _sessionState = decoded;
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────
//  Fetch helpers
// ─────────────────────────────────────
async function fetchJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
  return r.json();
}
async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
  return r.text();
}

// ─────────────────────────────────────
//  Markdown → HTML (minimal subset)
// ─────────────────────────────────────
function mdToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let inTable = false;
  let tableHeader = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Tables
    if (line.trim().startsWith('|')) {
      if (!inTable) { html += '<table>'; inTable = true; tableHeader = true; }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (line.replace(/\|/g,'').replace(/-/g,'').replace(/\s/g,'') === '') {
        tableHeader = false; continue;
      }
      const tag = tableHeader ? 'th' : 'td';
      html += '<tr>' + cells.map(c => `<${tag}>${inlineFormat(c)}</${tag}>`).join('') + '</tr>';
      if (tableHeader) tableHeader = false;
      continue;
    } else if (inTable) {
      html += '</table>'; inTable = false;
    }

    // Headings
    if (line.startsWith('### ')) { closeLi(); html += `<h3>${inlineFormat(line.slice(4))}</h3>`; continue; }
    if (line.startsWith('## '))  { closeLi(); html += `<h2>${inlineFormat(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('# '))   { closeLi(); html += `<h2>${inlineFormat(line.slice(2))}</h2>`; continue; }

    // Lists
    if (line.match(/^[-*] /)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inlineFormat(line.slice(2))}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }

    // Blockquote
    if (line.startsWith('> ')) {
      html += `<p style="color:var(--text2);border-left:2px solid var(--border);padding-left:10px;margin:6px 0">${inlineFormat(line.slice(2))}</p>`;
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) { html += '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">'; continue; }

    // Paragraph
    if (line.trim() === '') { closeLi(); continue; }
    html += `<p>${inlineFormat(line)}</p>`;
  }
  if (inList) html += '</ul>';
  if (inTable) html += '</table>';
  return html;

  function closeLi() { if (inList) { html += '</ul>'; inList = false; } }
}

function inlineFormat(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--surface2);padding:1px 5px;border-radius:4px;font-size:0.9em">$1</code>');
}

// ─────────────────────────────────────
//  Parse program markdown into structured data
// ─────────────────────────────────────
function parseProgram(md) {
  const blocks = [];
  let currentBlock = null;
  let currentExercise = null;

  for (const line of md.split('\n')) {
    const blockMatch = line.match(/^## Block \d+ — (.+)/);
    if (blockMatch) {
      if (currentExercise && currentBlock) currentBlock.exercises.push(currentExercise);
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { label: blockMatch[1].trim(), exercises: [] };
      currentExercise = null;
      continue;
    }

    const exMatch = line.match(/^### \d+\. (.+?)\s+`([^`]+)`/);
    if (exMatch && currentBlock) {
      if (currentExercise) currentBlock.exercises.push(currentExercise);
      currentExercise = { name: exMatch[1].trim(), scheme: exMatch[2].trim(), muscles: '', scaling: { clint: '', wife: '' }, notes: '' };
      continue;
    }

    if (!currentExercise) continue;

    const muscleMatch = line.match(/^- \*\*Target muscles\*\*: (.+)/);
    if (muscleMatch) { currentExercise.muscles = muscleMatch[1]; continue; }

    const scalingMatch = line.match(/^- \*\*Clint\*\*: (.+?) \| \*\*Wife\*\*: (.+)/);
    if (scalingMatch) {
      currentExercise.scaling.clint = scalingMatch[1].trim();
      currentExercise.scaling.wife = scalingMatch[2].trim();
      continue;
    }

    if (line.startsWith('- ') && !line.includes('**Target') && !line.includes('**Clint')) {
      currentExercise.notes += (currentExercise.notes ? ' ' : '') + line.slice(2);
    }
  }

  if (currentExercise && currentBlock) currentBlock.exercises.push(currentExercise);
  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}

// ─────────────────────────────────────
//  Detect block type from label
// ─────────────────────────────────────
function blockTagClass(label) {
  const l = label.toLowerCase();
  if (l.includes('push')) return 'tag-push';
  if (l.includes('pull')) return 'tag-pull';
  if (l.includes('leg') || l.includes('lower')) return 'tag-legs';
  if (l.includes('core')) return 'tag-core';
  if (l.includes('full') || l.includes('compound')) return 'tag-full';
  return 'tag-core';
}

// ─────────────────────────────────────
//  Render PROGRAM tab
// ─────────────────────────────────────
function renderProgram(md) {
  _parsedProgram = parseProgram(md);
  const el = document.getElementById('programContent');

  if (!_parsedProgram.length) {
    el.innerHTML = `<div class="card ref-content">${mdToHtml(md)}</div>`;
    return;
  }

  let html = '';
  for (const block of _parsedProgram) {
    const tagClass = blockTagClass(block.label);
    html += `<div class="exercise-block">
      <div class="block-heading"><span class="tag ${tagClass}">${block.label}</span></div>`;

    for (const ex of block.exercises) {
      html += `<div class="exercise-item">
        <div class="exercise-name">${ex.name}</div>
        <div class="exercise-scheme">${ex.scheme}</div>`;

      if (ex.muscles) {
        const tags = ex.muscles.split(',').map(m => m.trim());
        html += `<div style="margin-bottom:6px">${tags.map(t => `<span class="muscle-tag">${t}</span>`).join('')}</div>`;
      }
      if (ex.scaling.clint || ex.scaling.wife) {
        html += `<div class="exercise-scaling">
          <strong style="color:var(--text)">Clint:</strong> ${ex.scaling.clint}<br>
          <strong style="color:var(--text)">Wife:</strong> ${ex.scaling.wife}
        </div>`;
      }
      if (ex.notes) html += `<div class="exercise-notes">${ex.notes}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  el.innerHTML = html;
}

// ─────────────────────────────────────
//  Build SESSION state structure from parsed program
// ─────────────────────────────────────
function buildSessionExercisesFromProgram() {
  if (!_parsedProgram) return;
  if (!_sessionState.exercises) _sessionState.exercises = {};
  for (const block of _parsedProgram) {
    for (const ex of block.exercises) {
      if (!(_sessionState.exercises[ex.name] !== undefined)) {
        _sessionState.exercises[ex.name] = '';
      }
    }
  }
}

// ─────────────────────────────────────
//  Render SESSION tab
// ─────────────────────────────────────
function renderSession() {
  if (!_parsedProgram) {
    document.getElementById('sessionContent').innerHTML = '<div class="error-msg">Program not loaded yet. Visit the Program tab first.</div>';
    return;
  }

  buildSessionExercisesFromProgram();

  const exs = _sessionState.exercises || {};
  const allExNames = _parsedProgram.flatMap(b => b.exercises.map(e => e.name));
  const total = allExNames.length;
  const doneCount = allExNames.filter(n => exs[n] === 'complete' || exs[n] === 'partial').length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  let html = `
    <div class="session-bar">
      <div class="progress-wrap">
        <div class="progress-label">${doneCount} / ${total} exercises done (${pct}%)</div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      </div>
    </div>

    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
      <button class="complete-workout-btn" onclick="completeWorkout()">Complete All</button>
      <button class="save-session-btn" onclick="saveSession()">Save Session</button>
      <button class="share-btn" onclick="shareSession()">Copy URL</button>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text2);margin-bottom:6px">Session Notes</div>
      <textarea class="session-notes" rows="3" placeholder="How did it feel? Any PRs, adjustments, or things to remember…"
        oninput="updateNotes(this.value)">${_sessionState.notes || ''}</textarea>
    </div>
  `;

  for (const block of _parsedProgram) {
    html += `<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--text2);margin-bottom:8px;margin-top:4px;padding-bottom:4px;border-bottom:1px solid var(--border)">${block.label}</div>`;

    for (const ex of block.exercises) {
      const status = exs[ex.name] || '';
      const exKey = escAttr(ex.name);
      const nextComplete = status === 'complete' ? '' : 'complete';
      const nextPartial  = status === 'partial'  ? '' : 'partial';
      const nextSkip     = status === 'skip'      ? '' : 'skip';

      html += `<div class="exercise-status-card ${status}">
        <div class="ex-status-header">
          <span class="ex-status-name">${ex.name}</span>
          <span class="ex-status-scheme">${ex.scheme}</span>
        </div>
        <div class="ex-status-btns">
          <button class="ex-btn ex-btn-complete${status === 'complete' ? ' active' : ''}"
            onclick="setExerciseStatus('${exKey}', '${nextComplete}')">
            ✓ Done
          </button>
          <button class="ex-btn ex-btn-partial${status === 'partial' ? ' active' : ''}"
            onclick="setExerciseStatus('${exKey}', '${nextPartial}')">
            ◑ Partial
          </button>
          <button class="ex-btn ex-btn-skip${status === 'skip' ? ' active' : ''}"
            onclick="setExerciseStatus('${exKey}', '${nextSkip}')">
            ✗ Skip
          </button>
        </div>
      </div>`;
    }
  }

  document.getElementById('sessionContent').innerHTML = html;
}

function escAttr(s) {
  return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function setExerciseStatus(name, status) {
  if (!_sessionState.exercises) _sessionState.exercises = {};
  _sessionState.exercises[name] = status;
  saveSessionToURL();
  renderSession();
}

function completeWorkout() {
  if (!_parsedProgram) return;
  if (!_sessionState.exercises) _sessionState.exercises = {};
  for (const block of _parsedProgram) {
    for (const ex of block.exercises) {
      if (!_sessionState.exercises[ex.name]) {
        _sessionState.exercises[ex.name] = 'complete';
      }
    }
  }
  saveSessionToURL();
  renderSession();
  showToast('Workout marked complete!');
}

function updateNotes(val) {
  _sessionState.notes = val;
  saveSessionToURL();
}

function saveSession() {
  _sessionState.savedAt = new Date().toISOString();
  saveSessionToURL();
  const url = new URL(window.location.href);
  url.searchParams.set('session', encodeSession(_sessionState));
  navigator.clipboard.writeText(url.toString()).catch(() => {});
  _logLoaded = false;
  showToast('Session saved & URL copied!');
}

function shareSession() {
  const url = new URL(window.location.href);
  url.searchParams.set('session', encodeSession(_sessionState));
  navigator.clipboard.writeText(url.toString()).catch(() => {});
  showToast('URL copied to clipboard!');
}

// ─────────────────────────────────────
//  Render LOG tab
// ─────────────────────────────────────
async function renderLog() {
  if (_logLoaded) return;
  _logLoaded = true;

  const el = document.getElementById('logContent');
  const exs = _sessionState.exercises || {};
  const hasData = Object.values(exs).some(v => v);

  if (!hasData) {
    el.innerHTML = `<div class="card">
      <div class="empty-state">
        <div class="icon">📋</div>
        <strong>No session data yet</strong><br>
        Mark exercises in the Session tab and hit Save Session.
      </div>
    </div>`;
    return;
  }

  const savedLabel = _sessionState.savedAt
    ? `Saved ${new Date(_sessionState.savedAt).toLocaleString()}`
    : 'In progress — not yet saved';

  const statusLabel = { complete: 'Done', partial: 'Partial', skip: 'Skipped' };
  const statusClass = { complete: 'log-status-complete', partial: 'log-status-partial', skip: 'log-status-skip' };

  let exRows = '';
  if (_parsedProgram) {
    for (const block of _parsedProgram) {
      for (const ex of block.exercises) {
        const s = exs[ex.name] || '';
        if (!s) continue;
        exRows += `<div class="log-ex-row">
          <span>${ex.name}</span>
          <span class="log-status-badge ${statusClass[s]}">${statusLabel[s]}</span>
        </div>`;
      }
    }
  }

  const notesHtml = _sessionState.notes
    ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:0.8rem;color:var(--text2);line-height:1.5"><strong style="color:var(--text)">Notes:</strong> ${_sessionState.notes}</div>`
    : '';

  el.innerHTML = `<div class="card">
    <div class="card-title">Current Session</div>
    <div style="font-size:0.72rem;color:var(--text2);margin-bottom:10px">${savedLabel}</div>
    ${exRows || '<div style="color:var(--text2);font-size:0.82rem">No exercises marked yet.</div>'}
    ${notesHtml}
  </div>`;
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
//  Tabs
// ─────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `tab-${id}`));

  if (id === 'session') renderSession();
  if (id === 'log') renderLog();
  if (id === 'archive') renderArchive();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ─────────────────────────────────────
//  Toast
// ─────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
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

// ─────────────────────────────────────
//  Boot
// ─────────────────────────────────────
async function boot() {
  try {
    _manifest = await fetchJSON('data.json');

    const cycleKey = _manifest.currentCycleWeek;
    document.getElementById('headerCycleBadge').textContent = `Week ${cycleKey}`;
    document.getElementById('headerMeta').textContent =
      `${_manifest.currentWeek} · ${_manifest.cycleLabels?.[cycleKey] || ''} · ${_manifest.athletes?.clint?.name || 'Clint'} & ${_manifest.athletes?.wife?.name || 'Wife'}`;

    const [programMd, refMd] = await Promise.all([
      fetchText(_manifest.currentProgram),
      fetchText(_manifest.exerciseReference)
    ]);

    _programText = programMd;
    _referenceText = refMd;

    renderProgram(programMd);
    renderReference(refMd);

    if (loadSessionFromURL()) {
      showToast('Session restored from URL');
    }

    if (document.getElementById('tab-session').classList.contains('active')) {
      renderSession();
    }

  } catch (e) {
    document.getElementById('programContent').innerHTML =
      `<div class="error-msg">
        <strong>Could not load data.</strong><br>
        Run the app via <code>npx serve .</code> to avoid CORS restrictions on local fetch().<br><br>
        Error: ${e.message}
      </div>`;
  }
}

boot();
