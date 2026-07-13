const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

async function testGuidedRecovery() {
  const today = '2026-07-13';
  const storage = new MemoryStorage({
    'farsi-guided-today-v2': JSON.stringify({ days: { [today]: {
      step: 1,
      done: { word: true, sentence: false, recall: false, script: false, reviews: false },
      sentencePlayed: false,
      completedAt: null
    } } })
  });
  let reloads = 0;
  const context = {
    console,
    JSON,
    Set,
    localStorage: storage,
    todayKey: () => today,
    document: {
      addEventListener() {},
      createElement() { return { className: '', innerHTML: '', appendChild() {} }; }
    },
    window: {
      __FARSI_TEST__: true,
      FarsiGuidedToday: { reloadFromStorage() { reloads += 1; } }
    }
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'guided-sentence-recovery.js'), 'utf8'), context);
  const api = context.window.__FARSI_SENTENCE_RECOVERY_TEST__;
  if (!api?.markSentenceSkipped()) throw new Error('Sentence recovery could not advance the lesson.');
  const saved = JSON.parse(storage.getItem('farsi-guided-today-v2')).days[today];
  if (!saved.done.sentence || saved.step !== 2 || saved.sentenceSkipped !== true) {
    throw new Error('Skipping unavailable audio did not safely advance to the listening check.');
  }
  if (reloads !== 1) throw new Error('Guided Today was not refreshed after audio recovery.');
}

async function testNoEnglishAccentFallback() {
  const speechEvents = [];
  const spoken = [];
  let audioPlayCalls = 0;

  class FakeUtterance {
    constructor(text) { this.text = text; }
  }

  class FakeAudio {
    constructor() {
      this.preload = '';
      this.playsInline = false;
      this.src = '';
      this.volume = 1;
      this.readyState = 0;
    }
    setAttribute() {}
    pause() {}
    load() {}
    play() {
      audioPlayCalls += 1;
      return Promise.reject(new Error('stream unavailable'));
    }
  }

  const synthesis = {
    speaking: false,
    pending: false,
    getVoices() { return [{ name: 'English', lang: 'en-US' }]; },
    cancel() { this.speaking = false; this.pending = false; },
    resume() {},
    speak(utterance) {
      spoken.push({ text: utterance.text, lang: utterance.lang });
      this.pending = true;
      setTimeout(() => {
        this.pending = false;
        this.speaking = true;
        utterance.onstart?.();
        setTimeout(() => {
          this.speaking = false;
          utterance.onend?.();
        }, 2);
      }, 0);
    }
  };

  class FakeCustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }

  const context = {
    console,
    Audio: FakeAudio,
    SpeechSynthesisUtterance: FakeUtterance,
    CustomEvent: FakeCustomEvent,
    DOMException,
    Date,
    Promise,
    Set,
    Map,
    Array,
    String,
    Number,
    Math,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    WORDS: [{ fa: 'سلام' }],
    stopSpeech() {},
    setSpeechButtonBusy() {},
    toast() {},
    document: {
      dispatchEvent(event) { speechEvents.push(event); },
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      hidden: false
    },
    window: {
      speechSynthesis: synthesis,
      speakPractice: async () => true
    }
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'sentence-audio-v4.js'), 'utf8'), context);

  const ok = await context.window.speakPractice([
    { text: 'او فارسی صحبت می‌کند.', phoneticHint: 'U fârsi sohbat mikonad.' }
  ]);
  if (!ok) throw new Error('The immediate fa-IR device attempt did not complete in the mock.');
  if (audioPlayCalls !== 0) throw new Error('An unready remote stream was attempted on the original tap.');
  const complete = speechEvents.find(event => event.type === 'farsi:speech-complete');
  if (complete?.detail?.method !== 'persian-device-unlisted') {
    throw new Error('The audio engine did not use the Persian-language device route.');
  }
  if (spoken.some(item => item.lang === 'en-US' || /U faarsi|sohbat mikonad/i.test(item.text))) {
    throw new Error('An English voice or Latin transliteration was used for sentence pronunciation.');
  }
  const persian = spoken.find(item => item.lang === 'fa-IR' && item.text.includes('فارسی'));
  if (!persian) throw new Error('The Persian text was not sent to a fa-IR utterance.');
}

(async () => {
  await testGuidedRecovery();
  await testNoEnglishAccentFallback();

  const audio = fs.readFileSync(path.join(__dirname, '..', 'sentence-audio-v4.js'), 'utf8');
  for (const forbidden of ['englishVoice', 'phonetic-device', 'playPhonetic', 'pronunciation guide']) {
    if (audio.includes(forbidden)) throw new Error(`American-accent fallback remains in sentence audio: ${forbidden}`);
  }
  if (!audio.includes("utterance.lang = voice?.lang || 'fa-IR'")) {
    throw new Error('Sentence audio no longer enforces Persian language speech.');
  }
  if (!audio.includes('practiceSentence(currentWord())')) {
    throw new Error('Today’s Persian sentence is not preloaded before Step 2.');
  }

  const recovery = fs.readFileSync(path.join(__dirname, '..', 'guided-sentence-recovery.js'), 'utf8');
  if (!recovery.includes('Try Persian audio again') || !recovery.includes('Continue without audio')) {
    throw new Error('Sentence recovery is missing a genuine-Persian retry or escape path.');
  }
  if (recovery.includes('pronunciation guide')) {
    throw new Error('Recovery still offers the American pronunciation guide.');
  }

  console.log('Persian-only sentence audio recovery passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
