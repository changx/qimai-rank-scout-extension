# Qimai Rank Scout (Chrome Extension)

Scrapes Qimai (qimai.cn) App Store **Grossing** charts for **US / iPhone** across a preset list of top-level genres.

Scope per genre:
- ranks **100–200**
- include apps that are **新进榜** OR **rise > 10** positions

Output:
- Saves consolidated JSON via Chrome Downloads: `qimai-rank-scout/<runId>.json`

## Install (Developer mode)
1. Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder

## Usage
- Log in to Qimai in Chrome normally.
- Click the extension icon → **Run (All Genres)**.

## Notes
- Qimai uses lazy-loading; script scrolls to load ranks up to 200.
- If Qimai shows a paywall/login modal, the run may return fewer results.

## TODO / Enhancements
- Export CSV in addition to JSON
- Deduplicate across genres (app_id primary key)
- Pull 1-line functional summary from app detail page when name is unclear
- Add webhook/Discord push
