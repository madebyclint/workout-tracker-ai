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
