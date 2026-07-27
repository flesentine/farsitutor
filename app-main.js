const platformRuntime = window.FarsiPlatform || {
  isNative: false,
  isWeb: true,
  capabilities: {
    installPrompt: true,
    serviceWorker: 'serviceWorker' in navigator
  }
};

function clearLearningData() {
  window.FarsiStorage.clearLearningData();
  window.location.reload();
}

async function askConfirmation(options) {
  return Boolean(await window.FarsiConfirm?.ask?.(options));
}

function bindEvents() {
  bindVerbPanel('todayVerbPanel');
  bindVerbPanel('reviewVerbPanel');

  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.view)));
  document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach(filter => filter.classList.toggle('active', filter === button));
    renderDeck();
  }));

  $('speakTodayBtn').addEventListener('click', event => speak(getWord(todaysWordIndex()).fa, event.currentTarget));
  $('addTodayBtn').addEventListener('click', () => addWord(todaysWordIndex()));
  $('practiceTodayBtn').addEventListener('click', () => {
    const index = todaysWordIndex();
    addWord(index, true);
    showView('review');
    buildReviewQueue(false, index);
  });
  $('revealBtn').addEventListener('click', () => {
    $('reviewAnswer').classList.remove('hidden');
    $('revealBtn').classList.add('hidden');
  });
  $('speakReviewBtn').addEventListener('click', event => {
    if (!sanitizeReviewQueue()) return;
    const word = getWord(reviewQueue[reviewIndex]);
    if (word) speak(word.fa, event.currentTarget);
  });
  $('speakReviewAnswerBtn').addEventListener('click', event => {
    if (!sanitizeReviewQueue()) return;
    const word = getWord(reviewQueue[reviewIndex]);
    if (word) speak(word.fa, event.currentTarget);
  });
  $('againBtn').addEventListener('click', () => rateCard('bad'));
  $('goodBtn').addEventListener('click', () => rateCard('good'));
  $('restartReviewBtn').addEventListener('click', () => buildReviewQueue(true));
  $('reviewAnyBtn').addEventListener('click', () => buildReviewQueue(true));
  $('searchInput').addEventListener('input', renderDeck);
  $('reviewCard').addEventListener('keydown', event => {
    if (event.code === 'Space' && !$('revealBtn').classList.contains('hidden')) {
      event.preventDefault();
      $('revealBtn').click();
    } else if (!$('reviewAnswer').classList.contains('hidden') && event.key === '1') {
      $('againBtn').click();
    } else if (!$('reviewAnswer').classList.contains('hidden') && event.key === '2') {
      $('goodBtn').click();
    }
  });

  $('deckList').addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.speak !== undefined) speak(getWord(Number(button.dataset.speak)).fa, button);
    if (button.dataset.review !== undefined) {
      showView('review');
      buildReviewQueue(false, Number(button.dataset.review));
    }
    if (button.dataset.remove !== undefined) {
      const index = Number(button.dataset.remove);
      const word = getWord(index);
      if (!word) return;
      const confirmed = await askConfirmation({
        title: 'Remove saved word?',
        message: `“${word.fa}” will be removed from My Words and its review history will be deleted.`,
        confirmLabel: 'Remove word'
      });
      if (!confirmed) return;
      delete state.cards[index];
      saveState();
      sanitizeReviewQueue();
      renderAll();
      if ($('reviewView').classList.contains('active')) renderReviewCard();
    }
  });

  $('resetBtn').addEventListener('click', async () => {
    const confirmed = await askConfirmation({
      title: 'Reset all learning progress?',
      message: 'This permanently removes saved words, lessons, letter practice, review history, streaks, and settings from this device.',
      confirmLabel: 'Reset progress'
    });
    if (confirmed) clearLearningData();
  });

  const installButton = $('installBtn');
  if (platformRuntime.capabilities.installPrompt) {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      installButton?.classList.remove('hidden');
    });
    installButton?.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installButton.classList.add('hidden');
    });
  } else {
    installButton?.classList.add('hidden');
    installButton?.setAttribute('aria-hidden', 'true');
  }
}

if ('speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSpeech();
});
ensureTodayLogged();
bindEvents();
renderAll();
if (platformRuntime.capabilities.serviceWorker && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
