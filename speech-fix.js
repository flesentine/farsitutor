// Reliable pronunciation layer: plays bundled MP3 files generated for every word.
// This script loads after app.js and replaces the browser/network-dependent speaker.
(() => {
  const browserSpeechFallback = typeof speakWithBrowserVoice === 'function'
    ? speakWithBrowserVoice
    : null;

  speak = function speakBundledAudio(text, button = null) {
    stopSpeech();
    const requestId = speechRequest;
    setSpeechButtonBusy(button, true);

    const wordIndex = Array.isArray(WORDS)
      ? WORDS.findIndex(word => word.fa === text)
      : -1;

    const fallback = () => {
      if (requestId !== speechRequest) return;
      if (browserSpeechFallback) {
        browserSpeechFallback(text, requestId, button);
      } else {
        setSpeechButtonBusy(button, false);
        toast('Pronunciation audio could not play. Make sure this tab is not muted.');
      }
    };

    if (wordIndex < 0) {
      fallback();
      return;
    }

    const filename = String(wordIndex).padStart(3, '0');
    const audio = new Audio(`audio/${filename}.mp3?v=1`);
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
    }, 4000);
  };
})();
