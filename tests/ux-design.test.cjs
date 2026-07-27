const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const index = read('index.html');
const guided = read('guided-today-v5.js');
const integrity = read('guided-integrity-v3.js');
const runtime = read('runtime-integrity-v3.js');
const serviceWorker = read('sw.js');

const requiredGuidedText = [
  'Four-step guided daily lesson',
  "const STEP_KEYS = ['word', 'sentence', 'recall', 'script'];",
  'What does the word you just heard mean?',
  'Hear it and try again',
  'Try this letter again',
  'Play slowly',
  'Practice more words',
  'lesson.done.recall = correct',
  "'retry-recall'"
];
for (const text of requiredGuidedText) {
  if (!guided.includes(text)) throw new Error(`Missing native guided UX behavior: ${text}`);
}

if (guided.includes('MutationObserver') || guided.includes('window.location.reload')) {
  throw new Error('Guided lesson must not patch its own DOM or reload for normal interactions.');
}
if (integrity.includes('MutationObserver') || integrity.includes('ensureStylesheet') || integrity.includes('document.addEventListener')) {
  throw new Error('Integrity module must remain storage-only.');
}
if (!runtime.includes('window.FarsiGuidedToday?.reloadFromStorage?.()') || runtime.includes('guidedStateDirty')) {
  throw new Error('Runtime should refresh guided state through its API, not reload flags.');
}

for (const asset of ['mobile-experience.css?v=2', 'guided-usability.css?v=2', 'guided-integrity-v3.js?v=1', 'guided-today-v5.js?v=1', 'runtime-integrity-v3.js?v=1']) {
  if (!index.includes(asset)) throw new Error(`Production page is missing ${asset}.`);
  if (!serviceWorker.includes(`'./${asset}'`)) throw new Error(`Offline cache is missing ${asset}.`);
}
for (const obsolete of [
  'guided-integrity-v1.js',
  'guided-integrity-v2.js?v=1',
  'guided-today-v3.js?v=2',
  'guided-today-v4.js?v=1',
  'runtime-integrity-v1.js',
  'runtime-integrity-v2.js?v=1'
]) {
  if (index.includes(obsolete) || serviceWorker.includes(obsolete)) {
    throw new Error(`Obsolete guided runtime is still loaded: ${obsolete}`);
  }
}

console.log('Native four-step UX design safeguards passed.');
