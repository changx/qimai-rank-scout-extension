// Qimai Rank Scout - background service worker (MV3)

import { GENRE_PRESETS } from './genres.js';

const DEFAULTS = {
  country: 'us',
  device: 'iphone',
  brand: 'grossing', // 畅销
  date: 'today', // currently we rely on page default (today). Qimai date picker can be added later.
  rankMin: 100,
  rankMax: 200,
  riseThreshold: 10,
  genres: GENRE_PRESETS, // array of {id,name}
  closeTabsAfterRun: true,
  dailyEnabled: false,
  dailyHour: 9,
  dailyMinute: 0
};

async function getConfig() {
  const { config } = await chrome.storage.local.get('config');
  return { ...DEFAULTS, ...(config || {}) };
}

async function setConfig(patch) {
  const config = await getConfig();
  const next = { ...config, ...patch };
  await chrome.storage.local.set({ config: next });
  return next;
}

function buildRankUrl({ brand, device, country, genreId }) {
  // example: https://www.qimai.cn/rank/index/brand/grossing/device/iphone/country/us/genre/6007
  return `https://www.qimai.cn/rank/index/brand/${brand}/device/${device}/country/${country}/genre/${genreId}`;
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runOnTab(tabId, payload) {
  // Ask content script to run and return results.
  const res = await chrome.tabs.sendMessage(tabId, { type: 'QM_RUN', payload });
  return res;
}

async function createAndRunForGenre(genre, cfg, runId) {
  const url = buildRankUrl({ brand: cfg.brand, device: cfg.device, country: cfg.country, genreId: genre.id });
  const tab = await chrome.tabs.create({ url, active: false });

  // wait for load + content script readiness
  for (let i = 0; i < 40; i++) {
    try {
      const ping = await chrome.tabs.sendMessage(tab.id, { type: 'QM_PING' });
      if (ping?.ok) break;
    } catch {
      // ignore
    }
    await wait(500);
  }

  let result;
  try {
    result = await runOnTab(tab.id, { ...cfg, genre });
  } catch (e) {
    result = { ok: false, error: String(e), genre };
  }

  if (cfg.closeTabsAfterRun) {
    try { await chrome.tabs.remove(tab.id); } catch {}
  }

  // append to run log
  const key = `run:${runId}`;
  const prev = (await chrome.storage.local.get(key))[key] || { startedAt: Date.now(), items: [] };
  prev.items.push(result);
  await chrome.storage.local.set({ [key]: prev });

  return result;
}

async function runAllGenres() {
  const cfg = await getConfig();
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  await chrome.storage.local.set({ lastRunId: runId, [`run:${runId}`]: { startedAt: Date.now(), items: [] } });

  const results = [];
  for (const genre of cfg.genres) {
    const r = await createAndRunForGenre(genre, cfg, runId);
    results.push(r);
  }

  // Flatten successful records and save as lastResults
  const flat = results
    .filter(r => r && r.ok && Array.isArray(r.records))
    .flatMap(r => r.records);

  await chrome.storage.local.set({ lastResults: { runId, at: Date.now(), records: flat } });

  // Trigger a download (JSON) for convenience
  const blob = new Blob([JSON.stringify({ runId, at: Date.now(), config: cfg, records: flat }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url,
    filename: `qimai-rank-scout/${runId}.json`,
    saveAs: false
  });

  return { ok: true, runId, count: flat.length };
}

chrome.runtime.onInstalled.addListener(async () => {
  await setConfig({});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'QM_BG_RUN_ALL') {
      const res = await runAllGenres();
      sendResponse(res);
      return;
    }
    if (msg?.type === 'QM_BG_GET_CONFIG') {
      sendResponse({ ok: true, config: await getConfig() });
      return;
    }
    if (msg?.type === 'QM_BG_SET_CONFIG') {
      const next = await setConfig(msg.patch || {});
      sendResponse({ ok: true, config: next });
      return;
    }
    if (msg?.type === 'QM_BG_GET_LAST_RESULTS') {
      const { lastResults } = await chrome.storage.local.get('lastResults');
      sendResponse({ ok: true, lastResults: lastResults || null });
      return;
    }
    if (msg?.type === 'QM_BG_CLEAR_ALL') {
      // Clears ALL local extension state (config + last results + run logs)
      await chrome.storage.local.clear();
      // restore defaults
      await setConfig({});
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false, error: 'unknown message' });
  })();
  return true;
});

function scheduleDaily(cfg) {
  chrome.alarms.clear('daily');
  if (!cfg.dailyEnabled) return;
  const now = new Date();
  const next = new Date(now);
  next.setHours(cfg.dailyHour, cfg.dailyMinute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  chrome.alarms.create('daily', { when: next.getTime(), periodInMinutes: 24 * 60 });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.config) {
    scheduleDaily(changes.config.newValue);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily') {
    await runAllGenres();
  }
});
