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
  let playedUrl = '';
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
      playedUrl = this.src;
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

  const context = {
    console,
    Audio: FakeAudio,
    CustomEvent: FakeCustomEvent,
    Promise,
    Object,
    String,
    setTimeout,
    clearTimeout,
    document: { dispatchEvent() {} },
    setSpeechButtonBusy() {},
    window: {
      FARSI_SENTENCE_AUDIO: manifest,
      FarsiSentenceAudio: {
        async playPersian() {
          baseCalls += 1;
          return true;
        }
      }
    }
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sentence-local-audio.js'), 'utf8'), context);

  const ok = await context.window.FarsiSentenceAudio.playPersian(airport, null, 'normal');
  if (!ok) throw new Error('Bundled Persian sentence did not complete playback.');
  if (baseCalls !== 0) throw new Error('Bundled sentence incorrectly used the remote/device fallback.');
  if (playedUrl !== airportUrl) throw new Error(`Wrong local recording played: ${playedUrl}`);

  console.log(`Bundled Persian sentence audio passed with ${Object.keys(manifest).length} recordings using ${voice}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
