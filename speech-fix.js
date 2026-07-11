// Reliable pronunciation for headwords, sentences, repeats, and slow practice.
(() => {
  const nativeStartTimeoutMs = 2200;
  const remoteStartTimeoutMs = 5200;

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

  function emitSpeechEvent(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`farsi:speech-${name}`, { detail }));
  }

  const baseSetSpeechButtonBusy = setSpeechButtonBusy;
  setSpeechButtonBusy = function setSpeechButtonBusyWithFeedback(button, busy) {
    if (button) {
      if (busy && !button.dataset.speechOriginalHtml) {
        button.dataset.speechOriginalHtml = button.innerHTML;
        button.classList.add('speech-playing');
        button.innerHTML = '<span class="speech-spinner" aria-hidden="true"></span><span>Playing…</span>';
      } else if (!busy && button.dataset.speechOriginalHtml) {
        button.innerHTML = button.dataset.speechOriginalHtml;
        delete button.dataset.speechOriginalHtml;
        button.classList.remove('speech-playing');
      }
    }
    baseSetSpeechButtonBusy(button, busy);
  };

  function playAudioElement(audio, requestId, startTimeoutMs = remoteStartTimeoutMs) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let started = false;
      let startTimer;
      let maxTimer;

      const cleanup = () => {
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        audio.removeEventListener('abort', onError);
        window.clearTimeout(startTimer);
        window.clearTimeout(maxTimer);
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

      const onPlaying = () => {
        started = true;
        window.clearTimeout(startTimer);
        maxTimer = window.setTimeout(() => {
          audio.pause();
          finish(false, new Error('Audio playback timed out'));
        }, 45000);
      };
      const onEnded = () => finish(true);
      const onError = () => finish(false, new Error('Audio source failed'));
      const cancelCheck = window.setInterval(() => {
        if (requestId !== speechRequest) {
          audio.pause();
          finish(true);
        }
      }, 100);

      audio.addEventListener('playing', onPlaying, { once: true });
      audio.addEventListener('ended', onEnded, { once: true });
      audio.addEventListener('error', onError, { once: true });
      audio.addEventListener('abort', onError, { once: true });
      activeAudio = audio;
      startTimer = window.setTimeout(() => {
        if (!started) {
          audio.pause();
          finish(false, new Error('Audio did not start'));
        }
      }, startTimeoutMs);

      try {
        const result = audio.play();
        if (result && typeof result.catch === 'function') result.catch(onError);
      } catch (error) {
        finish(false, error);
      }
    });
  }

  function speakWithBrowser(item, requestId, speed, mode = 'persian') {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window) || requestId !== speechRequest) {
        reject(new Error('Speech synthesis unavailable'));
        return;
      }

      const synthesis = window.speechSynthesis;
      const persianVoice = typeof findPersianVoice === 'function' ? findPersianVoice() : null;
      const usePhonetic = mode === 'phonetic';
      const spokenText = usePhonetic ? phoneticEnglish(item.phoneticHint) : item.text;
      if (!spokenText) {
        reject(new Error('No speech text'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(spokenText);
      const voice = usePhonetic ? chooseEnglishVoice() : persianVoice;
      let settled = false;
      let started = false;
      let startTimer;
      let maxTimer;

      const cleanup = () => {
        window.clearTimeout(startTimer);
        window.clearTimeout(maxTimer);
        window.clearInterval(cancelCheck);
        activeUtterance = null;
      };
      const finish = ok => {
        if (settled) return;
        settled = true;
        cleanup();
        if (ok) resolve(true);
        else reject(new Error('Browser speech failed'));
      };
      const markStarted = () => {
        if (started) return;
        started = true;
        window.clearTimeout(startTimer);
        const estimatedMs = Math.max(7000, spokenText.length * (speed === 'slow' ? 430 : 300));
        maxTimer = window.setTimeout(() => {
          synthesis.cancel();
          finish(false);
        }, Math.min(30000, estimatedMs));
      };
      const cancelCheck = window.setInterval(() => {
        if (requestId !== speechRequest) {
          synthesis.cancel();
          finish(true);
        }
      }, 100);

      if (voice) utterance.voice = voice;
      utterance.lang = usePhonetic ? (voice?.lang || 'en-US') : (voice?.lang || 'fa-IR');
      utterance.rate = speed === 'slow'
        ? (usePhonetic ? .55 : .60)
        : (usePhonetic ? .72 : .82);
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onstart = markStarted;
      utterance.onboundary = markStarted;
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      activeUtterance = utterance;

      synthesis.cancel();
      synthesis.resume();
      startTimer = window.setTimeout(() => {
        if (!started) {
          synthesis.cancel();
          finish(false);
        }
      }, nativeStartTimeoutMs);

      try {
        synthesis.speak(utterance);
      } catch {
        finish(false);
      }
    });
  }

  function splitTtsText(text, maxLength = 170) {
    const value = String(text || '').trim();
    if (value.length <= maxLength) return [value];
    const clauses = value.split(/(?<=[.?!؟،؛])\s*/).filter(Boolean);
    const chunks = [];
    let current = '';
    clauses.forEach(clause => {
      if (!current) current = clause;
      else if (`${current} ${clause}`.length <= maxLength) current += ` ${clause}`;
      else {
        chunks.push(current);
        current = clause;
      }
    });
    if (current) chunks.push(current);
    return chunks.length ? chunks : [value.slice(0, maxLength)];
  }

  async function playRemotePersian(item, requestId, speed) {
    const chunks = splitTtsText(item.text);
    for (const chunk of chunks) {
      const encoded = encodeURIComponent(chunk);
      const ttsSpeed = speed === 'slow' ? '0.24' : '1';
      const urls = [
        `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fa&ttsspeed=${ttsSpeed}&q=${encoded}`,
        `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=fa&ttsspeed=${ttsSpeed}&q=${encoded}`
      ];
      let played = false;
      for (const url of urls) {
        if (requestId !== speechRequest) return true;
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.playsInline = true;
        audio.volume = 1;
        try {
          await playAudioElement(audio, requestId);
          played = true;
          break;
        } catch {
          // Try the next source.
        }
      }
      if (!played) throw new Error('Remote Persian speech failed');
      if (chunks.length > 1) await wait(180, requestId);
    }
    return true;
  }

  async function playFallback(item, requestId, speed) {
    const hasPersianVoice = Boolean(typeof findPersianVoice === 'function' && findPersianVoice());

    if (hasPersianVoice) {
      try {
        return await speakWithBrowser(item, requestId, speed, 'persian');
      } catch {
        // Continue to streamed speech.
      }
    }

    try {
      return await playRemotePersian(item, requestId, speed);
    } catch {
      // Some browsers can still select a Persian voice when lang is set even if it is not listed.
    }

    try {
      return await speakWithBrowser(item, requestId, speed, 'persian');
    } catch {
      return speakWithBrowser(item, requestId, speed, 'phonetic');
    }
  }

  async function playOne(item, requestId, speed) {
    if (requestId !== speechRequest) return true;
    const wordIndex = Array.isArray(WORDS)
      ? WORDS.findIndex(word => word.fa === item.text)
      : -1;

    if (wordIndex >= 0) {
      const filename = String(wordIndex).padStart(3, '0');
      const audio = new Audio(`audio/${filename}.mp3?v=8`);
      audio.preload = 'auto';
      audio.playsInline = true;
      audio.volume = 1;
      audio.playbackRate = speed === 'slow' ? .72 : 1;
      try {
        await playAudioElement(audio, requestId, 2800);
        return true;
      } catch {
        // Fall through to live speech.
      }
    }

    return playFallback(item, requestId, speed);
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
    emitSpeechEvent('start', { button, items: normalized, speed, repeat });

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
      if (requestId !== speechRequest) return false;
      emitSpeechEvent('complete', { button, items: normalized, speed, repeat });
      return true;
    } catch (error) {
      if (requestId === speechRequest) {
        emitSpeechEvent('error', { button, items: normalized, speed, repeat, error });
        toast('Audio could not start. Check media volume, then try Slow sentence.');
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
