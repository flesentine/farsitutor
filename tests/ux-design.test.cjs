const fs = require('fs');

const integrity = fs.readFileSync('guided-integrity-v1.js', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');

const requiredIntegrityText = [
  "ensureStylesheet('./mobile-experience.css?v=2'",
  "ensureStylesheet('./guided-usability.css?v=1'",
  'What does the word you just heard mean?',
  'Hear it and try again',
  'day.done.recall = false',
  'Try this letter again'
];

for (const text of requiredIntegrityText) {
  if (!integrity.includes(text)) throw new Error(`Missing guided UX safeguard: ${text}`);
}

if (!serviceWorker.includes("'./mobile-experience.css?v=2'")) {
  throw new Error('Mobile-first navigation stylesheet is not cached.');
}
if (!serviceWorker.includes("'./guided-usability.css?v=1'")) {
  throw new Error('Guided usability stylesheet is not cached.');
}

console.log('UX design safeguards passed.');