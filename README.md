# Farsi Daily

A private, browser-based Persian vocabulary trainer.

## Features

- One automatically selected Farsi word each day
- Reliable Persian pronunciation using streamed audio with the browser speech engine as a fallback
- Daily words automatically added to the flashcard deck
- Tracks correct and missed answers in local browser storage
- Missed cards repeat in the current session and become due again sooner
- Correct cards use increasing review intervals: 1, 3, 7, 14, 30, 60, and 120 days
- Search and filter the deck by learning strength
- Installable PWA and offline cache when served from a web server

## Run it

Open `index.html` through a web server or deploy the repository with GitHub Pages. From this folder on a Mac or PC with Python installed:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

Progress is stored in that browser using `localStorage`. Clearing browser site data or pressing **Reset progress** removes it.

## Pronunciation

The **Hear it** button first streams a short Persian pronunciation from Google Translate TTS. If that request is unavailable, the app falls back to a Persian voice installed in the browser or operating system. Only the displayed Persian word or phrase is sent for pronunciation; learning progress stays in local browser storage.
