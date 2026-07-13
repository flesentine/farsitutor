// Prefer same-origin Persian sentence recordings over device or remote speech.
(() => {
  const audioMap = window.FARSI_SENTENCE_AUDIO || {};
  const sentenceAudio = window.FarsiSentenceAudio;
  if (!sentenceAudio?.playPersian || !Object.keys(audioMap).length) return;

  const basePlayPersian = sentenceAudio.playPersian.bind(sentenceAudio);
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

  function localUrl(text) {
    const normalized = normalizeText(text);
    return audioMap[normalized] || null;
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

  sentenceAudio.localUrl = localUrl;
  sentenceAudio.stopLocal = stopLocal;
})();
