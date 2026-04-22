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

    const weightMatch = line.match(/^- \*\*Weight\*\*: (.+)/);
    if (weightMatch) {
      currentExercise.scaling.clint = weightMatch[1].trim();
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
      if (ex.scaling.clint) {
        html += `<div class="exercise-scaling">
          <strong style="color:var(--text)">Weight:</strong> ${ex.scaling.clint}
        </div>`;
      }
      if (ex.notes) html += `<div class="exercise-notes">${ex.notes}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  el.innerHTML = html;
}
