# Vocab Review Agent

A personal automation that turns "words I looked up while browsing" into a
weekly/monthly spaced-review habit — no manual copy-pasting, no forgotten
flashcard apps.

## What it does

- **Capture instantly:** double-click any word on any webpage (or select a
  phrase + `Ctrl/Cmd+Shift+S` for idioms) to save it — no tab-switching, no
  copy-paste.
- **Real definitions, not guesses:** pulls from the Merriam-Webster
  Learner's Dictionary API (with Collegiate as backup, and an AI fallback
  for idioms/edge cases the dictionary doesn't cover).
- **Auto-organized storage:** every word lands in a Google Sheet with
  definition, example sentence, audio link, and save date — deduped
  automatically.
- **Scheduled review, not "someday":** a weekly (Sunday) and monthly
  digest gets built automatically, each with a Google Calendar reminder
  that links straight to a flashcard-style review page.
- **Flashcard review UI:** flip to reveal the definition/example/audio,
  mark "Still learning" or "Know it."

## Why

Looking up a word is easy. *Remembering* it a week later is the actual
problem. This closes that loop automatically, so the only manual step left
is double-clicking the word in the moment.

## Architecture

```
Browser (Chrome extension)
   │  double-click / select+shortcut
   ▼
Background service worker  ──fetch──▶  Dictionary APIs (Merriam-Webster, AI fallback)
   │
   ▼
Google Sheets ("Word Bank" + "Review Log")
   │
   ▼
Google Apps Script (scheduled triggers + Web App)
   │
   ▼
Google Calendar reminder ──▶ Flashcard review webpage
```

## Repo structure

```
vocab-review-agent/
├── README.md
├── SETUP_GUIDE.md              # step-by-step setup walkthrough
├── extension/                  # Chrome extension source
│   ├── manifest.json
│   ├── background.js           # service worker (handles all network calls)
│   ├── content.js
│   └── popup.html
├── apps-script/                # Google Apps Script backend
│   ├── Code.gs
│   └── Review.html             # flashcard review page template
└── docs/
    └── screenshots/            # UI screenshots, demo gif, etc.
```

## Tech stack

- Chrome Extension (Manifest V3, background service worker)
- Google Apps Script (Web App + time-based triggers)
- Google Sheets (data store)
- Google Calendar API (reminders)
- Merriam-Webster Learner's Dictionary API

## Setup

See [`SETUP_GUIDE.md`](./SETUP_GUIDE.md) for the full walkthrough, including
Apps Script deployment settings and API key setup.

## Status

Actively used daily on a personal Chrome profile since July 2026. Currently
single-user; multi-user support (per-user API keys/Sheets, proper OAuth)
is a possible future direction if this gets shared more broadly.

## License

MIT — see [`LICENSE`](./LICENSE) for details.
