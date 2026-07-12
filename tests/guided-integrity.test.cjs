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
const scriptKey = 'farsi-script-v1';
const reviewKey = 'farsi-script-review-v1';
const guided = {
  days: {
    [today]: {
      step: 5,
      done: { word: true, sentence: true, recall: true, script: true, reviews: false },
      script: {
        studyComplete: true,
        phase: 'past',
        todayAnswered: true,
        todaySelected: 12,
        todayCorrect: true,
        pastIndex: 5,
        pastAnswered: true,
        pastSelected: 4,
        pastCorrect: false
      },
      reviews: { queue: [99, 0], position: 'broken', revealed: true },
      completedAt: 123
    }
  }
};

const storage = new MemoryStorage({
  [guidedKey]: JSON.stringify(guided),
  [scriptKey]: JSON.stringify({ completed: { [today]: true } }),
  [reviewKey]: JSON.stringify({ daily: { [today]: { attempts: 1, correct: 0 } } })
});
const timers = [];
const listeners = {};
let saveCount = 0;
const state = {
  cards: {
    0: { dueAt: 0 },
    99: { dueAt: 0 }
  }
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
  SCRIPT_LESSONS: Array.from({ length: 32 }, (_, index) => ({ letter: String(index) })),
  todayKey: () => today,
  dayNumber: () => 12,
  getWord: index => index === 0 ? { fa: 'سلام' } : undefined,
  saveState: () => { saveCount += 1; },
  document: {
    addEventListener(name, handler) { listeners[name] = handler; },
    getElementById() { return null; }
  },
  MutationObserver: class { observe() {} },
  window: {
    __FARSI_TEST__: true,
    setTimeout(callback) { timers.push(callback); return timers.length; },
    location: { reload() {} }
  }
};
context.window.window = context.window;

vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'guided-integrity-v1.js'), 'utf8');
vm.runInContext(source, context);
const api = context.window.__FARSI_GUIDED_INTEGRITY_TEST__;
if (!api) throw new Error('Guided integrity test API was not exposed.');

if (state.cards[99]) throw new Error('Invalid card was not removed before guided render.');
if (saveCount !== 1) throw new Error('Sanitized card state was not saved exactly once.');

const sanitized = JSON.parse(storage.getItem(guidedKey)).days[today];
if (sanitized.reviews.queue.length !== 1 || sanitized.reviews.queue[0] !== 0) {
  throw new Error('Invalid guided review indexes were not removed.');
}
if (sanitized.reviews.position !== 0 || sanitized.reviews.revealed !== false) {
  throw new Error('Malformed review position or stale revealed answer was not reset.');
}
if (sanitized.done.script !== false || sanitized.step !== 3 || sanitized.completedAt !== null) {
  throw new Error('A wrong older-letter attempt incorrectly completed Script.');
}
if (api.retryKind() !== 'past') throw new Error('Wrong older letter was not identified for retry.');
if (!api.resetLetterForRetry('past')) throw new Error('Older-letter retry reset failed.');
const reset = JSON.parse(storage.getItem(guidedKey)).days[today];
if (reset.script.pastAnswered || reset.script.phase !== 'past') {
  throw new Error('Older-letter retry did not clear the answer state.');
}

if (!api.acquireRatingLock()) throw new Error('First guided rating was incorrectly blocked.');
if (api.acquireRatingLock()) throw new Error('Rapid second guided rating was not blocked.');
while (timers.length) timers.shift()();
if (!api.acquireRatingLock()) throw new Error('Guided rating lock did not release.');

const corrected = JSON.parse(storage.getItem(guidedKey));
corrected.days[today].script.pastAnswered = false;
corrected.days[today].script.pastCorrect = false;
storage.setItem(guidedKey, JSON.stringify(corrected));
storage.setItem(reviewKey, JSON.stringify({ daily: { [today]: { attempts: 2, correct: 1 } } }));
if (!api.sanitizeGuidedDay()) throw new Error('Correct external older-letter work was not detected.');
const completed = JSON.parse(storage.getItem(guidedKey)).days[today];
if (!completed.done.script) throw new Error('Correct external older-letter work did not complete Script.');

console.log('Guided integrity behavior passed.');
