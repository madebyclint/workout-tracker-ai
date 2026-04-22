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
//  Boot
// ─────────────────────────────────────
async function boot() {
  try {
    _manifest = await fetchJSON('data.json');

    const cycleKey = _manifest.currentCycleWeek;
    document.getElementById('headerCycleBadge').textContent = `Week ${cycleKey}`;
    document.getElementById('headerMeta').textContent =
      `${_manifest.currentWeek} · ${_manifest.cycleLabels?.[cycleKey] || ''}`;

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
      `<div class='error-msg'>
        <strong>Could not load data.</strong><br>
        Run the app via <code>npx serve .</code> to avoid CORS restrictions on local fetch().<br><br>
        Error: ${e.message}
      </div>`;
  }
}

boot();
