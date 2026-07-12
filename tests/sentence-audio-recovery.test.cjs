const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

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

const audio = fs.readFileSync(path.join(__dirname, '..', 'sentence-audio-v4.js'), 'utf8');
for (const required of ['persian-stream', 'persian-device-unlisted', 'phonetic-device']) {
  if (!audio.includes(required)) throw new Error(`Sentence audio v4 is missing ${required}.`);
}
if (!audio.includes('You can continue without audio')) {
  throw new Error('Sentence audio failure does not explain the escape path.');
}
console.log('Sentence audio recovery passed.');