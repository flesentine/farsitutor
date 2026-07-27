const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = filename => fs.readFileSync(path.join(ROOT, filename), 'utf8');

for (const filename of fs.readdirSync(ROOT).filter(name => name.endsWith('.js'))) {
  const source = read(filename);
  if (/\b(?:window\.)?confirm\s*\(/.test(source)) {
    throw new Error(`${filename} still calls the browser confirm dialog.`);
  }
}

const dialog = read('confirmation-dialog.js');
for (const required of [
  'role="alertdialog"',
  'aria-modal="true"',
  "event.key === 'Escape'",
  "event.target === layer",
  'cancelButton.focus',
  'restoreTarget?.focus',
  "document.body.classList.add('confirm-open')",
  "document.body.classList.remove('confirm-open')"
]) {
  if (!dialog.includes(required)) throw new Error(`Confirmation dialog is missing accessibility behavior: ${required}`);
}

const appMain = read('app-main.js');
if (!appMain.includes('await loadConfirmationDialog()') || !appMain.includes('window.FarsiConfirm?.ask?.(options)')) {
  throw new Error('Base destructive actions are not routed through the in-app confirmation component.');
}
if (!appMain.includes("title: 'Reset all learning progress?'") || !appMain.includes("confirmLabel: 'Reset progress'")) {
  throw new Error('Learning reset is missing its explicit destructive confirmation copy.');
}

const visual = read('visual-upgrade-v2.js');
if (!visual.includes('await window.FarsiConfirm?.ask?.({') || !visual.includes("confirmLabel: 'Remove word'")) {
  throw new Error('Swipe and keyboard word deletion are not routed through the in-app confirmation component.');
}

const copy = read('copy-polish-v1.js');
if (copy.includes("getElementById('resetBtn')") || copy.includes('stopImmediatePropagation')) {
  throw new Error('Copy polish still owns a duplicate reset confirmation handler.');
}

const css = read('confirmation-dialog.css');
for (const required of ['@media (max-width: 640px)', 'env(safe-area-inset-bottom)', '@media (prefers-reduced-motion: reduce)', 'min-height: 48px']) {
  if (!css.includes(required)) throw new Error(`Confirmation styling is missing: ${required}`);
}

const serviceWorker = read('sw.js');
for (const asset of ['./confirmation-dialog.js?v=1', './confirmation-dialog.css?v=1']) {
  if (!serviceWorker.includes(`'${asset}'`)) throw new Error(`Offline cache is missing ${asset}.`);
}

console.log('Accessible in-app destructive confirmations passed.');
