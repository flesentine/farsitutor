const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] || null; }
  get length() { return this.values.size; }
}

const currentDate = new Date();
const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
const midnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
const guided = {
  days: {
    [today]: {
      step: 3,
      done: { word: true, sentence: true, recall: true, script: false, reviews: false },
      script: {
        studyComplete: true,
        phase: 'today',
        todayAnswered: false,
        todaySelected: null,
        todayCorrect: false,
        pastIndex: 5,
        pastAnswered: false,
        pastSelected: null,
        pastCorrect: false
      },
      reviews: { queue: [0, 1], position: 0, revealed: true },
      completedAt: null
    }
  }
};

const storage = new MemoryStorage({
  'farsi-guided-today-v2': JSON.stringify(guided),
  'farsi-script-v1': JSON.stringify({ completed: { [today]: true } }),
  'farsi-script-review-v1': JSON.stringify({ daily: { [today]: { attempts: 1, correct: 1 } } })
});

const state = {
  cards: {
    0: {
      addedAt: 'broken', dueAt: 'broken', intervalDays: -1, streak: 'bad',
      good: '2', bad: -3, lastResult: 'maybe', lastReviewedAt: midnight + 1000
    },
    1: {
      addedAt: midnight - 1000, dueAt: midnight - 1000, intervalDays: 0,
      streak: 0, good: 0, bad: 0, lastResult: null, lastReviewedAt: null
    }
  },
  history: {}, totalGood: 0, totalBad: 0
};

const listeners = {};
let reloads = 0;
let guidedRefreshes = 0;
const windowObject = {
  __FARSI_TEST__: true,
  FarsiGuidedToday: { reloadFromStorage() { guidedRefreshes += 1; } },
  location: { reload() { reloads += 1; } },
  addEventListener(name, handler) { listeners[`window:${name}`] = handler; },
  setInterval() { return 1; }
};

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
  Map,
  localStorage: storage,
  state,
  STORAGE_KEY: 'farsi-daily-v1',
  DAY_MS: 86400000,
  SCRIPT_LESSONS: Array.from({ length: 32 }, (_, index) => ({ letter: String(index) })),
  todayKey: () => today,
  dayNumber: () => 12,
  todaysWordIndex: () => 0,
  now: () => midnight + 5000,
  getWord: index => index === 0 || index === 1 ? { fa: `word-${index}` } : undefined,
  saveState() {},
  loadState: () => state,
  showView(name) {
    if (name === 'today') windowObject.FarsiGuidedToday.reloadFromStorage();
  },
  sanitizeReviewQueue() { return true; },
  renderReviewCard() {},
  renderAll() {},
  addWord() {},
  reviewQueue: [],
  reviewIndex: 0,
  document: {
    hidden: false,
    activeElement: null,
    addEventListener(name, handler) { listeners[`document:${name}`] = handler; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; }
  },
  window: windowObject
};
windowObject.window = windowObject;

vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'runtime-integrity-v2.js'), 'utf8');
vm.runInContext(source, context);

const api = context.window.__FARSI_RUNTIME_TEST__;
if (!api) throw new Error('Runtime test API was not exposed.');

api.sanitizeStoredCards();
const normalized = state.cards[0];
if (!Number.isFinite(normalized.addedAt) || !Number.isFinite(normalized.dueAt)) {
  throw new Error('Malformed card dates were not normalized.');
}
if (normalized.good !== 2 || normalized.bad !== 0 || normalized.streak !== 0) {
  throw new Error('Malformed review counters were not normalized.');
}
if (normalized.lastResult !== null) throw new Error('Invalid lastResult was not cleared.');

if (!api.syncGuidedDayFromExternalActivity()) {
  throw new Error('External Script/Review work was not detected.');
}
const synced = JSON.parse(storage.getItem('farsi-guided-today-v2')).days[today];
if (!synced.done.script || synced.step !== 4) {
  throw new Error('Standalone Script work did not advance the guided lesson.');
}
if (synced.reviews.queue.length !== 1 || synced.reviews.queue[0] !== 1 || synced.reviews.position !== 0) {
  throw new Error('Reviews completed elsewhere were not removed from Today.');
}
if (synced.reviews.revealed !== false) {
  throw new Error('A changed review card kept a stale revealed answer.');
}

context.showView('today');
if (guidedRefreshes !== 1) {
  throw new Error('Returning to Today should refresh guided state exactly once.');
}
if (reloads !== 0) {
  throw new Error('Normal guided navigation should not reload the page.');
}

console.log('Runtime coordination behavior passed.');