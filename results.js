function escapeCsv(v) {
  const s = (v ?? '').toString();
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(records) {
  const cols = [
    'date','country','device','chart','category_context','subcategory','rank',
    'change_type','change_value','change_label_raw','app_name','developer','app_id','qimai_app_url','summary','notes'
  ];
  const lines = [cols.join(',')];
  for (const r of records) {
    lines.push(cols.map(c => escapeCsv(r[c])).join(','));
  }
  return lines.join('\n');
}

async function getLastResults() {
  const res = await chrome.runtime.sendMessage({ type: 'QM_BG_GET_LAST_RESULTS' });
  return res?.lastResults || null;
}

async function clearResults() {
  await chrome.storage.local.remove(['lastResults', 'lastRunId']);
}

function setMeta(text) {
  document.getElementById('meta').textContent = text;
}

function setStatus(text, isError=false) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = isError ? 'error' : 'muted';
}

function buildGenreOptions(records) {
  const sel = document.getElementById('filterGenre');
  const genres = Array.from(new Set(records.map(r => r.subcategory).filter(Boolean))).sort();
  // clear except first
  sel.innerHTML = '<option value="">All genres</option>';
  for (const g of genres) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    sel.appendChild(opt);
  }
}

function render(records) {
  const q = (document.getElementById('q').value || '').trim().toLowerCase();
  const filterType = document.getElementById('filterType').value;
  const filterGenre = document.getElementById('filterGenre').value;

  let rows = records;
  if (filterType) rows = rows.filter(r => r.change_type === filterType);
  if (filterGenre) rows = rows.filter(r => (r.subcategory || '') === filterGenre);
  if (q) rows = rows.filter(r =>
    (r.app_name || '').toLowerCase().includes(q) ||
    (r.developer || '').toLowerCase().includes(q)
  );

  rows = rows.slice().sort((a,b) => {
    // smaller rank first
    const ra = Number(a.rank)||9999;
    const rb = Number(b.rank)||9999;
    if (ra !== rb) return ra - rb;
    return (b.change_value||0) - (a.change_value||0);
  });

  const tbody = document.getElementById('rows');
  tbody.innerHTML = '';

  for (const r of rows) {
    const tr = document.createElement('tr');

    const changePill = r.change_type === 'new'
      ? `<span class="pill new">新进榜</span>`
      : `<span class="pill up">+${r.change_value}</span>`;

    const link = r.qimai_app_url ? `<a href="${r.qimai_app_url}" target="_blank" rel="noreferrer">Qimai</a>` : '';
    const appStore = r.app_id ? `<a href="https://apps.apple.com/us/app/id${r.app_id}" target="_blank" rel="noreferrer">App Store</a>` : '';

    tr.innerHTML = `
      <td class="nowrap">${r.rank ?? ''}</td>
      <td>${changePill}</td>
      <td>${r.app_name ?? ''}</td>
      <td>${r.developer ?? ''}</td>
      <td>${r.subcategory ?? ''}</td>
      <td class="summary">${r.summary ?? ''}</td>
      <td class="nowrap">${[link, appStore].filter(Boolean).join(' · ')}</td>
    `;

    tbody.appendChild(tr);
  }

  setStatus(`${rows.length} / ${records.length} records`);
}

async function load() {
  const last = await getLastResults();
  if (!last) {
    setMeta('No results yet. Run the extension first.');
    setStatus('');
    buildGenreOptions([]);
    render([]);
    return;
  }

  const at = new Date(last.at).toLocaleString();
  setMeta(`runId: ${last.runId} · updated: ${at}`);

  const records = last.records || [];
  buildGenreOptions(records);

  // wire filters
  ['q','filterType','filterGenre'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => render(records));
    document.getElementById(id).addEventListener('change', () => render(records));
  });

  document.getElementById('refresh').onclick = () => load();

  document.getElementById('exportCsv').onclick = async () => {
    const csv = toCsv(records);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url,
      filename: `qimai-rank-scout/${last.runId}.csv`,
      saveAs: false
    });
  };

  document.getElementById('clear').onclick = async () => {
    await clearResults();
    setStatus('Cleared.');
    await load();
  };

  render(records);
}

load().catch(e => {
  setMeta('Error');
  setStatus(String(e), true);
});
