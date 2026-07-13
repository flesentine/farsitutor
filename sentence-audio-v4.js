// Genuine Persian sentence audio for browsers and installed PWAs.
(() => {
  const baseSpeakPractice = window.speakPractice;
  const remoteCache = new Map();
  let activeAudio = null;
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
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch {}
      activeAudio = null;
    }
    try { window.speechSynthesis?.cancel(); } catch {}
    if (typeof stopSpeech === 'function') stopSpeech();
  }

  function speakWithPersianVoice(text, voice, rate, activeRun) {
    return new Promise((resolve, reject) => {
      if (!voice || !text || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        reject(new Error('A genuine Persian device voice is unavailable'));
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
        ok ? resolve(true) : reject(error || new Error('Persian device speech failed'));
      };
      const markStarted = () => {
        started = true;
        clearTimeout(startTimer);
      };

      utterance.onstart = markStarted;
      utterance.onboundary = markStarted;
      utterance.onend = () => finish(started);
      utterance.onerror = event => finish(false, new Error(event.error || 'Persian device speech failed'));

      const cancelTimer = setInterval(() => {
        if (activeRun !== runId) {
          try { synthesis.cancel(); } catch {}
          finish(false, new DOMException('Cancelled', 'AbortError'));
        }
      }, 100);
      const startTimer = setTimeout(() => {
        if (!started && !synthesis.speaking && !synthesis.pending) {
          finish(false, new Error('Persian device speech did not start'));
        }
      }, 1800);
      const maxTimer = setTimeout(() => finish(false, new Error('Persian device speech timed out')), 45000);

      try {
        synthesis.resume();
        synthesis.speak(utterance);
      } catch (error) {
        finish(false, error);
      }
    });
  }

  function remoteUrls(text, slow) {
    const encoded = encodeURIComponent(text);
    const speed = slow ? '0.24' : '1';
    return [
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fa&ttsspeed=${speed}&q=${encoded}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=fa&ttsspeed=${speed}&q=${encoded}`
    ];
  }

  function createRemoteSource(url) {
    const audio = new Audio();
    const source = { audio, ready: false, failed: false };
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.setAttribute?.('playsinline', '');
    audio.onloadeddata = () => { source.ready = true; };
    audio.oncanplay = () => { source.ready = true; };
    audio.onerror = () => { source.failed = true; };
    audio.src = url;
    try { audio.load(); } catch { source.failed = true; }
    return source;
  }

  function primeRemote(text, speed = 'normal') {
    if (!text) return null;
    const key = `${speed}:${text}`;
    const existing = remoteCache.get(key);
    if (existing) return existing;

    const entry = {
      key,
      sources: remoteUrls(text, speed === 'slow').map(createRemoteSource)
    };
    remoteCache.set(key, entry);
    while (remoteCache.size > 6) remoteCache.delete(remoteCache.keys().next().value);
    return entry;
  }

  function playRemoteSource(source, activeRun) {
    return new Promise((resolve, reject) => {
      if (!source || source.failed) {
        reject(new Error('Persian stream source is unavailable'));
        return;
      }

      const audio = source.audio;
      let settled = false;
      const cleanup = () => {
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        clearTimeout(startTimer);
        clearTimeout(maxTimer);
        clearInterval(cancelTimer);
      };
      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (activeAudio === audio) activeAudio = null;
        if (!ok) source.failed = true;
        ok ? resolve(true) : reject(error || new Error('Persian stream failed'));
      };

      audio.onplaying = () => {
        source.ready = true;
        clearTimeout(startTimer);
      };
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false, new Error('Persian stream source failed'));
      const startTimer = setTimeout(() => finish(false, new Error('Persian stream did not start')), 6000);
      const maxTimer = setTimeout(() => finish(false, new Error('Persian stream timed out')), 45000);
      const cancelTimer = setInterval(() => {
        if (activeRun !== runId) finish(false, new DOMException('Cancelled', 'AbortError'));
      }, 100);

      activeAudio = audio;
      try {
        audio.currentTime = 0;
        audio.volume = 1;
        const result = audio.play();
        result?.catch?.(error => finish(false, error));
      } catch (error) {
        finish(false, error);
      }
    });
  }

  async function playRemote(entry, activeRun) {
    if (!entry) throw new Error('Persian stream is unavailable');
    const sources = [...entry.sources]
      .filter(source => !source.failed)
      .sort((left, right) => Number(right.ready) - Number(left.ready));
    if (!sources.length) throw new Error('Persian stream is unavailable');

    let lastError;
    for (const source of sources) {
      try {
        await playRemoteSource(source, activeRun);
        return true;
      } catch (error) {
        if (activeRun !== runId || error?.name === 'AbortError') throw error;
        lastError = error;
      }
    }
    throw lastError || new Error('Persian stream failed');
  }

  function makeSequence(items, repeat) {
    const texts = [];
    for (let repetition = 0; repetition < repeat; repetition += 1) {
      items.forEach(item => texts.push(item.text));
    }
    return { text: texts.join(' … ') };
  }

  function choosePersianMethod(item, speed, activeRun) {
    const slow = speed === 'slow';
    const voice = persianVoice();
    if (voice) {
      return {
        method: 'persian-device',
        promise: speakWithPersianVoice(item.text, voice, slow ? .60 : .82, activeRun)
      };
    }

    // Start the genuine Persian stream immediately while the tap still owns media activation.
    const remote = primeRemote(item.text, speed);
    return { method: 'persian-stream', promise: playRemote(remote, activeRun) };
  }

  async function runPersian(items, button, options = {}) {
    const normalized = normalize(items);
    if (!normalized.length) return false;

    stopCurrent();
    const activeRun = runId;
    const speed = options.speed === 'slow' ? 'slow' : 'normal';
    const repeat = Math.max(1, Math.min(5, Number(options.repeat || 1)));
    const sequence = makeSequence(normalized, repeat);
    setSpeechButtonBusy(button, true);
    emit('start', { button, items: normalized, speed, repeat });

    const selected = choosePersianMethod(sequence, speed, activeRun);
    try {
      await selected.promise;
      lastResult = { method: selected.method, error: null };
      emit('complete', { button, items: normalized, speed, repeat, method: selected.method });
      return true;
    } catch (error) {
      if (activeRun !== runId || error?.name === 'AbortError') return false;
      lastResult = { method: selected.method, error: error?.message || String(error) };
      emit('error', { button, items: normalized, speed, repeat, method: selected.method, error });
      toast('Real Persian audio could not start. Try again or continue without audio.');
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

  function todaysSentenceText() {
    try {
      if (typeof currentWord === 'function' && typeof practiceSentence === 'function') {
        return practiceSentence(currentWord())?.fa || '';
      }
    } catch {}
    return '';
  }

  function primeTodaysSentence() {
    const text = todaysSentenceText()
      || document.querySelector('#todayView .guided-sentence')?.textContent?.trim()
      || '';
    if (!text) return;
    primeRemote(text, 'normal');
    primeRemote(text, 'slow');
  }

  if (typeof MutationObserver !== 'undefined') {
    const todayView = document.getElementById('todayView');
    if (todayView) {
      new MutationObserver(primeTodaysSentence)
        .observe(todayView, { childList: true, subtree: true, characterData: true });
    }
  }
  setTimeout(primeTodaysSentence, 0);
  setTimeout(primeTodaysSentence, 400);

  window.FarsiSentenceAudio = {
    primeRemote,
    playPersian: (text, button = null, speed = 'normal') => runPersian([{ text }], button, { speed }),
    diagnostics: () => ({ ...lastResult, hasPersianVoice: Boolean(persianVoice()) })
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCurrent();
  });
})();