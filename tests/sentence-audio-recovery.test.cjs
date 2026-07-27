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

function makeAudioContext({ hasPersianVoice }) {
  const speechEvents = [];
  const spoken = [];

  class FakeUtterance {
    constructor(text) { this.text = text; }
  }

  const voices = hasPersianVoice
    ? [{ name: 'Persian', lang: 'fa-IR' }, { name: 'English', lang: 'en-US' }]
    : [{ name: 'English', lang: 'en-US' }];

  const synthesis = {
    speaking: false,
    pending: false,
    getVoices() { return voices; },
    cancel() { this.speaking = false; this.pending = false; },
    resume() {},
    speak(utterance) {
      spoken.push({ text: utterance.text, lang: utterance.lang, voice: utterance.voice?.name || null });
      this.speaking = true;
      setTimeout(() => {
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
  return { context, speechEvents, spoken };
}

async function testPersianDeviceVoiceForUnbundledPhrase() {
  const harness = makeAudioContext({ hasPersianVoice: true });
  const ok = await harness.context.window.speakPractice([
    { text: 'این یک عبارت آزمایشی است.', phoneticHint: 'In yek ebârat-e âzmâyeshi ast.' }
  ]);
  if (!ok) throw new Error('A listed Persian system voice did not complete.');
  if (harness.spoken.length !== 1) throw new Error('The Persian system voice was not used exactly once.');
  if (harness.spoken[0].voice !== 'Persian' || harness.spoken[0].lang !== 'fa-IR') {
    throw new Error('An unlisted or non-Persian voice was used.');
  }
  const complete = harness.speechEvents.find(event => event.type === 'farsi:speech-complete');
  if (complete?.detail?.method !== 'persian-device') {
    throw new Error('The audio engine did not report Persian system-voice playback.');
  }
}

async function testMissingPersianVoiceFailsHonestly() {
  const harness = makeAudioContext({ hasPersianVoice: false });
  const ok = await harness.context.window.speakPractice([
    { text: 'این یک عبارت آزمایشی است.', phoneticHint: 'In yek ebârat-e âzmâyeshi ast.' }
  ]);
  if (ok) throw new Error('Missing Persian system speech was incorrectly reported as successful.');
  if (harness.spoken.length) throw new Error('A default English voice was used as a Persian fallback.');
  const failure = harness.speechEvents.find(event => event.type === 'farsi:speech-error');
  if (failure?.detail?.method !== 'persian-device') {
    throw new Error('Missing Persian system speech was not reported honestly.');
  }
}

(async () => {
  await testGuidedRecovery();
  await testPersianDeviceVoiceForUnbundledPhrase();
  await testMissingPersianVoiceFailsHonestly();

  const audio = fs.readFileSync(path.join(__dirname, '..', 'sentence-audio-v4.js'), 'utf8');
  for (const forbidden of [
    'englishVoice',
    'phonetic-device',
    'playPhonetic',
    'pronunciation guide',
    'persian-device-unlisted',
    "voice?.lang || 'fa-IR'",
    'translate_tts',
    'translate.google',
    'persian-stream'
  ]) {
    if (audio.includes(forbidden)) throw new Error(`Unsafe sentence fallback remains: ${forbidden}`);
  }
  if (!audio.includes('A genuine Persian system voice is unavailable')) {
    throw new Error('Sentence audio does not fail safely when no Persian system voice exists.');
  }

  const recovery = fs.readFileSync(path.join(__dirname, '..', 'guided-sentence-recovery.js'), 'utf8');
  if (!recovery.includes('Try Persian audio again') || !recovery.includes('Continue without audio')) {
    throw new Error('Sentence recovery is missing a genuine-Persian retry or escape path.');
  }

  console.log('Bundled sentence audio and Persian system-voice recovery passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
