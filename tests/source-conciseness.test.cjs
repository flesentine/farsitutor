const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const index = read('index.html');
const appUi = read('app-ui.js');
const learning = read('learning-upgrade.js');
const guidedToday = read('guided-today-v4.js');

for (const obsolete of [
  'guided-learning.css', 'ux-polish.css', 'mobile-experience.css',
  'guided-usability.css', 'guided-audio-recovery.css', 'guided-learning.js',
  'guided-integrity-v2.js', 'guided-sentence-recovery.js', 'runtime-integrity-v2.js'
]) {
  if (index.includes(obsolete)) throw new Error(`Overlapping runtime layer is still loaded: ${obsolete}`);
}

if (!index.includes('design-spec.css?v=1') || !index.includes('guided-today-v4.js?v=2')) {
  throw new Error('The visual-spec presentation and Today renderer must be loaded statically.');
}
if (!appUi.includes('function practiceSentence(') || !appUi.includes('function reviewStage(')) {
  throw new Error('Base UI does not own shared sentence and review behavior.');
}
if (/\b(renderToday|renderReviewCard)\s*=\s*function/.test(learning)) {
  throw new Error('Script practice must not wrap base renderers.');
}
if (guidedToday.includes('MutationObserver') || guidedToday.includes('ensureStylesheet')) {
  throw new Error('Guided Today must render its UX directly.');
}

console.log('Source ownership remains concise.');
