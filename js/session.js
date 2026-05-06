// ─────────────────────────────────────
//  Build SESSION state from parsed program
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

async function saveSession() {
  _sessionState.savedAt = new Date().toISOString();
  saveSessionToURL();

  const week = _manifest?.currentWeek;
  if (week) {
    try {
      const res = await fetch(`/api/weeks/${week}/log`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_sessionState),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      _logLoaded = false;
      showToast('Session saved!');
    } catch (err) {
      console.error('Failed to save to server:', err);
      showToast('Saved to URL only (server error)');
    }
  } else {
    _logLoaded = false;
    showToast('Session saved to URL');
  }
}

function shareSession() {
  const url = new URL(window.location.href);
  url.searchParams.set('session', encodeSession(_sessionState));
  navigator.clipboard.writeText(url.toString()).catch(() => {});
  showToast('URL copied to clipboard!');
}
