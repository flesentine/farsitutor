const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  key(index) { return [...this.values.keys()][index] || null; }
  get length() { return this.values.size; }
}

const lessons = [
  { letter: 'ا', name: 'alef', sound: 'a / â', forms: ['ا', 'ا', 'ـا', 'ـا'], exampleFa: 'آب', exampleLatin: 'âb', exampleEn: 'water' },
  { letter: 'ب', name: 'be', sound: 'b', forms: ['ب', 'بـ', 'ـبـ', 'ـب'], exampleFa: 'بابا', exampleLatin: 'bâbâ', exampleEn: 'dad' },
  { letter: 'ت', name: 'te', sound: 't', forms: ['ت', 'تـ', 'ـتـ', 'ـت'], exampleFa: 'تو', exampleLatin: 'to', exampleEn: 'you' },
  { letter: 'ط', name: 'tâ', sound: 't', forms: ['ط', 'طـ', 'ـطـ', 'ـط'], exampleFa: 'طبیعت', exampleLatin: 'tabiat', exampleEn: 'nature' },
  { letter: 'ج', name: 'jim', sound: 'j', forms: ['ج', 'جـ', 'ـجـ', 'ـج'], exampleFa: 'جای', exampleLatin: 'jâ', exampleEn: 'place' }
];
const today = '2026-07-12';
const storage = new MemoryStorage({
  'farsi-script-v1': JSON.stringify({ completed: {
    '2026-07-09': true,
    '2026-07-10': true,
    '2026-07-11': true
  } })
});
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
  Set,
  localStorage: storage,
  SCRIPT_LESSONS: lessons,
  DAY_MS: 86400000,
  CURRICULUM_START: '2026-07-09',
  todayKey: () => today,
  dayNumber: () => 3,
  escapeHTML: value => String(value),
  window: { __FARSI_TEST__: true }
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'script-quiz-utils.js'), 'utf8'), context);
const quiz = context.window.__FARSI_SCRIPT_QUIZ_TEST__;
if (!quiz) throw new Error('Shared script quiz API was not exposed.');

const ambiguous = quiz.questionFor(3, 0);
if (ambiguous.type === 'sound') throw new Error('A duplicate Persian sound was used as a single-answer question.');
if (ambiguous.type !== 'form' || ambiguous.html.includes('طبیعت') || ambiguous.html.includes('tabiat')) {
  throw new Error('The safe fallback did not use a contextual letter form.');
}

const formQuestion = quiz.questionFor(1, 2);
if (formQuestion.type !== 'form' || formQuestion.html.includes('بابا') || formQuestion.html.includes('bâbâ')) {
  throw new Error('The form question leaked the example word or transliteration.');
}

const choices = quiz.buildChoices(3, ambiguous);
if (!choices.includes(3) || new Set(choices).size !== choices.length) {
  throw new Error('Quiz choices lost the target or contain duplicates.');
}
if (choices.some(index => ![0, 1, 2, 3].includes(index))) {
  throw new Error('Future letters were used even though enough learned letters were available.');
}

for (const file of ['learning-upgrade.js', 'script-review-v2.js', 'guided-today-v4.js']) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  if (source.includes('Which letter appears in')) {
    throw new Error(`${file} still contains an answer-leaking example-word question.`);
  }
}

const currentQuiz = fs.readFileSync(path.join(__dirname, '..', 'learning-upgrade.js'), 'utf8');
const olderQuiz = fs.readFileSync(path.join(__dirname, '..', 'script-review-v2.js'), 'utf8');
if (!currentQuiz.includes('window.FarsiScriptQuiz') || !currentQuiz.includes('.questionFor') || !currentQuiz.includes('.buildChoices')) {
  throw new Error('The current-letter quiz is bypassing shared safety rules.');
}
if (!olderQuiz.includes('FarsiScriptQuiz.questionFor') || !olderQuiz.includes('Try this letter again')) {
  throw new Error('The older-letter quiz is missing shared safety or forced retry behavior.');
}

console.log('Script quiz answer safety passed.');
