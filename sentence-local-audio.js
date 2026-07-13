// Prefer same-origin Persian sentence recordings over device or remote speech.
(() => {
  const audioMap = window.FARSI_SENTENCE_AUDIO || {};
  const sentenceAudio = window.FarsiSentenceAudio;
  if (!sentenceAudio?.playPersian || !Object.keys(audioMap).length) return;

  const basePlayPersian = sentenceAudio.playPersian.bind(sentenceAudio);
  const baseSpeakPractice = window.speakPractice.bind(window);
  let activeAudio = null;
  let requestId = 0;

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFC')
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeItems(items) {
    return (Array.isArray(items) ? items : [items])
      .map(item => typeof item === 'string'
        ? { text: item, phoneticHint: '' }
        : { text: item?.text || '', phoneticHint: item?.phoneticHint || '' })
      .filter(item => item.text);
  }

  function localUrl(text) {
    return audioMap[normalizeText(text)] || null;
  }

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`farsi:speech-${name}`, { detail }));
  }

  function stopLocal() {
    requestId += 1;
    if (!activeAudio) return;
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {}
    activeAudio = null;
  }

  function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  function playFile(url, text, button, speed) {
    stopLocal();
    const currentRequest = requestId;
    const audio = new Audio(url);
    activeAudio = audio;
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.setAttribute?.('playsinline', '');
    audio.playbackRate = speed === 'slow' ? 0.78 : 1;
    audio.volume = 1;
    setSpeechButtonBusy(button, true);
    emit('start', { button, items: [{ text }], speed, repeat: 1, method: 'local-sentence' });

    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        clearTimeout(startTimer);
        clearTimeout(maxTimer);
        if (activeAudio === audio) activeAudio = null;
        setSpeechButtonBusy(button, false);
      };
      const finish = (ok, error = null) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (currentRequest !== requestId) {
          resolve(false);
          return;
        }
        if (ok) {
          emit('complete', { button, items: [{ text }], speed, repeat: 1, method: 'local-sentence' });
          resolve(true);
        } else {
          reject(error || new Error('Local Persian sentence audio failed'));
        }
      };

      audio.onplaying = () => clearTimeout(startTimer);
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false, new Error('Local Persian sentence file could not play'));
      const startTimer = setTimeout(() => finish(false, new Error('Local Persian sentence audio did not start')), 3500);
      const maxTimer = setTimeout(() => finish(false, new Error('Local Persian sentence audio timed out')), 45000);

      try {
        const result = audio.play();
        result?.catch?.(error => finish(false, error));
      } catch (error) {
        finish(false, error);
      }
    });
  }

  sentenceAudio.playPersian = async function playBundledPersian(text, button = null, speed = 'normal') {
    const url = localUrl(text);
    if (!url) return basePlayPersian(text, button, speed);
    try {
      return await playFile(url, text, button, speed);
    } catch {
      return basePlayPersian(text, button, speed);
    }
  };

  window.speakPractice = async function speakPracticeWithBundledSentences(items, button = null, options = {}) {
    const normalized = normalizeItems(items);
    if (!normalized.length || !normalized.some(item => localUrl(item.text))) {
      return baseSpeakPractice(items, button, options);
    }

    const speed = options.speed === 'slow' ? 'slow' : 'normal';
    const repeat = Math.max(1, Math.min(5, Number(options.repeat || 1)));
    const pauseMs = Math.max(150, Math.min(2000, Number(options.pauseMs || 650)));

    for (let repetition = 0; repetition < repeat; repetition += 1) {
      for (let itemIndex = 0; itemIndex < normalized.length; itemIndex += 1) {
        const item = normalized[itemIndex];
        const ok = localUrl(item.text)
          ? await sentenceAudio.playPersian(item.text, button, speed)
          : await baseSpeakPractice([item], button, { speed });
        if (!ok) return false;

        const moreItems = itemIndex < normalized.length - 1;
        const moreRepetitions = repetition < repeat - 1;
        if (moreItems || moreRepetitions) await wait(pauseMs);
      }
    }
    return true;
  };

  sentenceAudio.localUrl = localUrl;
  sentenceAudio.stopLocal = stopLocal;
})();
