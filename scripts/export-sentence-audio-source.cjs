const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const files = [
  'words.js',
  'words-part-01.js', 'words-part-02.js', 'words-part-03.js',
  'words-part-04.js', 'words-part-05.js', 'words-part-06.js',
  'words-part-07.js', 'words-part-08.js', 'words-part-09.js'
];

const context = vm.createContext({ console });
for (const file of files) {
  const filename = path.join(ROOT, file);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

const words = vm.runInContext('WORDS', context);
const normalize = value => String(value || '')
  .normalize('NFC')
  .replace(/\s+/g, ' ')
  .trim();

const seen = new Set();
const entries = [];
for (let index = 0; index < words.length; index += 1) {
  const word = words[index];
  const text = normalize(word.exFa || `من کلمهٔ «${word.fa}» را یاد می‌گیرم.`);
  if (!text || seen.has(text)) continue;
  seen.add(text);
  entries.push({
    id: String(index).padStart(4, '0'),
    wordIndex: index,
    text,
    latin: normalize(word.exLatin || ''),
    meaning: normalize(word.exEn || '')
  });
}

const output = path.join(ROOT, 'sentence-audio-source.json');
fs.writeFileSync(output, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`Exported ${entries.length} unique Persian sentences to ${path.relative(ROOT, output)}.`);
