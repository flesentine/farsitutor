const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const index = read('index.html');
const guided = read('guided-today-v4.js');
const styles = read('design-spec.css');
const serviceWorker = read('sw.js');

for (const text of [
  "const CORE_STEPS = ['word', 'sentence', 'recall']",
  'One useful word. About 3 minutes.',
  'Start today’s lesson',
  'Today · ${number} of 3',
  'What did you hear?',
  'Check',
  'Try once more',
  'Lesson complete',
  'Practice today’s letter',
  "track('lesson_completed')"
]) {
  if (!guided.includes(text)) throw new Error(`Missing visual-spec Today behavior: ${text}`);
}

if (guided.includes('See all 5 steps') || guided.includes("['word', 'sentence', 'recall', 'script', 'reviews']")) {
  throw new Error('Script or review is still required by Today.');
}
if (guided.includes('MutationObserver') || guided.includes('window.location.reload')) {
  throw new Error('Today must not patch its DOM or reload during normal interactions.');
}
if (/data-view="script"/.test(index)) throw new Error('Script remains a permanent navigation tab.');
for (const view of ['today', 'review', 'deck']) {
  if (!index.includes(`data-view="${view}"`)) throw new Error(`Missing primary navigation area: ${view}`);
}
for (const token of ['--bg: #f7f4ea', '--primary: #6651e8', '--success: #2c8e70', '--content-max: 560px']) {
  if (!styles.includes(token)) throw new Error(`Missing design token: ${token}`);
}
for (const asset of ['styles.css?v=32', 'design-spec.css?v=1', 'app-ui.js?v=3', 'app-main.js?v=3', 'guided-today-v4.js?v=2']) {
  if (!index.includes(asset)) throw new Error(`Production page is missing ${asset}.`);
  if (!serviceWorker.includes(`'./${asset}'`)) throw new Error(`Offline cache is missing ${asset}.`);
}

console.log('Visual UX specification safeguards passed.');
