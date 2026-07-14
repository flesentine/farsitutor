const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeAudioContext({ streamSucceeds }) {
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
      this.currentTime = 0;
    }
    setAttribute() {}
    pause() {}
    load() {}
    play() {
      audioPlayCalls += 1;
      if (!streamSucceeds) return Promise.reject(new Error('stream unavailable'));
      setTimeout(() => {
        this.onplaying?.();
        setTimeout(() => this.onended?.(), 2);
      }, 0);
      return Promise.resolve();
    }
  }

  const synthesis = {
    speaking: false,
    pending: false,
    getVoices() { return [{ name: 'English', lang: 'en-US' }]; },
    cancel() { this.speaking = false; this.pending = false; },
    resume() {},
    speak(utterance) {
      spoken.push({ text: utterance.text, lang: utterance.lang, voice: utterance.voice?.name || null });
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
  return { context, speechEvents, spoken, audioPlayCalls: () => audioPlayCalls };
}

async function testDirectPersianStreamWithoutPersianVoice() {
  const harness = makeAudioContext({ streamSucceeds: true });
  const ok = await harness.context.window.speakPractice([
    { text: 'فرودگاه دور است.', phoneticHint: 'Forudgâh dur ast.' }
  ]);
  if (!ok) throw new Error('The genuine Persian stream did not complete in the mock.');
  if (harness.audioPlayCalls() < 1) throw new Error('The Persian stream was not started on the original tap.');
  if (harness.spoken.length) throw new Error('A non-Persian device voice was used instead of the Persian stream.');
  const complete = harness.speechEvents.find(event => event.type === 'farsi:speech-complete');
  if (complete?.detail?.method !== 'persian-stream') {
    throw new Error('The audio engine did not report genuine Persian stream playback.');
  }
}

async function testStreamFailureNeverUsesDefaultVoice() {
  const harness = makeAudioContext({ streamSucceeds: false });
  const ok = await harness.context.window.speakPractice([
    { text: 'فرودگاه دور است.', phoneticHint: 'Forudgâh dur ast.' }
  ]);
  if (ok) throw new Error('Failed Persian streams were incorrectly reported as successful.');
  if (harness.audioPlayCalls() < 1) throw new Error('The Persian stream was never attempted.');
  if (harness.spoken.length) throw new Error('A default device voice was used after Persian stream failure.');
  const failure = harness.speechEvents.find(event => event.type === 'farsi:speech-error');
  if (failure?.detail?.method !== 'persian-stream') {
    throw new Error('Persian stream failure was not reported honestly.');
  }
}

(async () => {
  await testDirectPersianStreamWithoutPersianVoice();
  await testStreamFailureNeverUsesDefaultVoice();

  const audio = fs.readFileSync(path.join(__dirname, '..', 'sentence-audio-v4.js'), 'utf8');
  for (const forbidden of [
    'englishVoice',
    'phonetic-device',
    'playPhonetic',
    'pronunciation guide',
    'persian-device-unlisted',
    "voice?.lang || 'fa-IR'"
  ]) {
    if (audio.includes(forbidden)) throw new Error(`Unsafe sentence fallback remains: ${forbidden}`);
  }
  if (!audio.includes('Start the genuine Persian stream immediately')) {
    throw new Error('Sentence audio no longer starts the genuine Persian stream during the tap.');
  }
  if (!audio.includes('practiceSentence(currentWord())')) {
    throw new Error('Today’s Persian sentence is not preloaded before Step 2.');
  }

  const today = fs.readFileSync(path.join(__dirname, '..', 'guided-today-v4.js'), 'utf8');
  if (!today.includes('Audio is unavailable. You can retry or continue.')) {
    throw new Error('Today is missing an in-flow audio recovery message.');
  }

  console.log('Genuine Persian sentence audio recovery passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
