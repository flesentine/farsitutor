function clearLearningData() {
  const keys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('farsi-')) keys.push(key);
  }
  keys.forEach(key => localStorage.removeItem(key));
  window.location.reload();
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
  $('againBtn').addEventListener('click', () => rateCard('bad'));
  $('goodBtn').addEventListener('click', () => rateCard('good'));
  $('restartReviewBtn').addEventListener('click', () => buildReviewQueue(true));
  $('reviewAnyBtn').addEventListener('click', () => buildReviewQueue(true));
  $('scriptBackBtn')?.addEventListener('click', () => showView('today'));
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

  $('deckList').addEventListener('click', event => {
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
      if (word && confirm(`Remove “${word.fa}” from your flashcards?`)) {
        delete state.cards[index];
        saveState();
        sanitizeReviewQueue();
        renderAll();
        if ($('reviewView').classList.contains('active')) renderReviewCard();
      }
    }
  });

  $('resetBtn').addEventListener('click', () => {
    if (confirm('Reset all saved words, lesson progress, script progress, and review history?')) {
      clearLearningData();
    }
  });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $('installBtn').classList.remove('hidden');
  });
  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('installBtn').classList.add('hidden');
  });
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
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
