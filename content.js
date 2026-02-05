// Qimai Rank Scout - content script

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getDateValue() {
  const el = document.querySelector('input[placeholder="选择日期"]');
  return el?.value || null;
}

async function scrollToLoad200() {
  // Qimai uses lazy-loading: initial rows up to ~150 then loads to 200 when scrolled near bottom.
  for (let i = 0; i < 6; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(900);
    const maxRank = getMaxRank();
    if (maxRank >= 200) return true;
  }
  return getMaxRank() >= 200;
}

function getMaxRank() {
  let max = 0;
  for (const tr of document.querySelectorAll('tr')) {
    const r = parseInt(tr.querySelector('td')?.innerText?.trim() || '', 10);
    if (r > max) max = r;
  }
  return max;
}

function parseRow(tr) {
  const rank = parseInt(tr.querySelector('td')?.innerText?.trim() || '', 10);
  if (!rank) return null;

  const tds = Array.from(tr.querySelectorAll('td'));

  const links = Array.from(tr.querySelectorAll('a[href*="/app/rank/appid/"]'));
  const href = links[0]?.getAttribute('href') || null;
  const appId = href?.match(/appid\/(\d+)/)?.[1] || null;
  const appName = (links.map(a => a.textContent.trim()).filter(Boolean).sort((a, b) => b.length - a.length)[0]) || null;
  const developer = tr.querySelector('p')?.textContent?.trim() || null;
  const qimaiAppUrl = href ? new URL(href, location.origin).toString() : null;

  // In Qimai table, change markers appear in columns: 总榜 / 应用榜 / 分类排名
  // We scan td[2], td[3], td[4] for .rank-txt (新进榜) or .rank-up span (+N)
  let isNew = false;
  let upMax = null;
  let rawLabel = null;

  for (const td of [tds[2], tds[3], tds[4]].filter(Boolean)) {
    const txt = td.querySelector('.rank-txt')?.textContent || '';
    if (txt.includes('新进榜')) {
      isNew = true;
      rawLabel = '新进榜';
    }
    const upEl = td.querySelector('.rank-up span');
    if (upEl) {
      const v = parseInt(upEl.textContent.trim(), 10);
      if (!Number.isNaN(v)) {
        upMax = upMax === null ? v : Math.max(upMax, v);
        rawLabel = `+${upMax}`;
      }
    }
  }

  return { rank, isNew, upMax, rawLabel, appName, developer, appId, qimaiAppUrl };
}

function inferSummaryFromName(appName, developer) {
  const t = (appName || '').toLowerCase();
  if (!t) return '';
  const rules = [
    ['vpn', 'VPN / proxy / privacy'],
    ['proxy', 'VPN / proxy / privacy'],
    ['mail', 'Email client'],
    ['scanner', 'Scanner / PDF'],
    ['pdf', 'PDF / documents'],
    ['translate', 'Translation'],
    ['translator', 'Translation'],
    ['invoice', 'Invoicing'],
    ['password', 'Password manager / 2FA'],
    ['authenticator', '2FA / authenticator'],
    ['chat', 'AI chat / assistant'],
    ['podcast', 'Podcast player'],
    ['news', 'News'],
    ['calendar', 'Calendar / scheduling'],
  ];
  for (const [needle, label] of rules) {
    if (t.includes(needle)) return label;
  }
  return '';
}

async function run(payload) {
  const {
    rankMin = 100,
    rankMax = 200,
    riseThreshold = 10,
    country = 'us',
    device = 'iphone',
    brand = 'grossing',
    genre
  } = payload || {};

  // Ensure rows up to 200 are loaded.
  const loaded = await scrollToLoad200();

  const dateVal = getDateValue();

  const records = [];
  for (const tr of document.querySelectorAll('tr')) {
    const row = parseRow(tr);
    if (!row) continue;
    if (row.rank < rankMin || row.rank > rankMax) continue;

    const qualifies = row.isNew || (row.upMax !== null && row.upMax > riseThreshold);
    if (!qualifies) continue;

    const change_type = row.isNew ? 'new' : 'up';
    const change_value = row.isNew ? null : row.upMax;

    records.push({
      date: dateVal ? `${dateVal} (Qimai display: 今日)` : null,
      country: country.toUpperCase(),
      device: device === 'iphone' ? 'iPhone' : device,
      chart: brand === 'grossing' ? 'Grossing' : brand,
      category_context: genre?.name || null,
      subcategory: genre?.name || null,
      rank: row.rank,
      change_type,
      change_value,
      change_label_raw: row.rawLabel,
      app_name: row.appName,
      developer: row.developer,
      app_id: row.appId,
      qimai_app_url: row.qimaiAppUrl,
      summary: inferSummaryFromName(row.appName, row.developer),
      notes: loaded ? '' : 'warning: did not confirm full load to rank 200'
    });
  }

  return { ok: true, genre, dateVal, loadedTo200: loaded, records };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'QM_PING') {
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === 'QM_RUN') {
      const res = await run(msg.payload);
      sendResponse(res);
      return;
    }
    sendResponse({ ok: false, error: 'unknown message' });
  })();
  return true;
});
