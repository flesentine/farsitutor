const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const today = '2026-07-12';
const guidedKey = 'farsi-guided-today-v2';
const reviewKey = 'farsi-script-review-v1';
const guided = {
  days: {
    [today]: {
      step: 3,
      done: { word: true, sentence: true, recall: true, script: true, reviews: true },
      script: {
        studyComplete: true,
        phase: 'past',
        todayAnswered: true,
        todaySelected: 12,
        todayCorrect: true,
        pastIndex: 5,
        pastAnswered: false,
        pastSelected: null,
        pastCorrect: false,
        pastSatisfiedExternally: true
      },
      reviews: { queue: [], position: 0, revealed: false },
      completedAt: 123
    }
  }
};

const storage = new MemoryStorage({
  [guidedKey]: JSON.stringify(guided),
  'farsi-script-v1': JSON.stringify({ completed: { [today]: true } }),
  [reviewKey]: JSON.stringify({ daily: { [today]: { attempts: 3, correct: 0 } } })
});
const listeners = {};
const state = { cards: {}, history: {}, totalGood: 0, totalBad: 0 };
const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  Object,
  Array,
  String,
  Boolean,
  localStorage: storage,
  state,
  STORAGE_KEY: 'farsi-daily-v1',
  DAY_MS: 86400000,
  SCRIPT_LESSONS: Array.from({ length: 32 }, (_, index) => ({ letter: String(index) })),
  todayKey: () => today,
  dayNumber: () => 12,
  todaysWordIndex: () => 0,
  now: () => Date.now(),
  getWord: () => undefined,
  saveState() {},
  loadState: () => state,
  showView() {},
  sanitizeReviewQueue() { return true; },
  renderReviewCard() {},
  renderAll() {},
  addWord() {},
  document: {
    hidden: false,
    activeElement: null,
    addEventListener(name, handler) { listeners[`document:${name}`] = handler; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; }
  },
  window: {
    __FARSI_TEST__: true,
    location: { reload() {} },
    addEventListener(name, handler) { listeners[`window:${name}`] = handler; },
    setInterval() { return 1; }
  }
};
context.window.window = context.window;

vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'runtime-integrity-v1.js'), 'utf8');
vm.runInContext(source, context);
const api = context.window.__FARSI_RUNTIME_TEST__;
if (!api) throw new Error('Runtime test API was not exposed.');

if (!api.syncGuidedDayFromExternalActivity()) {
  throw new Error('Stale wrong-attempt completion state was not repaired.');
}
let day = JSON.parse(storage.getItem(guidedKey)).days[today];
if (day.done.script || day.step !== 3 || day.completedAt !== null) {
  throw new Error('Wrong previous-letter attempts incorrectly completed Today.');
}
if (day.script.pastSatisfiedExternally) {
  throw new Error('Stale external completion flag survived without a correct answer.');
}
if (day.script.phase !== 'past') {
  throw new Error('Today did not return to the older-letter question after wrong attempts.');
}

storage.setItem(reviewKey, JSON.stringify({ daily: { [today]: { attempts: 4, correct: 1 } } }));
if (!api.syncGuidedDayFromExternalActivity()) {
  throw new Error('A later correct previous-letter answer was not detected.');
}
day = JSON.parse(storage.getItem(guidedKey)).days[today];
if (!day.done.script || day.step !== 5 || !day.completedAt) {
  throw new Error('A correct previous-letter answer did not complete the lesson.');
}
if (!day.script.pastSatisfiedExternally) {
  throw new Error('Correct external previous-letter work was not recorded.');
}

console.log('Wrong previous-letter attempts remain incomplete.');
