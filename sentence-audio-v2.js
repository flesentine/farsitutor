// Gesture-first sentence pronunciation for mobile Safari and installed PWAs.
(() => {
  const baseSpeakPractice = window.speakPractice;
  const baseSpeak = speak;
  const prefetchedSentences = new Map();

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

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`farsi:speech-${name}`, { detail }));
  }

  function remoteUrl(text) {
    return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fa&ttsspeed=0.8&q=${encodeURIComponent(text)}`;
  }

  function primeSentence(text) {
    const value = String(text || '').trim();
    if (!value || isHeadword(value) || prefetchedSentences.has(value)) return;
    const audio = new Audio(remoteUrl(value));
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.addEventListener('error', () => prefetchedSentences.delete(value), { once: true });
    prefetchedSentences.set(value, audio);
    try { audio.load(); } catch { prefetchedSentences.delete(value); }
  }

  function beginRequest() {
    speechRequest += 1;
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.removeAttribute('src');
        activeAudio.load();
      } catch {}
      activeAudio = null;
    }
    if ('speechSynthesis' in window && (activeUtterance || window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      window.speechSynthesis.cancel();
    }
    activeUtterance = null;
    return speechRequest;
  }

  function playReadyAudio(audio, requestId, speed) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        window.clearInterval(cancelCheck);
        if (activeAudio === audio) activeAudio = null;
      };
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        cleanup();
        ok ? resolve(true) : reject(new Error('Prefetched sentence audio failed'));
      };
      const onEnded = () => finish(true);
      const onError = () => finish(false);
      const cancelCheck = window.setInterval(() => {
        if (requestId !== speechRequest) {
          audio.pause();
          finish(false);
        }
      }, 100);
      audio.addEventListener('ended', onEnded, { once: true });
      audio.addEventListener('error', onError, { once: true });
      audio.currentTime = 0;
      audio.playbackRate = speed === 'slow' ? .72 : 1;
      activeAudio = audio;
      try {
        const result = audio.play();
        if (result && typeof result.catch === 'function') result.catch(onError);
      } catch {
        finish(false);
      }
    });
  }

  function choosePersianVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find(voice => /^fa(?:-|_|$)/i.test(voice.lang))
      || voices.find(voice => /persian|farsi|iran/i.test(`${voice.name} ${voice.lang}`))
      || null;
  }

  function speakBrowserNow(item, requestId, speed) {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window) || requestId !== speechRequest) {
        reject(new Error('Device speech unavailable'));
        return;
      }

      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(item.text);
      const voice = choosePersianVoice();
      let settled = false;
      let started = false;
      let startTimer;
      let maxTimer;

      const cleanup = () => {
        window.clearTimeout(startTimer);
        window.clearTimeout(maxTimer);
        window.clearInterval(statePoll);
        activeUtterance = null;
      };
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        cleanup();
        ok ? resolve(true) : reject(new Error('Device sentence speech failed'));
      };
      const markStarted = () => {
        if (started) return;
        started = true;
        window.clearTimeout(startTimer);
        const estimate = Math.max(9000, item.text.length * (speed === 'slow' ? 430 : 310));
        maxTimer = window.setTimeout(() => {
          synthesis.cancel();
          finish(false);
        }, Math.min(45000, estimate));
      };
      const statePoll = window.setInterval(() => {
        if (requestId !== speechRequest) {
          synthesis.cancel();
          finish(false);
          return;
        }
        if (synthesis.speaking || synthesis.pending) markStarted();
      }, 80);

      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || 'fa-IR';
      utterance.rate = speed === 'slow' ? .60 : .82;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onstart = markStarted;
      utterance.onboundary = markStarted;
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      activeUtterance = utterance;

      synthesis.resume();
      startTimer = window.setTimeout(() => {
        if (!started) {
          synthesis.cancel();
          finish(false);
        }
      }, 4000);

      try {
        // This call intentionally happens in the original tap stack on iPhone/PWA.
        synthesis.speak(utterance);
      } catch {
        finish(false);
      }
    });
  }

  async function playSentenceNow(item, button, options = {}) {
    const speed = options.speed === 'slow' ? 'slow' : 'normal';
    const requestId = beginRequest();
    setSpeechButtonBusy(button, true);
    emit('start', { button, items: [item], speed, repeat: 1 });

    try {
      const cached = prefetchedSentences.get(item.text);
      if (cached && cached.readyState >= 2 && !cached.error) {
        await playReadyAudio(cached, requestId, speed);
      } else {
        await speakBrowserNow(item, requestId, speed);
      }
      if (requestId !== speechRequest) return false;
      emit('complete', { button, items: [item], speed, repeat: 1 });
      return true;
    } catch {
      if (requestId !== speechRequest) return false;
      // Last resort: reuse the older online/phonetic chain.
      const ok = await baseSpeakPractice([item], button, options);
      return Boolean(ok);
    } finally {
      setSpeechButtonBusy(button, false);
    }
  }

  window.speakPractice = function speakPracticeGestureFirst(items, button = null, options = {}) {
    const normalized = normalizeItems(items);
    if (normalized.length === 1 && !isHeadword(normalized[0].text)) {
      primeSentence(normalized[0].text);
      return playSentenceNow(normalized[0], button, options);
    }
    return baseSpeakPractice(items, button, options);
  };

  speak = function speakWithSentencePriority(text, button = null, phoneticHint = '') {
    if (!isHeadword(text)) {
      return window.speakPractice([{ text, phoneticHint }], button);
    }
    return baseSpeak(text, button, phoneticHint);
  };

  function primeVisibleSentences() {
    ['todayExampleFa', 'reviewExampleFa', 'scriptExampleFa'].forEach(id => primeSentence(document.getElementById(id)?.textContent));
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', () => window.speechSynthesis.getVoices(), { once: true });
  }

  const observer = new MutationObserver(primeVisibleSentences);
  ['todayExampleFa', 'reviewExampleFa', 'scriptExampleFa'].forEach(id => {
    const element = document.getElementById(id);
    if (element) observer.observe(element, { childList: true, characterData: true, subtree: true });
  });
  window.setTimeout(primeVisibleSentences, 50);
})();
