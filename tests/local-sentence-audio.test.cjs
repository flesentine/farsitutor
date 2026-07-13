const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CURRICULUM_FILES = [
  'words.js',
  'words-part-01.js', 'words-part-02.js', 'words-part-03.js',
  'words-part-04.js', 'words-part-05.js', 'words-part-06.js',
  'words-part-07.js', 'words-part-08.js', 'words-part-09.js',
  'words-order.js'
];

function normalize(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .replace(/ *\u200c */g, '\u200c')
    .trim();
}

function contentHash(text, voice) {
  return crypto
    .createHash('sha256')
    .update(`${voice}\n${normalize(text)}`, 'utf8')
    .digest('hex');
}

function loadCurriculum() {
  const context = vm.createContext({ console });
  for (const file of CURRICULUM_FILES) {
    const filename = path.join(ROOT, file);
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  return vm.runInContext('({ words: WORDS, order: DAILY_ORDER })', context);
}

function expectedScheduledSentences(words, order) {
  if (order.length !== 1000 || new Set(order).size !== 1000) {
    throw new Error(`DAILY_ORDER must contain exactly 1,000 unique indexes; found ${order.length}.`);
  }

  const entries = new Map();
  for (const wordIndex of order) {
    const word = words[wordIndex];
    if (!word) throw new Error(`DAILY_ORDER references missing word index ${wordIndex}.`);
    const text = normalize(word.exFa || `من کلمهٔ «${word.fa}» را یاد می‌گیرم.`);
    if (!text) throw new Error(`Word index ${wordIndex} has no sentence text.`);
    if (entries.has(text)) {
      throw new Error(`Scheduled curriculum repeats sentence text at word index ${wordIndex}: ${text}`);
    }
    entries.set(String(wordIndex).padStart(4, '0'), text);
  }
  return entries;
}

async function main() {
  const source = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'sentence-audio-source.json'), 'utf8')
  );
  const hashes = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'sentence-audio-hashes.json'), 'utf8')
  );
  const { words, order } = loadCurriculum();
  const scheduled = expectedScheduledSentences(words, order);

  if (source.length !== 1000) {
    throw new Error(`Sentence source must contain exactly 1,000 entries; found ${source.length}.`);
  }

  const sourceIds = new Set();
  const sourceTexts = new Set();
  for (const entry of source) {
    if (sourceIds.has(entry.id)) throw new Error(`Duplicate sentence source id: ${entry.id}`);
    if (sourceTexts.has(normalize(entry.text))) {
      throw new Error(`Duplicate normalized sentence source text: ${entry.text}`);
    }
    sourceIds.add(entry.id);
    sourceTexts.add(normalize(entry.text));

    const expectedText = scheduled.get(entry.id);
    if (!expectedText) throw new Error(`Sentence source id ${entry.id} is not scheduled.`);
    if (normalize(entry.text) !== expectedText) {
      throw new Error(`Sentence source drift at id ${entry.id}.`);
    }
  }
  if (sourceIds.size !== scheduled.size) {
    throw new Error('Sentence source does not cover the complete scheduled curriculum.');
  }

  const manifestContext = { window: {} };
  manifestContext.window.window = manifestContext.window;
  vm.createContext(manifestContext);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'sentence-audio-manifest.js'), 'utf8'),
    manifestContext
  );

  const manifest = manifestContext.window.FARSI_SENTENCE_AUDIO;
  const voice = manifestContext.window.FARSI_SENTENCE_AUDIO_VOICE;
  if (!voice?.startsWith('fa-IR-')) throw new Error(`Generated voice is not Persian: ${voice}`);
  if (!manifest || Object.keys(manifest).length !== source.length) {
    throw new Error('The bundled sentence manifest does not exactly match the sentence source.');
  }
  if (hashes.voice !== voice || hashes.algorithm !== 'sha256(voice + newline + normalized Persian sentence)') {
    throw new Error('Sentence audio hash metadata does not match the generated voice or algorithm.');
  }
  if (Object.keys(hashes.entries || {}).length !== source.length) {
    throw new Error('Sentence audio hash metadata does not exactly cover the sentence source.');
  }

  const expectedFiles = new Set();
  for (const entry of source) {
    const text = normalize(entry.text);
    const expectedUrl = `./audio/sentences/${entry.id}.mp3`;
    if (manifest[text] !== expectedUrl) {
      throw new Error(`Manifest mismatch for sentence id ${entry.id}.`);
    }
    const expectedHash = contentHash(text, voice);
    if (hashes.entries[entry.id] !== expectedHash) {
      throw new Error(`Stale sentence recording hash for id ${entry.id}.`);
    }

    const filename = path.join(ROOT, expectedUrl.replace(/^\.\//, ''));
    if (!fs.existsSync(filename) || fs.statSync(filename).size <= 1024) {
      throw new Error(`Missing generated sentence recording: ${expectedUrl}`);
    }
    expectedFiles.add(path.basename(filename));
  }

  const actualFiles = fs.readdirSync(path.join(ROOT, 'audio', 'sentences'))
    .filter(filename => filename.endsWith('.mp3'));
  if (
    actualFiles.length !== expectedFiles.size
    || actualFiles.some(filename => !expectedFiles.has(filename))
  ) {
    throw new Error('The sentence audio directory contains missing or orphaned MP3 files.');
  }

  const airport = 'فرودگاه دور است.';
  const airportUrl = manifest[airport];
  if (airportUrl !== './audio/sentences/0081.mp3') {
    throw new Error('The airport sentence is missing or points to the wrong bundled recording.');
  }
  if (contentHash(`${airport}!`, voice) === hashes.entries['0081']) {
    throw new Error('Changing a sentence did not invalidate its recording hash.');
  }

  let baseCalls = 0;
  const played = [];
  class FakeAudio {
    constructor(url) {
      this.src = url || '';
      this.currentTime = 0;
      this.volume = 1;
      this.playbackRate = 1;
      this.preload = '';
      this.playsInline = false;
      this.onplaying = null;
      this.onended = null;
      this.onerror = null;
    }
    setAttribute() {}
    pause() {}
    play() {
      played.push({ url: this.src, rate: this.playbackRate });
      setTimeout(() => {
        this.onplaying?.();
        setTimeout(() => this.onended?.(), 1);
      }, 0);
      return Promise.resolve();
    }
  }

  class FakeCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  const fallback = async () => {
    baseCalls += 1;
    return true;
  };
  const context = {
    console,
    Audio: FakeAudio,
    CustomEvent: FakeCustomEvent,
    Promise,
    Object,
    String,
    Number,
    Math,
    Map,
    setTimeout,
    clearTimeout,
    document: { dispatchEvent() {} },
    setSpeechButtonBusy() {},
    window: {
      FARSI_SENTENCE_AUDIO: manifest,
      speakPractice: fallback,
      FarsiSentenceAudio: { playPersian: fallback }
    }
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sentence-local-audio.js'), 'utf8'), context);

  const normalizedVariant = 'يك چای، لطفاً.';
  if (context.window.FarsiSentenceAudio.localUrl(normalizedVariant) !== './audio/sentences/0002.mp3') {
    throw new Error('Arabic yeh/kaf variants did not resolve to normalized Persian sentence audio.');
  }

  const direct = await context.window.FarsiSentenceAudio.playPersian(airport, null, 'normal');
  if (!direct) throw new Error('Bundled Persian sentence did not complete direct playback.');
  if (baseCalls !== 0) throw new Error('Direct sentence playback incorrectly used the remote/device fallback.');
  if (played.at(-1)?.url !== airportUrl) throw new Error(`Wrong direct recording played: ${played.at(-1)?.url}`);

  played.length = 0;
  const guided = await context.window.speakPractice(
    [{ text: airport, phoneticHint: 'Forudgâh dur ast.' }],
    null,
    { speed: 'slow', repeat: 3, pauseMs: 150 }
  );
  if (!guided) throw new Error('Guided sentence practice did not complete.');
  if (baseCalls !== 0) throw new Error('Guided sentence practice used the live speech fallback.');
  if (played.length !== 3) throw new Error(`Repeat ×3 played ${played.length} times instead of 3.`);
  if (played.some(item => item.url !== airportUrl)) throw new Error('Guided practice played the wrong sentence file.');
  if (played.some(item => item.rate !== 0.78)) throw new Error('Slow guided practice did not use local playback speed.');

  console.log(`Bundled Persian sentence audio passed with ${source.length} recordings using ${voice}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
