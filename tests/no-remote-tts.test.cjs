const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const runtimeFiles = [
  'app-core.js',
  'speech-fix.js',
  'sentence-audio-v4.js',
  'sentence-local-audio.js',
  'index.html',
  'privacy.html'
];

const forbidden = [
  /translate\.google(?:apis)?\.com/i,
  /translate_tts/i,
  /client=(?:tw-ob|gtx)/i
];

for (const filename of runtimeFiles) {
  const source = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      throw new Error(`${filename} still contains a remote Google TTS path: ${pattern}`);
    }
  }
}

const generator = fs.readFileSync(path.join(ROOT, 'tools', 'generate_audio.py'), 'utf8');
if (!generator.includes('Generate one MP3 pronunciation clip for every Farsi curriculum entry.')) {
  throw new Error('The headword audio generator no longer promises complete curriculum coverage.');
}

const curriculumContext = vm.createContext({ console });
for (const filename of [
  'words.js',
  'words-part-01.js', 'words-part-02.js', 'words-part-03.js',
  'words-part-04.js', 'words-part-05.js', 'words-part-06.js',
  'words-part-07.js', 'words-part-08.js', 'words-part-09.js'
]) {
  const fullPath = path.join(ROOT, filename);
  vm.runInContext(fs.readFileSync(fullPath, 'utf8'), curriculumContext, { filename });
}
const words = vm.runInContext('WORDS', curriculumContext);
if (!Array.isArray(words) || words.length !== 1000) {
  throw new Error(`Expected 1,000 curriculum headwords; found ${words?.length ?? 0}.`);
}

const expectedHeadwordFiles = new Set();
for (let index = 0; index < words.length; index += 1) {
  const filename = `${String(index).padStart(3, '0')}.mp3`;
  const fullPath = path.join(ROOT, 'audio', filename);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size <= 1024) {
    throw new Error(`Missing or invalid bundled headword recording: audio/${filename}`);
  }
  expectedHeadwordFiles.add(filename);
}

const actualHeadwordFiles = fs.readdirSync(path.join(ROOT, 'audio'))
  .filter(filename => /^\d{3}\.mp3$/.test(filename));
if (
  actualHeadwordFiles.length !== expectedHeadwordFiles.size
  || actualHeadwordFiles.some(filename => !expectedHeadwordFiles.has(filename))
) {
  throw new Error('The headword audio directory contains missing or orphaned numbered MP3 files.');
}

const sentenceSource = JSON.parse(fs.readFileSync(path.join(ROOT, 'sentence-audio-source.json'), 'utf8'));
if (sentenceSource.length !== 1000) {
  throw new Error(`Expected 1,000 bundled sentence entries; found ${sentenceSource.length}.`);
}

console.log('Remote Google TTS is absent and all 1,000 headword audio files are present.');
