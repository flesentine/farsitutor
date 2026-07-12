const fs = require('fs');

const read = path => fs.readFileSync(path, 'utf8');
const index = read('index.html');
const appUi = read('app-ui.js');
const learning = read('learning-upgrade.js');
const guided = read('guided-learning.js');
const runtime = read('runtime-integrity-v1.js');

if (index.includes('ux-safeguards-v2.js')) {
  throw new Error('Deleted safeguard overlay is still loaded.');
}
if (!index.includes('ux-polish.css')) {
  throw new Error('UX stylesheet should be loaded statically.');
}
if (guided.includes('dailyGuide') || guided.includes('farsi-daily-guided-v1')) {
  throw new Error('Hidden legacy Today guide returned to guided-learning.js.');
}
if (/\b(rateCard|renderReviewCard)\s*=\s*function/.test(guided)) {
  throw new Error('guided-learning.js must not wrap base review functions.');
}
if (/\b(renderToday|renderReviewCard)\s*=\s*function/.test(learning)) {
  throw new Error('learning-upgrade.js must not wrap base renderers.');
}
if (!appUi.includes('function practiceSentence(') || !appUi.includes('function reviewStage(')) {
  throw new Error('Base UI does not own shared sentence and review behavior.');
}
if (runtime.includes("name === 'review'") && runtime.includes('renderReviewCard();')) {
  throw new Error('Runtime coordinator must not redraw Review during navigation.');
}

console.log('Source ownership remains concise.');
