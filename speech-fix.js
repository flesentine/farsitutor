// Reliable pronunciation using bundled curriculum audio and a genuine Persian device voice.
(() => {
  const deviceStartTimeoutMs = 2200;

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

  function playAudioElement(audio, requestId, startTimeoutMs = 2800) {
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

  function listedPersianVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find(voice => /^fa(?:-|_|$)/i.test(voice.lang))
      || voices.find(voice => /persian|farsi|iran/i.test(`${voice.name} ${voice.lang}`))
      || null;
  }

  function speakWithPersianVoice(item, requestId, speed) {
    return new Promise((resolve, reject) => {
      const voice = listedPersianVoice();
      if (!voice || !item?.text || requestId !== speechRequest || typeof SpeechSynthesisUtterance === 'undefined') {
        reject(new Error('A genuine Persian system voice is unavailable'));
        return;
      }

      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(item.text);
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
        else reject(new Error('Persian system speech failed'));
      };
      const markStarted = () => {
        if (started) return;
        started = true;
        window.clearTimeout(startTimer);
        const estimatedMs = Math.max(7000, item.text.length * (speed === 'slow' ? 430 : 300));
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

      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = speed === 'slow' ? 0.60 : 0.82;
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
      }, deviceStartTimeoutMs);

      try {
        synthesis.speak(utterance);
      } catch {
        finish(false);
      }
    });
  }

  async function playOne(item, requestId, speed) {
    if (requestId !== speechRequest) return true;
    const wordIndex = Array.isArray(WORDS)
      ? WORDS.findIndex(word => word.fa === item.text)
      : -1;

    if (wordIndex >= 0) {
      const filename = String(wordIndex).padStart(3, '0');
      const audio = new Audio(`audio/${filename}.mp3?v=10`);
      audio.preload = 'auto';
      audio.playsInline = true;
      audio.volume = 1;
      audio.playbackRate = speed === 'slow' ? 0.72 : 1;
      try {
        await playAudioElement(audio, requestId);
        return true;
      } catch {
        // A real Persian system voice is the only fallback for a damaged local file.
      }
    }

    return speakWithPersianVoice(item, requestId, speed);
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
        toast('Pronunciation is unavailable on this device. Check media volume and try again.');
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
