const fs = require('fs');
const path = require('path');
const vm = require('vm');

const elements = new Map();
const timers = [];

function element() {
  return {
    disabled: false,
    value: '',
    textContent: '',
    innerHTML: '',
    classList: {
      toggle() {}, add() {}, remove() {}, contains() { return false; }
    },
    style: {},
    appendChild() {},
    closest() { return element(); }
  };
}

const word = { fa: 'سلام', latin: 'salâm', en: 'hello', category: 'Everyday' };
const context = {
  console,
  Map,
  Math,
  Date,
  Number,
  Object,
  Array,
  String,
  Boolean,
  setTimeout: callback => { timers.push(callback); return timers.length; },
  window: { setTimeout: callback => { timers.push(callback); return timers.length; } },
  document: { createElement: element, querySelectorAll: () => [] },
  WORDS: [word],
  state: {
    cards: {
      0: {
        addedAt: 1,
        dueAt: 0,
        intervalDays: 0,
        streak: 0,
        good: 0,
        bad: 0,
        lastResult: null,
        lastReviewedAt: null
      }
    },
    history: {},
    totalGood: 0,
    totalBad: 0
  },
  reviewQueue: [0],
  reviewIndex: 0,
  currentFilter: 'all',
  DAY_MS: 86400000,
  now: () => 1000,
  todayKey: () => '2026-07-12',
  getWord: index => index === 0 ? word : undefined,
  todaysWordIndex: () => 0,
  renderVerbDetails() {},
  formatDate() { return 'Jul 13'; },
  saveState() {},
  escapeHTML: value => String(value),
  $: id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  }
};

vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'app-ui.js'), 'utf8');
vm.runInContext(source, context);
context.renderAll = () => {};
context.renderReviewCard = () => {};

context.rateCard('bad');
context.rateCard('bad');
if (context.state.totalBad !== 1) throw new Error('Rapid double tap scored twice.');
if (context.reviewQueue.length !== 2) throw new Error('First miss should add exactly one retry.');

while (timers.length) timers.shift()();
context.rateCard('bad');
if (context.state.totalBad !== 2) throw new Error('Retry miss was not recorded.');
if (context.reviewQueue.length !== 2) throw new Error('Missed card caused unbounded queue growth.');

context.reviewQueue = [0];
context.reviewIndex = 0;
delete context.state.cards[0];
if (context.sanitizeReviewQueue() !== false || context.reviewQueue.length !== 0) {
  throw new Error('Deleted card remained in the review queue.');
}

console.log('Review integrity behavior passed.');
