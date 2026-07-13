// Persian-only sentence audio for iPhone Safari and installed PWAs.
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

  function speakPersianNow(text, { voice = null, rate = .82, activeRun }) {
    return new Promise((resolve, reject) => {
      if (!text || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        reject(new Error('Persian device speech unavailable'));
        return;
      }

      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || 'fa-IR';
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;

      let settled = false;
      let started = false;
      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
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

      const poll = setInterval(() => {
        if (activeRun !== runId) {
          try { synthesis.cancel(); } catch {}
          finish(false, new DOMException('Cancelled', 'AbortError'));
          return;
        }
        if (synthesis.speaking || synthesis.pending) markStarted();
      }, 80);
      const startTimer = setTimeout(() => {
        if (!started && !synthesis.speaking && !synthesis.pending) {
          finish(false, new Error('Persian device speech did not start'));
        }
      }, 1800);
      const maxTimer = setTimeout(() => finish(false, new Error('Persian device speech timed out')), 45000);

      // Must run synchronously while the original tap still owns user activation.
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

  function primeRemote(text, speed = 'normal') {
    if (!text) return null;
    const key = `${speed}:${text}`;
    const existing = remoteCache.get(key);
    if (existing) return existing;

    const entry = { key, audio: new Audio(), ready: false, failed: false, sourceIndex: 0 };
    const urls = remoteUrls(text, speed === 'slow');
    const trySource = () => {
      if (entry.sourceIndex >= urls.length) {
        entry.failed = true;
        return;
      }
      const audio = entry.audio;
      audio.preload = 'auto';
      audio.playsInline = true;
      audio.setAttribute('playsinline', '');
      audio.onloadeddata = () => { entry.ready = true; };
      audio.oncanplay = () => { entry.ready = true; };
      audio.onerror = () => {
        entry.ready = false;
        entry.sourceIndex += 1;
        trySource();
      };
      audio.src = urls[entry.sourceIndex];
      try {
        audio.load();
      } catch {
        entry.sourceIndex += 1;
        trySource();
      }
    };
    remoteCache.set(key, entry);
    trySource();
    while (remoteCache.size > 6) remoteCache.delete(remoteCache.keys().next().value);
    return entry;
  }

  function playReadyRemote(entry, activeRun) {
    return new Promise((resolve, reject) => {
      if (!entry || entry.failed || (!entry.ready && entry.audio.readyState < 2)) {
        reject(new Error('Persian stream is not ready'));
        return;
      }
      const audio = entry.audio;
      let settled = false;
      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (activeAudio === audio) activeAudio = null;
        if (!ok) entry.failed = true;
        ok ? resolve(true) : reject(error || new Error('Persian stream failed'));
      };
      const cleanup = () => {
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        clearTimeout(startTimer);
        clearTimeout(maxTimer);
        clearInterval(cancelTimer);
      };
      audio.onplaying = () => clearTimeout(startTimer);
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false, new Error('Persian stream source failed'));
      const startTimer = setTimeout(() => finish(false, new Error('Persian stream did not start')), 2200);
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
        promise: speakPersianNow(item.text, { voice, rate: slow ? .60 : .82, activeRun })
      };
    }

    const remote = primeRemote(item.text, speed);
    if (remote?.ready || remote?.audio?.readyState >= 2) {
      return { method: 'persian-stream', promise: playReadyRemote(remote, activeRun) };
    }

    // Some iPhones honor fa-IR even when getVoices() omits the Persian voice.
    return {
      method: 'persian-device-unlisted',
      promise: speakPersianNow(item.text, { rate: slow ? .60 : .82, activeRun })
    };
  }

  async function playPersian(text, button = null, speed = 'normal') {
    if (!text) return false;
    stopCurrent();
    const activeRun = runId;
    setSpeechButtonBusy(button, true);
    const selected = choosePersianMethod({ text }, speed, activeRun);
    try {
      await selected.promise;
      lastResult = { method: selected.method, error: null };
      emit('complete', { button, items: [{ text }], speed, repeat: 1, method: selected.method });
      return true;
    } catch (error) {
      if (activeRun !== runId || error?.name === 'AbortError') return false;
      lastResult = { method: selected.method, error: error?.message || String(error) };
      emit('error', { button, items: [{ text }], speed, repeat: 1, method: selected.method, error });
      return false;
    } finally {
      setSpeechButtonBusy(button, false);
    }
  }

  window.speakPractice = async function speakPracticePersianOnly(items, button = null, options = {}) {
    const normalized = normalize(items);
    if (!normalized.length) return false;
    if (normalized.every(item => isHeadword(item.text))) return baseSpeakPractice(items, button, options);

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
    playPersian,
    diagnostics: () => ({ ...lastResult, hasPersianVoice: Boolean(persianVoice()) })
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCurrent();
  });
})();
