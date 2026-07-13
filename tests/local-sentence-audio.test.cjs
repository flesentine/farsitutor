const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

async function main() {
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
  if (!manifest || Object.keys(manifest).length < 900) {
    throw new Error('The bundled sentence manifest is unexpectedly incomplete.');
  }

  const airport = 'فرودگاه دور است.';
  const airportUrl = manifest[airport];
  if (!airportUrl) throw new Error('The airport sentence is missing from bundled audio.');
  const airportFile = path.join(ROOT, airportUrl.replace(/^\.\//, ''));
  if (!fs.existsSync(airportFile) || fs.statSync(airportFile).size <= 1024) {
    throw new Error('The airport sentence MP3 is missing or empty.');
  }

  for (const url of Object.values(manifest)) {
    const filename = path.join(ROOT, url.replace(/^\.\//, ''));
    if (!fs.existsSync(filename) || fs.statSync(filename).size <= 1024) {
      throw new Error(`Missing generated sentence recording: ${url}`);
    }
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

  console.log(`Bundled Persian sentence audio passed with ${Object.keys(manifest).length} recordings using ${voice}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
