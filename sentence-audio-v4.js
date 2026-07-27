// Persian system-voice fallback for phrases that do not have bundled recordings.
(() => {
  const baseSpeakPractice = window.speakPractice;
  let runId = 0;
  let lastResult = { method: null, error: null };

  const normalize = items => (Array.isArray(items) ? items : [items])
    .map(item => typeof item === 'string'
      ? { text: item, phoneticHint: '' }
      : { text: item?.text || '', phoneticHint: item?.phoneticHint || '' })
    .filter(item => item.text);

  const isHeadword = text => Array.isArray(WORDS) && WORDS.some(word => word.fa === text);

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`farsi:speech-${name}`, { detail }));
  }

  function persianVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find(voice => /^fa(?:-|_|$)/i.test(voice.lang))
      || voices.find(voice => /persian|farsi|iran/i.test(`${voice.name} ${voice.lang}`))
      || null;
  }

  function stopCurrent() {
    runId += 1;
    try { window.speechSynthesis?.cancel(); } catch {}
    if (typeof stopSpeech === 'function') stopSpeech();
  }

  function speakWithPersianVoice(text, voice, rate, activeRun) {
    return new Promise((resolve, reject) => {
      if (!voice || !text || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        reject(new Error('A genuine Persian system voice is unavailable'));
        return;
      }

      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;

      let settled = false;
      let started = false;
      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        clearInterval(cancelTimer);
        clearTimeout(startTimer);
        clearTimeout(maxTimer);
        ok ? resolve(true) : reject(error || new Error('Persian system speech failed'));
      };
      const markStarted = () => {
        started = true;
        clearTimeout(startTimer);
      };

      utterance.onstart = markStarted;
      utterance.onboundary = markStarted;
      utterance.onend = () => finish(started);
      utterance.onerror = event => finish(false, new Error(event.error || 'Persian system speech failed'));

      const cancelTimer = setInterval(() => {
        if (activeRun !== runId) {
          try { synthesis.cancel(); } catch {}
          finish(false, new DOMException('Cancelled', 'AbortError'));
        }
      }, 100);
      const startTimer = setTimeout(() => {
        if (!started && !synthesis.speaking && !synthesis.pending) {
          finish(false, new Error('Persian system speech did not start'));
        }
      }, 1800);
      const maxTimer = setTimeout(() => finish(false, new Error('Persian system speech timed out')), 45000);

      try {
        synthesis.resume();
        synthesis.speak(utterance);
      } catch (error) {
        finish(false, error);
      }
    });
  }

  function makeSequence(items, repeat) {
    const texts = [];
    for (let repetition = 0; repetition < repeat; repetition += 1) {
      items.forEach(item => texts.push(item.text));
    }
    return texts.join(' … ');
  }

  async function runPersian(items, button, options = {}) {
    const normalized = normalize(items);
    if (!normalized.length) return false;

    stopCurrent();
    const activeRun = runId;
    const speed = options.speed === 'slow' ? 'slow' : 'normal';
    const repeat = Math.max(1, Math.min(5, Number(options.repeat || 1)));
    const sequence = makeSequence(normalized, repeat);
    const voice = persianVoice();
    setSpeechButtonBusy(button, true);
    emit('start', { button, items: normalized, speed, repeat });

    try {
      await speakWithPersianVoice(sequence, voice, speed === 'slow' ? 0.60 : 0.82, activeRun);
      lastResult = { method: 'persian-device', error: null };
      emit('complete', { button, items: normalized, speed, repeat, method: 'persian-device' });
      return true;
    } catch (error) {
      if (activeRun !== runId || error?.name === 'AbortError') return false;
      lastResult = { method: 'persian-device', error: error?.message || String(error) };
      emit('error', { button, items: normalized, speed, repeat, method: 'persian-device', error });
      toast('This phrase has no bundled recording and a Persian system voice is unavailable.');
      return false;
    } finally {
      setSpeechButtonBusy(button, false);
    }
  }

  window.speakPractice = function speakPracticePersianOnly(items, button = null, options = {}) {
    const normalized = normalize(items);
    if (normalized.length && normalized.every(item => isHeadword(item.text))) {
      return baseSpeakPractice(items, button, options);
    }
    return runPersian(normalized, button, options);
  };

  speak = function speakPersianOnly(text, button = null, phoneticHint = '') {
    return window.speakPractice([{ text, phoneticHint }], button);
  };

  window.FarsiSentenceAudio = {
    // Retained as a no-op for older callers; the app no longer primes network audio.
    primeRemote: () => null,
    playPersian: (text, button = null, speed = 'normal') => runPersian([{ text }], button, { speed }),
    diagnostics: () => ({ ...lastResult, hasPersianVoice: Boolean(persianVoice()) })
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCurrent();
  });
})();
