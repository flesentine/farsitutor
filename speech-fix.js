// Reliable pronunciation layer.
// 1. Play a bundled Persian MP3 when available.
// 2. Otherwise speak the word's phonetic transliteration with an installed English voice.
(() => {
  function phoneticEnglish(text) {
    return text
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
      if (!AudioContextClass) throw new Error('Web Audio is unavailable');
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 523.25;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.24);
      oscillator.addEventListener('ended', () => context.close());
      toast('Speech was blocked. If you heard the tone, reload once and try again. Also check that this tab is not muted.');
    } catch {
      toast('Audio is blocked. Check the tab mute icon and your Mac sound output, then reload once.');
    }
  }

  function speakTransliteration(word, requestId, button) {
    if (!('speechSynthesis' in window) || requestId !== speechRequest) {
      playDiagnosticTone(requestId, button);
      return;
    }

    const synthesis = window.speechSynthesis;
    const spokenText = phoneticEnglish(word?.latin || word?.fa || '');
    const utterance = new SpeechSynthesisUtterance(spokenText);
    const voice = chooseEnglishVoice();
    let started = false;
    let finished = false;

    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-US';
    utterance.rate = 0.72;
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

    window.setTimeout(() => {
      if (requestId !== speechRequest || started || finished) return;
      synthesis.cancel();
      playDiagnosticTone(requestId, button);
    }, 2800);
  }

  speak = function speakReliableAudio(text, button = null) {
    stopSpeech();
    const requestId = speechRequest;
    setSpeechButtonBusy(button, true);

    const wordIndex = Array.isArray(WORDS)
      ? WORDS.findIndex(word => word.fa === text)
      : -1;
    const word = wordIndex >= 0 ? WORDS[wordIndex] : { fa: text, latin: text };

    const fallback = () => {
      if (requestId !== speechRequest) return;
      speakTransliteration(word, requestId, button);
    };

    if (wordIndex < 0) {
      fallback();
      return;
    }

    const filename = String(wordIndex).padStart(3, '0');
    const audio = new Audio(`audio/${filename}.mp3?v=2`);
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.volume = 1;
    activeAudio = audio;

    let started = false;
    let failed = false;

    const failOnce = () => {
      if (failed || started || requestId !== speechRequest) return;
      failed = true;
      if (activeAudio === audio) activeAudio = null;
      audio.pause();
      fallback();
    };

    audio.addEventListener('playing', () => {
      if (requestId !== speechRequest) return;
      started = true;
      setSpeechButtonBusy(button, false);
    }, { once: true });

    audio.addEventListener('ended', () => {
      if (requestId !== speechRequest) return;
      setSpeechButtonBusy(button, false);
      if (activeAudio === audio) activeAudio = null;
    }, { once: true });

    audio.addEventListener('error', failOnce, { once: true });
    audio.play().catch(failOnce);

    window.setTimeout(() => {
      if (!started) failOnce();
    }, 1200);
  };
})();
