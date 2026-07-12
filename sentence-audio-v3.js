// Bounded, gesture-first sentence audio for mobile browsers and installed PWAs.
(() => {
  const baseSpeakPractice = window.speakPractice;
  const CACHE_LIMIT = 8;
  const audioCache = new Map();
  let currentAudio = null;
  let directRequest = 0;
  let operationId = 0;

  function normalizeItems(items) {
    return (Array.isArray(items) ? items : [items])
      .map(item => typeof item === 'string'
        ? { text: item, phoneticHint: '' }
        : { text: item?.text || '', phoneticHint: item?.phoneticHint || '' })
      .filter(item => item.text);
  }

  function isHeadword(text) {
    return Array.isArray(WORDS) && WORDS.some(word => word.fa === text);
  }

  function cancelledError() {
    const error = new Error('Speech request cancelled');
    error.name = 'AbortError';
    return error;
  }

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`farsi:speech-${name}`, { detail }));
  }

  function sourceUrls(text, speed) {
    const encoded = encodeURIComponent(text);
    const ttsSpeed = speed === 'slow' ? '0.24' : '1';
    return [
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fa&ttsspeed=${ttsSpeed}&q=${encoded}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=fa&ttsspeed=${ttsSpeed}&q=${encoded}`
    ];
  }

  const audioKey = (text, speed) => `${speed}:${text}`;

  function removeAudio(key, audio) {
    if (audioCache.get(key) === audio) audioCache.delete(key);
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.querySelectorAll('source').forEach(source => source.remove());
      audio.load();
      audio.remove();
    } catch {}
  }

  function enforceCacheLimit() {
    let attempts = 0;
    while (audioCache.size > CACHE_LIMIT && attempts <= audioCache.size) {
      attempts += 1;
      const oldest = audioCache.entries().next().value;
      if (!oldest) break;
      const [key, audio] = oldest;
      if (audio === currentAudio) {
        audioCache.delete(key);
        audioCache.set(key, audio);
      } else {
        removeAudio(key, audio);
      }
    }
  }

  function getAudio(text, speed = 'normal', preload = false) {
    const key = audioKey(text, speed);
    const cached = audioCache.get(key);
    if (cached) {
      audioCache.delete(key);
      audioCache.set(key, cached);
      return cached;
    }

    const audio = document.createElement('audio');
    audio.preload = preload ? 'auto' : 'metadata';
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.hidden = true;
    audio.dataset.farsiSentenceAudio = key;
    sourceUrls(text, speed).forEach(url => {
      const source = document.createElement('source');
      source.src = url;
      source.type = 'audio/mpeg';
      audio.appendChild(source);
    });
    document.body.appendChild(audio);
    audioCache.set(key, audio);
    enforceCacheLimit();
    if (preload) {
      try { audio.load(); } catch { removeAudio(key, audio); }
    }
    return audio;
  }

  function stopAllSpeech() {
    directRequest += 1;
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch {}
      currentAudio = null;
    }
    if (typeof stopSpeech === 'function') stopSpeech();
  }

  function playRemoteSentence(item, speed, requestId, runId) {
    const key = audioKey(item.text, speed);
    const audio = getAudio(item.text, speed, false);
    return new Promise((resolve, reject) => {
      let settled = false;
      let started = false;
      let startTimer;
      let maxTimer;
      let cancelTimer;

      const cleanup = () => {
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        audio.removeEventListener('abort', onError);
        window.clearTimeout(startTimer);
        window.clearTimeout(maxTimer);
        window.clearInterval(cancelTimer);
        if (currentAudio === audio) currentAudio = null;
      };
      const finish = (ok, error = null) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (ok) resolve(true);
        else {
          removeAudio(key, audio);
          reject(error || new Error('Sentence audio failed'));
        }
      };
      const onPlaying = () => {
        started = true;
        window.clearTimeout(startTimer);
        const estimate = Math.max(9000, item.text.length * (speed === 'slow' ? 420 : 280));
        maxTimer = window.setTimeout(() => {
          try { audio.pause(); } catch {}
          finish(false, new Error('Sentence audio timed out'));
        }, Math.min(45000, estimate));
      };
      const onEnded = () => finish(true);
      const onError = () => finish(false, new Error('Sentence audio source failed'));

      audio.addEventListener('playing', onPlaying, { once: true });
      audio.addEventListener('ended', onEnded, { once: true });
      audio.addEventListener('error', onError, { once: true });
      audio.addEventListener('abort', onError, { once: true });
      currentAudio = audio;
      cancelTimer = window.setInterval(() => {
        if (requestId !== directRequest || runId !== operationId) finish(false, cancelledError());
      }, 100);

      try {
        audio.currentTime = 0;
        audio.volume = 1;
        audio.playbackRate = 1;
        startTimer = window.setTimeout(() => {
          if (!started) finish(false, new Error('Sentence audio did not start'));
        }, 6000);
        const result = audio.play();
        if (result && typeof result.catch === 'function') result.catch(onError);
      } catch (error) {
        finish(false, error);
      }
    });
  }

  function findPersianVoiceStrict() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find(voice => /^fa(?:-|_|$)/i.test(voice.lang))
      || voices.find(voice => /persian|farsi|iran/i.test(`${voice.name} ${voice.lang}`))
      || null;
  }

  function speakWithPersianVoice(item, speed, requestId, runId) {
    return new Promise((resolve, reject) => {
      const voice = findPersianVoiceStrict();
      if (!voice || !('speechSynthesis' in window) || requestId !== directRequest || runId !== operationId) {
        reject(new Error('Persian device speech unavailable'));
        return;
      }

      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(item.text);
      let settled = false;
      let started = false;
      let startTimer;
      let maxTimer;
      let cancelTimer;
      const finish = ok => {
        if (settled) return;
        settled = true;
        window.clearTimeout(startTimer);
        window.clearTimeout(maxTimer);
        window.clearInterval(cancelTimer);
        ok ? resolve(true) : reject(new Error('Persian device speech failed'));
      };
      const onStart = () => {
        if (started) return;
        started = true;
        window.clearTimeout(startTimer);
        maxTimer = window.setTimeout(() => {
          synthesis.cancel();
          finish(false);
        }, Math.min(45000, Math.max(9000, item.text.length * 350)));
      };

      utterance.voice = voice;
      utterance.lang = voice.lang || 'fa-IR';
      utterance.rate = speed === 'slow' ? .60 : .82;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onstart = onStart;
      utterance.onboundary = onStart;
      utterance.onend = () => finish(started);
      utterance.onerror = () => finish(false);

      synthesis.cancel();
      synthesis.resume();
      cancelTimer = window.setInterval(() => {
        if (requestId !== directRequest || runId !== operationId) {
          synthesis.cancel();
          finish(false);
        }
      }, 100);
      startTimer = window.setTimeout(() => {
        if (!started) {
          synthesis.cancel();
          finish(false);
        }
      }, 4000);
      try { synthesis.speak(utterance); }
      catch { finish(false); }
    });
  }

  async function playSentence(item, speed, runId) {
    if (runId !== operationId) throw cancelledError();
    stopAllSpeech();
    const requestId = directRequest;
    try {
      return await playRemoteSentence(item, speed, requestId, runId);
    } catch (remoteError) {
      if (runId !== operationId || remoteError?.name === 'AbortError') throw cancelledError();
      try {
        return await speakWithPersianVoice(item, speed, requestId, runId);
      } catch (voiceError) {
        if (runId !== operationId) throw cancelledError();
        return baseSpeakPractice([item], null, { speed });
      }
    }
  }

  window.speakPractice = async function speakPracticeV3(items, button = null, options = {}) {
    const normalized = normalizeItems(items);
    if (!normalized.length) return false;
    const runId = ++operationId;
    stopAllSpeech();
    const containsSentence = normalized.some(item => !isHeadword(item.text));
    if (!containsSentence) return baseSpeakPractice(items, button, options);

    const speed = options.speed === 'slow' ? 'slow' : 'normal';
    const repeat = Math.max(1, Math.min(5, Number(options.repeat || 1)));
    const pauseMs = Math.max(200, Math.min(2000, Number(options.pauseMs || 650)));
    setSpeechButtonBusy(button, true);
    emit('start', { button, items: normalized, speed, repeat });

    try {
      for (let itemIndex = 0; itemIndex < normalized.length; itemIndex += 1) {
        const item = normalized[itemIndex];
        for (let repetition = 0; repetition < repeat; repetition += 1) {
          if (runId !== operationId) throw cancelledError();
          const ok = isHeadword(item.text)
            ? await baseSpeakPractice([item], null, { speed })
            : await playSentence(item, speed, runId);
          if (!ok) throw new Error('Audio failed');
          const hasMore = repetition < repeat - 1 || itemIndex < normalized.length - 1;
          if (hasMore) await new Promise(resolve => window.setTimeout(resolve, pauseMs));
        }
      }
      if (runId !== operationId) throw cancelledError();
      emit('complete', { button, items: normalized, speed, repeat });
      return true;
    } catch (error) {
      if (runId !== operationId || error?.name === 'AbortError') return false;
      emit('error', { button, items: normalized, speed, repeat, error });
      toast('Sentence audio could not play. Check media volume and internet connection.');
      return false;
    } finally {
      setSpeechButtonBusy(button, false);
    }
  };

  speak = function speakV3(text, button = null, phoneticHint = '') {
    return window.speakPractice([{ text, phoneticHint }], button);
  };

  function primeCurrentSentence() {
    const text = document.querySelector('#todayView.active .guided-sentence')?.textContent?.trim();
    if (text && !isHeadword(text)) getAudio(text, 'normal', true);
  }

  const todayView = document.getElementById('todayView');
  if (todayView) {
    const observer = new MutationObserver(primeCurrentSentence);
    observer.observe(todayView, { childList: true, subtree: true, characterData: true });
  }
  window.setTimeout(primeCurrentSentence, 50);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      operationId += 1;
      stopAllSpeech();
    }
  });
})();
