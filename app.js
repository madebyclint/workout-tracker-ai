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

// ─────────────────────────────────────
//  Pull to Refresh
// ─────────────────────────────────────
(function initPTR() {
  const el = document.getElementById('ptr');
  const spinner = el.querySelector('.ptr-spinner');
  const THRESHOLD = 72;
  let startY = 0, pulling = false, refreshing = false;

  document.addEventListener('touchstart', e => {
    if (!refreshing && window.scrollY === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling || refreshing) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) {
      const pct = Math.min(dy / THRESHOLD, 1);
      el.style.transition = 'none';
      el.style.transform = `translateY(${(pct - 1) * 100}%)`;
      spinner.style.transform = `rotate(${pct * 360}deg)`;
    }
  }, { passive: true });

  document.addEventListener('touchend', async e => {
    if (!pulling || refreshing) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy >= THRESHOLD) {
      refreshing = true;
      el.style.transition = '';
      el.style.transform = 'translateY(0)';
      spinner.style.transform = '';
      el.classList.add('spinning');
      await boot();
      el.classList.remove('spinning');
      el.style.transform = '';
      refreshing = false;
    } else {
      el.style.transition = '';
      el.style.transform = '';
    }
  });
}());
