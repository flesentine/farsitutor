const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'learning-upgrade.js'), 'utf8');

if (!source.includes("fromReview ? 'reviewExampleFa' : 'todayExampleFa'")) {
  throw new Error('Sentence playback does not read the exact sentence displayed in the card.');
}

if (!source.includes('window.FarsiSentenceAudio.playPersian(text, button')) {
  throw new Error('Full-sentence buttons do not call the Persian sentence engine directly.');
}

if (!source.includes("if (word?.fa === text)")) {
  throw new Error('Sentence playback lacks protection against accidentally routing a headword.');
}

if (/speak\(sentence\.fa\s*,\s*button/.test(source)) {
  throw new Error('Full-sentence playback has regressed to the generic word/speech router.');
}

console.log('Review full-sentence routing passed.');
