// Reliable pronunciation for headwords, sentences, repeats, and slow practice.
(() => {
  function phoneticEnglish(text) {
    return String(text || '')
      .toLowerCase()
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

  function chooseEnglishVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find(voice => /^en-US$/i.test(voice.lang))
      || voices.find(voice => /^en(?:-|_|$)/i.test(voice.lang))
      || voices[0]
      || null;
  }

  function wait(ms, requestId) {
    return new Promise(resolve => {
      window.setTimeout(() => resolve(requestId === speechRequest), ms);
    });
  }

  function playAudioElement(audio, requestId) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        window.clearInterval(cancelCheck);
        if (activeAudio === audio) activeAudio = null;
      };
      const finish = (ok, error = null) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (ok) resolve(true);
        else reject(error || new Error('Audio failed'));
      };
      const onEnded = () => finish(true);
      const onError = () => finish(false, new Error('Audio source failed'));
      const cancelCheck = window.setInterval(() => {
        if (requestId !== speechRequest) {
          audio.pause();
          finish(true);
        }
      }, 100);

      audio.addEventListener('ended', onEnded, { once: true });
      audio.addEventListener('error', onError, { once: true });
      activeAudio = audio;
      const result = audio.play();
      if (result && typeof result.catch === 'function') result.catch(onError);
    });
  }

  function speakWithBrowser(text, phoneticHint, requestId, speed) {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window) || requestId !== speechRequest) {
        reject(new Error('Speech synthesis unavailable'));
        return;
      }

      const persianVoice = typeof findPersianVoice === 'function' ? findPersianVoice() : null;
      const usePersian = Boolean(persianVoice);
      const spokenText = usePersian ? text : phoneticEnglish(phoneticHint);
      if (!spokenText) {
        reject(new Error('No phonetic fallback'));
        return;
      }

      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(spokenText);
      const voice = usePersian ? persianVoice : chooseEnglishVoice();
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.clearInterval(cancelCheck);
        activeUtterance = null;
        if (ok) resolve(true);
        else reject(new Error('Browser speech failed'));
      };
      const cancelCheck = window.setInterval(() => {
        if (requestId !== speechRequest) {
          synthesis.cancel();
          finish(true);
        }
      }, 100);

      if (voice) utterance.voice = voice;
      utterance.lang = usePersian ? (voice?.lang || 'fa-IR') : (voice?.lang || 'en-US');
      utterance.rate = speed === 'slow'
        ? (usePersian ? .56 : .53)
        : (usePersian ? .78 : .70);
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      activeUtterance = utterance;
      synthesis.cancel();
      synthesis.resume();
      synthesis.speak(utterance);
    });
  }

  async function playStreamedPersian(item, requestId, speed) {
    if (requestId !== speechRequest) return true;
    const encoded = encodeURIComponent(item.text);
    const ttsSpeed = speed === 'slow' ? '0.5' : '0.8';
    const urls = [
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fa&ttsspeed=${ttsSpeed}&q=${encoded}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=fa&ttsspeed=${ttsSpeed}&q=${encoded}`
    ];

    for (const url of urls) {
      if (requestId !== speechRequest) return true;
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.playsInline = true;
      audio.volume = 1;
      try {
        await playAudioElement(audio, requestId);
        return true;
      } catch {
        // Try the next source.
      }
    }

    return speakWithBrowser(item.text, item.phoneticHint, requestId, speed);
  }

  async function playOne(item, requestId, speed) {
    if (requestId !== speechRequest) return true;
    const wordIndex = Array.isArray(WORDS)
      ? WORDS.findIndex(word => word.fa === item.text)
      : -1;

    if (wordIndex >= 0) {
      const filename = String(wordIndex).padStart(3, '0');
      const audio = new Audio(`audio/${filename}.mp3?v=7`);
      audio.preload = 'auto';
      audio.playsInline = true;
      audio.volume = 1;
      audio.playbackRate = speed === 'slow' ? .72 : 1;
      try {
        await playAudioElement(audio, requestId);
        return true;
      } catch {
        // Fall through to streamed speech.
      }
    }

    return playStreamedPersian(item, requestId, speed);
  }

  window.speakPractice = async function speakPractice(items, button = null, options = {}) {
    const normalized = (Array.isArray(items) ? items : [items])
      .map(item => typeof item === 'string'
        ? { text: item, phoneticHint: '' }
        : { text: item?.text || '', phoneticHint: item?.phoneticHint || '' })
      .filter(item => item.text);

    if (!normalized.length) return false;

    stopSpeech();
    const requestId = speechRequest;
    const speed = options.speed === 'slow' ? 'slow' : 'normal';
    const repeat = Math.max(1, Math.min(5, Number(options.repeat || 1)));
    const pauseMs = Math.max(200, Math.min(2000, Number(options.pauseMs || 650)));
    setSpeechButtonBusy(button, true);

    try {
      for (let itemIndex = 0; itemIndex < normalized.length; itemIndex += 1) {
        const item = normalized[itemIndex];
        for (let repetition = 0; repetition < repeat; repetition += 1) {
          if (requestId !== speechRequest) return false;
          await playOne(item, requestId, speed);
          const hasMore = repetition < repeat - 1 || itemIndex < normalized.length - 1;
          if (hasMore) {
            const stillActive = await wait(pauseMs, requestId);
            if (!stillActive) return false;
          }
        }
      }
      return true;
    } catch {
      if (requestId === speechRequest) {
        toast('Pronunciation could not play. Check that this tab is not muted.');
      }
      return false;
    } finally {
      setSpeechButtonBusy(button, false);
    }
  };

  speak = function speakReliable(text, button = null, phoneticHint = '') {
    return window.speakPractice([{ text, phoneticHint }], button);
  };
})();
