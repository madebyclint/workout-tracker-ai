// ─────────────────────────────────────
//  Global State
// ─────────────────────────────────────
let _manifest = null;
let _programText = '';
let _referenceText = '';
let _archiveLoaded = false;
let _logLoaded = false;
let _sessionState = { exercises: {}, notes: '', savedAt: null };
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
  if (!r.ok) {
    let msg = `${r.status}`;
    try { const body = await r.json(); if (body.error) msg = body.error; } catch {}
    throw new Error(`Failed to fetch ${path}: ${msg}`);
  }
  return r.json();
}

async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
  return r.text();
}
