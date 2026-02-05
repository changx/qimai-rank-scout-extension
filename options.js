const els = {
  riseThreshold: document.getElementById('riseThreshold'),
  rankMin: document.getElementById('rankMin'),
  rankMax: document.getElementById('rankMax'),
  genres: document.getElementById('genres'),
  dailyEnabled: document.getElementById('dailyEnabled'),
  dailyHour: document.getElementById('dailyHour'),
  dailyMinute: document.getElementById('dailyMinute'),
  closeTabsAfterRun: document.getElementById('closeTabsAfterRun'),
  out: document.getElementById('out')
};

function setOut(s) { els.out.textContent = s; }

async function load() {
  const res = await chrome.runtime.sendMessage({ type: 'QM_BG_GET_CONFIG' });
  const cfg = res.config;
  els.riseThreshold.value = cfg.riseThreshold;
  els.rankMin.value = cfg.rankMin;
  els.rankMax.value = cfg.rankMax;
  els.genres.value = JSON.stringify(cfg.genres, null, 2);
  els.dailyEnabled.checked = !!cfg.dailyEnabled;
  els.dailyHour.value = cfg.dailyHour;
  els.dailyMinute.value = cfg.dailyMinute;
  els.closeTabsAfterRun.checked = !!cfg.closeTabsAfterRun;
}

async function save() {
  let genres;
  try {
    genres = JSON.parse(els.genres.value);
    if (!Array.isArray(genres)) throw new Error('genres must be an array');
  } catch (e) {
    setOut(`Invalid genres JSON: ${e.message}`);
    return;
  }

  const patch = {
    riseThreshold: Number(els.riseThreshold.value),
    rankMin: Number(els.rankMin.value),
    rankMax: Number(els.rankMax.value),
    genres,
    dailyEnabled: !!els.dailyEnabled.checked,
    dailyHour: Number(els.dailyHour.value),
    dailyMinute: Number(els.dailyMinute.value),
    closeTabsAfterRun: !!els.closeTabsAfterRun.checked
  };

  const res = await chrome.runtime.sendMessage({ type: 'QM_BG_SET_CONFIG', patch });
  setOut(`Saved. dailyEnabled=${res.config.dailyEnabled}`);
}

document.getElementById('save').addEventListener('click', save);
load();
