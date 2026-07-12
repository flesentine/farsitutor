const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const index = read('index.html');
const appUi = read('app-ui.js');
const learning = read('learning-upgrade.js');
const guidedLearning = read('guided-learning.js');
const guidedToday = read('guided-today-v4.js');
const integrity = read('guided-integrity-v2.js');
const runtime = read('runtime-integrity-v2.js');

if (index.includes('ux-safeguards-v2.js')) throw new Error('Deleted safeguard overlay is still loaded.');
if (!index.includes('ux-polish.css') || !index.includes('mobile-experience.css')) {
  throw new Error('UX stylesheets should be loaded statically.');
}
if (guidedLearning.includes('dailyGuide') || guidedLearning.includes('farsi-daily-guided-v1')) {
  throw new Error('Hidden legacy Today guide returned to guided-learning.js.');
}
if (/\b(rateCard|renderReviewCard)\s*=\s*function/.test(guidedLearning)) {
  throw new Error('guided-learning.js must not wrap base review functions.');
}
if (/\b(renderToday|renderReviewCard)\s*=\s*function/.test(learning)) {
  throw new Error('learning-upgrade.js must not wrap base renderers.');
}
if (!appUi.includes('function practiceSentence(') || !appUi.includes('function reviewStage(')) {
  throw new Error('Base UI does not own shared sentence and review behavior.');
}
if (guidedToday.includes('MutationObserver') || guidedToday.includes('ensureStylesheet')) {
  throw new Error('Guided Today must render its UX directly.');
}
if (integrity.includes('document.') || integrity.includes('MutationObserver')) {
  throw new Error('Guided integrity must remain a state-only module.');
}
if (runtime.includes('guidedStateDirty') || runtime.includes("name === 'review' &&") && runtime.includes('renderReviewCard();')) {
  throw new Error('Runtime coordinator contains obsolete redraw or reload bookkeeping.');
}

console.log('Source ownership remains concise.');
