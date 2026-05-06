// ─────────────────────────────────────
//  Tabs
// ─────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `tab-${id}`));

  if (id === 'session') renderSession();
  if (id === 'log') renderLog();
  if (id === 'archive') renderArchive();
  if (id === 'generate') renderGenerate();
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
//  Boot
// ─────────────────────────────────────
async function boot() {
  try {
    _manifest = await fetchJSON('/api/config');

    const cycleKey = _manifest.currentCycleWeek;
    document.getElementById('headerCycleBadge').textContent = `Week ${cycleKey}`;
    document.getElementById('headerMeta').textContent =
      `${_manifest.currentWeek} · ${_manifest.cycleLabels?.[cycleKey] || ''}`;

    const [programMd, refMd] = await Promise.all([
      fetchText(`/api/weeks/${_manifest.currentWeek}/program`),
      fetchText('/api/reference')
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
      `<div class='error-msg'>
        <strong>Could not load data.</strong><br><br>
        ${e.message}
      </div>`;
  }
}

boot();

// ── Pull-to-refresh ───────────────────────────────────────────────────────────
(function() {
  const THRESHOLD  = 72;
  const MAX_PULL   = 96;
  const INDICATOR  = document.getElementById('ptr-indicator');
  const LABEL      = INDICATOR.querySelector('.ptr-label');

  let startY     = 0;
  let pulling    = false;
  let currentH   = 0;

  function canPull() {
    return window.scrollY === 0;
  }

  document.addEventListener('touchstart', e => {
    if (!canPull()) return;
    startY  = e.touches[0].clientY;
    pulling = false;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (startY === 0) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { startY = 0; return; }
    if (!canPull() && !pulling) { startY = 0; return; }
    pulling = true;
    currentH = Math.min(MAX_PULL, dy * 0.45);
    INDICATOR.style.height = currentH + 'px';
    if (currentH >= THRESHOLD) {
      INDICATOR.classList.add('ptr-ready');
      LABEL.textContent = 'Release to refresh';
    } else {
      INDICATOR.classList.remove('ptr-ready');
      LABEL.textContent = 'Pull to refresh';
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;
    if (currentH >= THRESHOLD) {
      INDICATOR.classList.remove('ptr-ready');
      INDICATOR.classList.add('ptr-refreshing');
      INDICATOR.style.height = '44px';
      LABEL.textContent = 'Refreshing…';
      setTimeout(() => boot().then(() => {
        INDICATOR.classList.remove('ptr-refreshing');
        INDICATOR.style.height = '0';
        LABEL.textContent = 'Pull to refresh';
      }), 400);
    } else {
      INDICATOR.style.height = '0';
      INDICATOR.classList.remove('ptr-ready');
    }
    currentH = 0;
    startY   = 0;
  }, { passive: true });
}());
