// Gesture-first sentence audio with device, streamed, and phonetic fallbacks.
(() => {
  const baseSpeakPractice = window.speakPractice;
  const sentenceAudio = new Audio();
  sentenceAudio.preload = 'metadata';
  sentenceAudio.playsInline = true;
  sentenceAudio.setAttribute('playsinline', '');
  let runId = 0;

  function normalize(items) {
    return (Array.isArray(items) ? items : [items])
      .map(item => typeof item === 'string'
        ? { text: item, phoneticHint: '' }
        : { text: item?.text || '', phoneticHint: item?.phoneticHint || '' })
      .filter(item => item.text);
  }

  function isHeadword(text) {
    return Array.isArray(WORDS) && WORDS.some(word => word.fa === text);
  }

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

  function englishVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find(voice => /^en-US$/i.test(voice.lang))
      || voices.find(voice => /^en(?:-|_|$)/i.test(voice.lang))
      || voices[0]
      || null;
  }

  function phoneticText(value) {
    return String(value || '')
      .replaceAll('â', 'aa')
      .replaceAll('ā', 'aa')
      .replaceAll('kh', 'k h')
      .replaceAll('gh', 'g h')
      .replaceAll('zh', 'j')
      .replaceAll('q', 'g')
      .replaceAll('-', ' ')
      .replace(/[?!.,،؟«»“”]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stopAudio() {
    try {
      sentenceAudio.pause();
      sentenceAudio.currentTime = 0;
      sentenceAudio.removeAttribute('src');
      sentenceAudio.load();
    } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
    if (typeof stopSpeech === 'function') stopSpeech();
  }

  function speakDevice(text, { voice = null, lang = 'fa-IR', rate = .82, activeRun }) {
    return new Promise((resolve, reject) => {
      if (!text || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        reject(new Error('Device speech unavailable'));
        return;
      }

      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || lang;
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;

      let settled = false;
      let started = false;
      let wasActive = false;
      const startedAt = Date.now();
      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(startTimer);
        clearTimeout(maxTimer);
        ok ? resolve(true) : reject(error || new Error('Device speech failed'));
      };
      const markStarted = () => {
        started = true;
        wasActive = true;
        clearTimeout(startTimer);
      };

      utterance.onstart = markStarted;
      utterance.onboundary = markStarted;
      utterance.onend = () => finish(started || wasActive);
      utterance.onerror = event => finish(false, new Error(event.error || 'Device speech failed'));

      const poll = setInterval(() => {
        if (activeRun !== runId) {
          try { synthesis.cancel(); } catch {}
          finish(false, new DOMException('Cancelled', 'AbortError'));
          return;
        }
        if (synthesis.speaking || synthesis.pending) markStarted();
        if (wasActive && !synthesis.speaking && !synthesis.pending && Date.now() - startedAt > 300) finish(true);
      }, 80);
      const startTimer = setTimeout(() => {
        if (!started && !synthesis.speaking && !synthesis.pending) finish(false, new Error('Device speech did not start'));
      }, 1800);
      const maxTimer = setTimeout(() => finish(wasActive, new Error('Device speech timed out')), 45000);

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

  async function playRemote(text, slow, activeRun) {
    for (const url of remoteUrls(text, slow)) {
      if (activeRun !== runId) throw new DOMException('Cancelled', 'AbortError');
      try {
        await new Promise((resolve, reject) => {
          let settled = false;
          let started = false;
          const finish = (ok, error) => {
            if (settled) return;
            settled = true;
            cleanup();
            ok ? resolve(true) : reject(error || new Error('Streamed audio failed'));
          };
          const cleanup = () => {
            sentenceAudio.onplaying = null;
            sentenceAudio.onended = null;
            sentenceAudio.onerror = null;
            clearTimeout(startTimer);
            clearTimeout(maxTimer);
            clearInterval(cancelTimer);
          };
          sentenceAudio.src = url;
          sentenceAudio.volume = 1;
          sentenceAudio.playbackRate = 1;
          sentenceAudio.onplaying = () => { started = true; clearTimeout(startTimer); };
          sentenceAudio.onended = () => finish(true);
          sentenceAudio.onerror = () => finish(false, new Error('Streamed audio source failed'));
          const startTimer = setTimeout(() => {
            if (!started) finish(false, new Error('Streamed audio did not start'));
          }, 2800);
          const maxTimer = setTimeout(() => finish(false, new Error('Streamed audio timed out')), 45000);
          const cancelTimer = setInterval(() => {
            if (activeRun !== runId) finish(false, new DOMException('Cancelled', 'AbortError'));
          }, 100);
          const result = sentenceAudio.play();
          result?.catch?.(error => finish(false, error));
        });
        return true;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
      }
    }
    throw new Error('Streamed Persian audio unavailable');
  }

  async function playSentence(item, speed, activeRun) {
    const slow = speed === 'slow';
    const voice = persianVoice();

    if (voice) {
      try {
        await speakDevice(item.text, { voice, rate: slow ? .60 : .82, activeRun });
        return 'persian-device';
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
      }
    }

    try {
      await playRemote(item.text, slow, activeRun);
      return 'persian-stream';
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
    }

    try {
      await speakDevice(item.text, { lang: 'fa-IR', rate: slow ? .60 : .82, activeRun });
      return 'persian-device-unlisted';
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
    }

    const phonetic = phoneticText(item.phoneticHint);
    if (!phonetic) throw new Error('No pronunciation fallback available');
    await speakDevice(phonetic, {
      voice: englishVoice(),
      lang: 'en-US',
      rate: slow ? .55 : .70,
      activeRun
    });
    toast('Persian voice unavailable — using the pronunciation guide.');
    return 'phonetic-device';
  }

  window.speakPractice = async function speakPracticeV4(items, button = null, options = {}) {
    const normalized = normalize(items);
    if (!normalized.length) return false;
    if (normalized.every(item => isHeadword(item.text))) return baseSpeakPractice(items, button, options);

    const activeRun = ++runId;
    stopAudio();
    const speed = options.speed === 'slow' ? 'slow' : 'normal';
    const repeat = Math.max(1, Math.min(5, Number(options.repeat || 1)));
    const pauseMs = Math.max(200, Math.min(2000, Number(options.pauseMs || 650)));
    setSpeechButtonBusy(button, true);
    emit('start', { button, items: normalized, speed, repeat });

    try {
      let method = null;
      for (let index = 0; index < normalized.length; index += 1) {
        const item = normalized[index];
        for (let repetition = 0; repetition < repeat; repetition += 1) {
          if (activeRun !== runId) throw new DOMException('Cancelled', 'AbortError');
          method = isHeadword(item.text)
            ? (await baseSpeakPractice([item], null, { speed }) ? 'headword' : null)
            : await playSentence(item, speed, activeRun);
          if (!method) throw new Error('Audio failed');
          if (repetition < repeat - 1 || index < normalized.length - 1) {
            await new Promise(resolve => setTimeout(resolve, pauseMs));
          }
        }
      }
      emit('complete', { button, items: normalized, speed, repeat, method });
      return true;
    } catch (error) {
      if (activeRun !== runId || error?.name === 'AbortError') return false;
      emit('error', { button, items: normalized, speed, repeat, error });
      toast('Sentence audio still could not play. You can continue without audio.');
      return false;
    } finally {
      setSpeechButtonBusy(button, false);
    }
  };

  speak = function speakV4(text, button = null, phoneticHint = '') {
    return window.speakPractice([{ text, phoneticHint }], button);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      runId += 1;
      stopAudio();
    }
  });
})();