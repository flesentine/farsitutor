// Pronunciation layer for headwords, sentences, and conjugated forms.
// Bundled MP3 -> streamed Persian TTS -> installed Persian voice -> phonetic English fallback.
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
      .replace(/[?!.,]/g, ' ')
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

  function playDiagnosticTone(requestId, button) {
    if (requestId !== speechRequest) return;
    setSpeechButtonBusy(button, false);
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('No AudioContext');
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 523.25;
      gain.gain.setValueAtTime(.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.12, context.currentTime + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .24);
      oscillator.addEventListener('ended', () => context.close());
      toast('Speech was blocked. Check that this tab is not muted.');
    } catch {
      toast('Audio is blocked. Check the tab mute icon and your sound output.');
    }
  }

  function speakPhonetic(word, requestId, button) {
    if (!('speechSynthesis' in window) || requestId !== speechRequest) {
      playDiagnosticTone(requestId, button);
      return;
    }
    const text = phoneticEnglish(word?.latin || '');
    if (!text) {
      playDiagnosticTone(requestId, button);
      return;
    }
    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = chooseEnglishVoice();
    let started = false;
    let finished = false;
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-US';
    utterance.rate = .72;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => {
      if (requestId !== speechRequest) return;
      started = true;
      setSpeechButtonBusy(button, false);
    };
    utterance.onend = () => {
      if (requestId !== speechRequest) return;
      finished = true;
      activeUtterance = null;
      setSpeechButtonBusy(button, false);
    };
    utterance.onerror = () => {
      if (requestId !== speechRequest || finished) return;
      finished = true;
      activeUtterance = null;
      playDiagnosticTone(requestId, button);
    };
    activeUtterance = utterance;
    synthesis.cancel();
    synthesis.resume();
    synthesis.speak(utterance);
    setTimeout(() => {
      if (requestId !== speechRequest || started || finished) return;
      synthesis.cancel();
      playDiagnosticTone(requestId, button);
    }, 2800);
  }

  function speakWithPersianFallback(text, word, requestId, button) {
    if (requestId !== speechRequest) return;
    const voice = typeof findPersianVoice === 'function' ? findPersianVoice() : null;
    if (voice && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang || 'fa-IR';
      utterance.rate = .78;
      utterance.volume = 1;
      utterance.onstart = () => setSpeechButtonBusy(button, false);
      utterance.onend = () => {
        activeUtterance = null;
        setSpeechButtonBusy(button, false);
      };
      utterance.onerror = () => speakPhonetic(word, requestId, button);
      activeUtterance = utterance;
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
      return;
    }
    speakPhonetic(word, requestId, button);
  }

  function playStreamedPersian(text, word, requestId, button) {
    if (requestId !== speechRequest) return;
    const encoded = encodeURIComponent(text);
    const audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.volume = 1;
    [
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fa&ttsspeed=0.8&q=${encoded}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=fa&ttsspeed=0.8&q=${encoded}`
    ].forEach(url => {
      const source = document.createElement('source');
      source.src = url;
      source.type = 'audio/mpeg';
      audio.appendChild(source);
    });
    activeAudio = audio;
    let started = false;
    let failed = false;
    const fail = () => {
      if (failed || started || requestId !== speechRequest) return;
      failed = true;
      if (activeAudio === audio) activeAudio = null;
      audio.pause();
      speakWithPersianFallback(text, word, requestId, button);
    };
    audio.addEventListener('playing', () => {
      if (requestId !== speechRequest) return;
      started = true;
      setSpeechButtonBusy(button, false);
    }, { once: true });
    audio.addEventListener('ended', () => {
      if (requestId !== speechRequest) return;
      if (activeAudio === audio) activeAudio = null;
      setSpeechButtonBusy(button, false);
    }, { once: true });
    audio.addEventListener('error', fail, { once: true });
    audio.play().catch(fail);
    setTimeout(fail, 3000);
  }

  speak = function speakReliable(text, button = null, phoneticHint = '') {
    stopSpeech();
    const requestId = speechRequest;
    setSpeechButtonBusy(button, true);
    const wordIndex = Array.isArray(WORDS) ? WORDS.findIndex(word => word.fa === text) : -1;
    const word = wordIndex >= 0 ? WORDS[wordIndex] : { fa: text, latin: phoneticHint };

    if (wordIndex < 0) {
      playStreamedPersian(text, word, requestId, button);
      return;
    }

    const filename = String(wordIndex).padStart(3, '0');
    const audio = new Audio(`audio/${filename}.mp3?v=6`);
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.volume = 1;
    activeAudio = audio;
    let started = false;
    let failed = false;
    const fail = () => {
      if (failed || started || requestId !== speechRequest) return;
      failed = true;
      if (activeAudio === audio) activeAudio = null;
      audio.pause();
      playStreamedPersian(text, word, requestId, button);
    };
    audio.addEventListener('playing', () => {
      if (requestId !== speechRequest) return;
      started = true;
      setSpeechButtonBusy(button, false);
    }, { once: true });
    audio.addEventListener('ended', () => {
      if (requestId !== speechRequest) return;
      if (activeAudio === audio) activeAudio = null;
      setSpeechButtonBusy(button, false);
    }, { once: true });
    audio.addEventListener('error', fail, { once: true });
    audio.play().catch(fail);
    setTimeout(fail, 1200);
  };
})();
