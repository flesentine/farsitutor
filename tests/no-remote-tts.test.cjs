const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const runtimeFiles = ['app-core.js', 'speech-fix.js', 'sentence-audio-v4.js', 'sentence-local-audio.js', 'index.html', 'privacy.html'];
const forbidden = [/translate\.google(?:apis)?\.com/i, /translate_tts/i, /client=(?:tw-ob|gtx)/i];

for (const filename of runtimeFiles) {
  const source = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(source)) throw new Error(`${filename} still contains remote Google TTS: ${pattern}`);
  }
}

const context = vm.createContext({ console });
for (const filename of [
  'words.js',
  'words-part-01.js', 'words-part-02.js', 'words-part-03.js',
  'words-part-04.js', 'words-part-05.js', 'words-part-06.js',
  'words-part-07.js', 'words-part-08.js', 'words-part-09.js',
  'words-order.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, filename), 'utf8'), context, { filename });
}
const data = vm.runInContext('({ words: WORDS, order: DAILY_ORDER })', context);
const words = data.words;
const order = data.order;
if (!Array.isArray(order) || order.length !== 1000 || new Set(order).size !== 1000) {
  throw new Error(`Expected 1,000 unique scheduled headwords; found ${order.length}.`);
}
if (!Array.isArray(words) || words.length < order.length) throw new Error('Stable word storage is incomplete.');
for (const index of order) {
  if (!Number.isInteger(index) || !words[index]) throw new Error(`Invalid scheduled word index: ${index}`);
}

const expected = new Set();
for (let index = 0; index < words.length; index += 1) {
  const filename = `${String(index).padStart(3, '0')}.mp3`;
  const fullPath = path.join(ROOT, 'audio', filename);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size <= 1024) {
    throw new Error(`Missing or invalid headword audio: audio/${filename}`);
  }
  expected.add(filename);
}
const actual = fs.readdirSync(path.join(ROOT, 'audio')).filter(filename => /^\d{3,4}\.mp3$/.test(filename));
if (actual.length !== expected.size || actual.some(filename => !expected.has(filename))) {
  throw new Error('Headword audio contains missing or orphaned numbered files.');
}

const sentences = JSON.parse(fs.readFileSync(path.join(ROOT, 'sentence-audio-source.json'), 'utf8'));
if (sentences.length !== 1000) throw new Error(`Expected 1,000 sentence recordings; found ${sentences.length}.`);

console.log(`Remote Google TTS is absent. ${words.length} stable headword recordings cover the 1,000-word schedule.`);
