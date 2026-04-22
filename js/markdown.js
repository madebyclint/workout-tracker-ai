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
