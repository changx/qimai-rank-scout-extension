const out = document.getElementById('out');

function setOut(s) { out.textContent = s; }

document.getElementById('run').addEventListener('click', async () => {
  setOut('Running… this may take a few minutes (opens background tabs).');
  const res = await chrome.runtime.sendMessage({ type: 'QM_BG_RUN_ALL' });
  setOut(JSON.stringify(res, null, 2));
});

document.getElementById('openResults').addEventListener('click', async () => {
  const url = chrome.runtime.getURL('results.html');
  await chrome.tabs.create({ url });
});

document.getElementById('results').addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'QM_BG_GET_LAST_RESULTS' });
  const count = res?.lastResults?.records?.length ?? 0;
  setOut(`Last results: ${count} records\nrunId: ${res?.lastResults?.runId || 'n/a'}`);
});

document.getElementById('options').addEventListener('click', async () => {
  await chrome.runtime.openOptionsPage();
});
