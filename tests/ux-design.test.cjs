const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const index = read('index.html');
const guided = read('guided-today-v4.js');
const styles = read('design-spec.css');
const serviceWorker = read('sw.js');

for (const text of [
  "const CORE_STEPS = ['word', 'sentence', 'recall', 'script']",
  'One useful word and letter. About 4 minutes.',
  'Start today’s lesson',
  'Today · ${number} of 4',
  'What does today’s word mean?',
  'Listen as many times as you like',
  'Continue to Script',
  'REQUIRED SCRIPT PRACTICE',
  'Check',
  'Try once more',
  'Lesson complete',
  "track('lesson_completed')"
]) {
  if (!guided.includes(text)) throw new Error(`Missing visual-spec Today behavior: ${text}`);
}

if (guided.includes('See all 5 steps') || guided.includes("['word', 'sentence', 'recall', 'script', 'reviews']")) {
  throw new Error('Review must not become a required fifth lesson step.');
}
if (guided.includes("data-guided-action=\"finish\"") || guided.includes('<small>OPTIONAL</small>Practice today’s letter')) {
  throw new Error('Script practice must be required before lesson completion.');
}
if (!index.includes('REQUIRED · STEP 4 OF 4') || !index.includes('<svg viewBox="0 0 24 24">')) {
  throw new Error('Required Script labeling or SVG navigation icons are missing.');
}
if (!guided.includes("unlockAudioStep('word')") || !guided.includes("unlockAudioStep('sentence')")) {
  throw new Error('Audio must unlock Continue without replacing or advancing the current screen.');
}
if (!guided.includes("querySelector(':scope > span:last-child')") || !guided.includes('event.stopImmediatePropagation()')) {
  throw new Error('Audio labels and lesson Back controls need dedicated, unambiguous handlers.');
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
for (const asset of ['styles.css?v=32', 'learning-upgrade.css?v=2', 'design-spec.css?v=1', 'app-ui.js?v=3', 'app-main.js?v=3', 'learning-upgrade.js?v=4', 'guided-today-v4.js?v=4']) {
  if (!index.includes(asset)) throw new Error(`Production page is missing ${asset}.`);
  if (!serviceWorker.includes(`'./${asset}'`)) throw new Error(`Offline cache is missing ${asset}.`);
}

console.log('Visual UX specification safeguards passed.');
