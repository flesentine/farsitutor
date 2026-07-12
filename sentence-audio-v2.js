// Direct sentence audio plus guided-letter quiz answer guard.
(() => {
  const previousSpeakPractice = window.speakPractice;
  const previousSpeak = window.speak;
  const cachedAudio = new Map();
  let currentAudio = null;
  let directRequest = 0;

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

  function sourceUrls(text, speed) {
    const encoded = encodeURIComponent(text);
    const ttsSpeed = speed === 'slow' ? '0.24' : '1';
    return [
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fa&ttsspeed=${ttsSpeed}&q=${encoded}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=fa&ttsspeed=${ttsSpeed}&q=${encoded}`
    ];
  }

  function audioKey(text, speed) {
    return `${speed}:${text}`;
  }

  function discardAudio(key, audio) {
    if (cachedAudio.get(key) === audio) cachedAudio.delete(key);
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.querySelectorAll('source').forEach(source => source.remove());
      audio.load();
      audio.remove();
    } catch {}
  }

  function createSentenceAudio(text, speed = 'normal') {
    const key = audioKey(text, speed);
    const existing = cachedAudio.get(key);
    if (existing) return existing;

    const audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.style.display = 'none';
    audio.dataset.farsiSentenceAudio = key;

    sourceUrls(text, speed).forEach(url => {
      const source = document.createElement('source');
      source.src = url;
      source.type = 'audio/mpeg';
      audio.appendChild(source);
    });

    audio.addEventListener('error', () => discardAudio(key, audio), { once: true });
    document.body.appendChild(audio);
    cachedAudio.set(key, audio);
    try { audio.load(); } catch { discardAudio(key, audio); }
    return audio;
  }

  function stopDirectAudio() {
    directRequest += 1;
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch {}
      currentAudio = null;
    }
  }

  function playSentenceAudio(item, speed) {
    const requestId = ++directRequest;
    const key = audioKey(item.text, speed);
    const audio = createSentenceAudio(item.text, speed);

    return new Promise((resolve, reject) => {
      let settled = false;
      let started = false;
      let startTimer;
      let maxTimer;

      const cleanup = () => {
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        window.clearTimeout(startTimer);
        window.clearTimeout(maxTimer);
        window.clearInterval(cancelCheck);
        if (currentAudio === audio) currentAudio = null;
      };

      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (ok) resolve(true);
        else {
          discardAudio(key, audio);
          reject(error || new Error('Sentence audio failed'));
        }
      };

      const onPlaying = () => {
        started = true;
        window.clearTimeout(startTimer);
        const estimated = Math.max(9000, item.text.length * (speed === 'slow' ? 420 : 280));
        maxTimer = window.setTimeout(() => {
          try { audio.pause(); } catch {}
          finish(false, new Error('Sentence audio timed out'));
        }, Math.min(45000, estimated));
      };
      const onEnded = () => finish(true);
      const onError = () => finish(false, new Error('Sentence audio source failed'));
      const cancelCheck = window.setInterval(() => {
        if (requestId !== directRequest) finish(false, new Error('Sentence audio cancelled'));
      }, 100);

      audio.addEventListener('playing', onPlaying, { once: true });
      audio.addEventListener('ended', onEnded, { once: true });
      audio.addEventListener('error', onError, { once: true });
      currentAudio = audio;

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

  function findStrictPersianVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find(voice => /^fa(?:-|_|$)/i.test(voice.lang))
      || voices.find(voice => /persian|farsi|iran/i.test(`${voice.name} ${voice.lang}`))
      || null;
  }

  function speakWithPersianVoice(item, speed) {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis unavailable'));
        return;
      }
      const voice = findStrictPersianVoice();
      if (!voice) {
        reject(new Error('No Persian voice installed'));
        return;
      }

      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(item.text);
      let started = false;
      let settled = false;
      let startTimer;
      let maxTimer;

      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(startTimer);
        window.clearTimeout(maxTimer);
        ok ? resolve(true) : reject(new Error('Persian device voice failed'));
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
      utterance.volume = 1;
      utterance.pitch = 1;
      utterance.onstart = onStart;
      utterance.onboundary = onStart;
      utterance.onend = () => finish(started);
      utterance.onerror = () => finish(false);

      synthesis.cancel();
      synthesis.resume();
      startTimer = window.setTimeout(() => {
        if (!started) {
          synthesis.cancel();
          finish(false);
        }
      }, 4000);

      try { synthesis.speak(utterance); } catch { finish(false); }
    });
  }

  async function playSentence(item, speed) {
    stopDirectAudio();
    try {
      return await playSentenceAudio(item, speed);
    } catch {
      return speakWithPersianVoice(item, speed);
    }
  }

  window.speakPractice = async function speakPracticeDirect(items, button = null, options = {}) {
    const normalized = normalizeItems(items);
    if (!normalized.length) return false;
    const containsSentence = normalized.some(item => !isHeadword(item.text));
    if (!containsSentence) return previousSpeakPractice(items, button, options);

    const speed = options.speed === 'slow' ? 'slow' : 'normal';
    const repeat = Math.max(1, Math.min(5, Number(options.repeat || 1)));
    const pauseMs = Math.max(200, Math.min(2000, Number(options.pauseMs || 650)));
    setSpeechButtonBusy(button, true);
    emit('start', { button, items: normalized, speed, repeat });

    try {
      for (let itemIndex = 0; itemIndex < normalized.length; itemIndex += 1) {
        const item = normalized[itemIndex];
        for (let repetition = 0; repetition < repeat; repetition += 1) {
          const ok = isHeadword(item.text)
            ? await previousSpeakPractice([item], null, { speed })
            : await playSentence(item, speed);
          if (!ok) throw new Error('Audio failed');
          const hasMore = repetition < repeat - 1 || itemIndex < normalized.length - 1;
          if (hasMore) await new Promise(resolve => window.setTimeout(resolve, pauseMs));
        }
      }
      emit('complete', { button, items: normalized, speed, repeat });
      return true;
    } catch (error) {
      emit('error', { button, items: normalized, speed, repeat, error });
      toast('Sentence audio could not play. Check media volume and internet connection.');
      return false;
    } finally {
      setSpeechButtonBusy(button, false);
    }
  };

  speak = function speakDirect(text, button = null, phoneticHint = '') {
    if (isHeadword(text)) return previousSpeak(text, button, phoneticHint);
    return window.speakPractice([{ text, phoneticHint }], button);
  };

  function primeVisibleSentences() {
    const values = new Set();
    document.querySelectorAll('.guided-sentence, #todayExampleFa, #reviewExampleFa, #scriptExampleFa').forEach(element => {
      const text = element.textContent?.trim();
      if (text && !isHeadword(text)) values.add(text);
    });
    values.forEach(text => {
      createSentenceAudio(text, 'normal');
      createSentenceAudio(text, 'slow');
    });
  }

  // Never reveal a quiz answer before the learner chooses it.
  const quizStyle = document.createElement('style');
  quizStyle.textContent = `
    .guided-card:has(.guided-letter-choice:not(:disabled)) > .guided-letter,
    .guided-card:has(.guided-letter-choice:not(:disabled)) > h3,
    .guided-card.letter-question-unanswered > .guided-letter,
    .guided-card.letter-question-unanswered > h3 { display:none !important; }
  `;
  document.head.appendChild(quizStyle);

  function guardLetterQuestions() {
    document.querySelectorAll('.guided-card').forEach(card => {
      const choices = [...card.querySelectorAll('.guided-letter-choice')];
      if (!choices.length) return;
      card.classList.toggle('letter-question-unanswered', choices.some(choice => !choice.disabled));
    });
  }

  const observer = new MutationObserver(() => {
    primeVisibleSentences();
    guardLetterQuestions();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setTimeout(() => {
    primeVisibleSentences();
    guardLetterQuestions();
  }, 0);
})();
