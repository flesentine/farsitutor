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
const storage = new MemoryStorage({
  [guidedKey]: JSON.stringify({
    days: {
      [today]: {
        step: 'broken',
        done: { word: true, sentence: true, recall: true, script: true, reviews: true },
        recall: { answered: true, selected: 4, correct: false },
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
  }),
  'farsi-script-v1': JSON.stringify({ completed: { [today]: true } }),
  [reviewKey]: JSON.stringify({ daily: { [today]: { attempts: 1, correct: 0 } } })
});
let saveCount = 0;
const state = { cards: { 0: { dueAt: 0 }, 99: { dueAt: 0 } } };
const windowObject = { __FARSI_TEST__: true };
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
  getWord: index => index === 0 ? { fa: 'سلام', latin: 'salâm' } : undefined,
  saveState: () => { saveCount += 1; },
  window: windowObject
};
windowObject.window = windowObject;

vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'guided-integrity-v2.js'), 'utf8');
vm.runInContext(source, context);
const api = context.window.__FARSI_GUIDED_INTEGRITY_TEST__;
if (!api) throw new Error('Guided integrity test API was not exposed.');
if (context.window.FarsiGuidedIntegrity !== api) throw new Error('Production integrity API was not exposed.');

if (state.cards[99]) throw new Error('Invalid card was not removed before guided render.');
if (saveCount !== 1) throw new Error('Sanitized card state was not saved exactly once.');

let day = JSON.parse(storage.getItem(guidedKey)).days[today];
if (day.reviews.queue.length !== 1 || day.reviews.queue[0] !== 0) {
  throw new Error('Invalid guided review indexes were not removed.');
}
if (day.reviews.position !== 0 || day.reviews.revealed !== false || day.done.reviews !== false) {
  throw new Error('Malformed review state was not repaired.');
}
if (day.done.recall !== false || day.step !== 2) {
  throw new Error('A wrong meaning answer incorrectly completed the listening check.');
}
if (day.done.script !== false || day.completedAt !== null || day.script.phase !== 'past') {
  throw new Error('A wrong older-letter attempt incorrectly completed Script.');
}

storage.setItem(reviewKey, JSON.stringify({ daily: { [today]: { attempts: 2, correct: 1 } } }));
if (!api.sanitizeGuidedDay()) throw new Error('Correct external older-letter work was not detected.');
day = JSON.parse(storage.getItem(guidedKey)).days[today];
if (!day.done.script) throw new Error('Correct external older-letter work did not complete Script.');

console.log('Guided integrity behavior passed.');
