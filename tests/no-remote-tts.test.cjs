const fs = require('fs');
const path = require('path');

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

for (const filename of ['000.mp3', '999.mp3']) {
  const fullPath = path.join(ROOT, 'audio', filename);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size <= 1024) {
    throw new Error(`Missing bundled headword boundary file: audio/${filename}`);
  }
}

const sentenceSource = JSON.parse(fs.readFileSync(path.join(ROOT, 'sentence-audio-source.json'), 'utf8'));
if (sentenceSource.length !== 1000) {
  throw new Error(`Expected 1,000 bundled sentence entries; found ${sentenceSource.length}.`);
}

console.log('Remote Google TTS is absent and bundled audio boundary checks passed.');
