const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

async function testGuidedRecovery() {
  const today = '2026-07-12';
  const storage = new MemoryStorage({
    'farsi-guided-today-v2': JSON.stringify({ days: { [today]: {
      step: 1,
      done: { word: true, sentence: false, recall: false, script: false, reviews: false },
      sentencePlayed: false,
      completedAt: null
    } } })
  });
  let reloads = 0;
  const listeners = {};
  const context = {
    console,
    JSON,
    Set,
    localStorage: storage,
    todayKey: () => today,
    document: {
      addEventListener(name, handler) { listeners[name] = handler; },
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
  if (!api) throw new Error('Sentence recovery API was not exposed.');
  if (!api.markSentenceSkipped()) throw new Error('Sentence recovery could not advance the lesson.');
  const saved = JSON.parse(storage.getItem('farsi-guided-today-v2')).days[today];
  if (!saved.done.sentence || saved.step !== 2 || saved.sentenceSkipped !== true) {
    throw new Error('Skipping unavailable audio did not safely advance to the listening check.');
  }
  if (reloads !== 1) throw new Error('Guided Today was not refreshed after audio recovery.');
}

async function testImmediatePhoneticFallback() {
  const speechEvents = [];
  const toasts = [];
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
      this.playbackRate = 1;
      this.readyState = 0;
    }
    setAttribute() {}
    removeAttribute() {}
    pause() {}
    load() {}
    play() {
      audioPlayCalls += 1;
      return Promise.reject(new Error('stream unavailable'));
    }
  }

  class FakeMutationObserver {
    observe() {}
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

  const documentListeners = {};
  const context = {
    console,
    Audio: FakeAudio,
    MutationObserver: FakeMutationObserver,
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
    toast(message) { toasts.push(message); },
    document: {
      dispatchEvent(event) { speechEvents.push(event); },
      addEventListener(name, handler) { documentListeners[name] = handler; },
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
  if (!ok) throw new Error('The immediate phonetic device fallback did not complete playback.');
  if (audioPlayCalls !== 0) {
    throw new Error('An unready remote stream was attempted before the gesture-safe device fallback.');
  }
  const complete = speechEvents.find(event => event.type === 'farsi:speech-complete');
  if (complete?.detail?.method !== 'phonetic-device') {
    throw new Error('The immediate fallback did not report the phonetic device method.');
  }
  const english = spoken.find(item => item.lang === 'en-US');
  if (!english || !/U faarsi sohbat mikonad/i.test(english.text)) {
    throw new Error('The sentence transliteration was not spoken by the English-device fallback.');
  }
  if (!toasts.some(message => message.includes('pronunciation guide'))) {
    throw new Error('The learner was not told that a pronunciation-guide fallback was used.');
  }
}

(async () => {
  await testGuidedRecovery();
  await testImmediatePhoneticFallback();

  const audio = fs.readFileSync(path.join(__dirname, '..', 'sentence-audio-v4.js'), 'utf8');
  if (!audio.includes('Select and start the method synchronously')) {
    throw new Error('Sentence audio no longer documents the gesture-safe selection boundary.');
  }
  if (!audio.includes('remote?.ready') || !audio.includes('phonetic-device')) {
    throw new Error('Sentence audio is missing ready-stream selection or the immediate device fallback.');
  }
  const recovery = fs.readFileSync(path.join(__dirname, '..', 'guided-sentence-recovery.js'), 'utf8');
  if (!recovery.includes('Play pronunciation guide') || !recovery.includes('Continue without audio')) {
    throw new Error('Sentence recovery is missing an audio retry or escape path.');
  }
  console.log('Sentence audio recovery passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});