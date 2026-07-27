# Farsi Daily

A browser-based Persian vocabulary trainer that introduces **one new headword per day** and reviews saved words with spaced repetition.

## Curriculum

- 1,000 frequency-informed Persian headwords
- Conversational words are prioritized over duplicate inflected forms
- Common conjugated verb forms are normalized to the infinitive, so a verb counts as one daily word
- Existing user progress remains compatible because the original 84 storage positions stay fixed
- Each word has Persian script, an English meaning, a Latin pronunciation guide, and a frequency rank

The frequency foundation comes from [`m3hrdadfi/persian-words-frequency`](https://github.com/m3hrdadfi/persian-words-frequency), an Apache-2.0 dataset built from large Persian corpora. The app applies additional conversational prioritization and lemma cleanup, so its order is designed for learners rather than presented as a mathematically exact ranking of spoken conversation.

## Verb conjugations

Recognized verbs include interactive tables for:

- Present
- Simple past
- Present subjunctive
- Future

Each table includes all six persons and pronunciation buttons. Compound verbs such as `کار کردن`, `تصمیم گرفتن`, and `دوست داشتن` are conjugated through their helper verb.

## Learning system

- Today’s word is automatically added to the flashcard deck
- Missed cards return during the same session and are due again sooner
- Correct cards progress through 1, 3, 7, 14, 30, 60, and 120-day intervals
- Progress is stored on the device through the shared `FarsiStorage` adapter

## Pronunciation

The app uses pronunciation in this order:

1. Bundled Persian MP3 for all 1,000 curriculum headwords
2. Bundled Persian MP3 for all 1,000 scheduled curriculum sentences
3. A genuine Persian system voice for an uncommon phrase that has no bundled recording

The runtime does not send pronunciation text to Google Translate or another remote text-to-speech service, and it does not use an English phonetic voice as a Persian fallback.

## Run locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Data and generated assets

- The checked-in curriculum is split across `words-part-*.js`; `words-order.js` contains the one-word-per-day order.
- `tools/generate_audio.py` creates missing Persian headword pronunciation clips in stable storage order.
- The sentence-audio workflow keeps the 1,000 scheduled Persian sentence recordings synchronized with curriculum text and hashes.
