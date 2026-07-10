const STORAGE_KEY = 'farsi-daily-v1';
const DAY_MS = 86400000;
let reviewQueue = [];
let reviewIndex = 0;
let currentFilter = 'all';
let deferredInstallPrompt = null;
let activeAudio = null;
let activeUtterance = null;
let speechRequest = 0;
let voiceCache = [];

const $ = (id) => document.getElementById(id);
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const now = () => Date.now();

function defaultState() {
  return { cards: {}, history: {}, totalGood: 0, totalBad: 0, lastOpen: null };
}

function loadState() {
  try {
    return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return defaultState();
  }
}

let state = loadState();

function saveState() {
  state.lastOpen = todayKey();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dayNumber() {
  const start = Date.UTC(2024, 0, 1);
  const date = new Date();
  return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / DAY_MS);
}

function todaysWordIndex() {
  return ((dayNumber() % WORDS.length) + WORDS.length) % WORDS.length;
}

function getWord(index) { return WORDS[index]; }

function addWord(index, silent = false) {
  if (state.cards[index]) return false;
  state.cards[index] = {
    addedAt: now(),
    dueAt: now(),
    intervalDays: 0,
    streak: 0,
    good: 0,
    bad: 0,
    lastResult: null,
    lastReviewedAt: null
  };
  saveState();
  if (!silent) toast('Added to your flashcards');
  renderAll();
  return true;
}

function ensureTodayLogged() {
  const key = todayKey();
  if (!state.history[key]) state.history[key] = { opened: true, reviewed: 0 };
  else state.history[key].opened = true;
  saveState();
}

function formatDate(ts) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(ts));
}

function refreshVoices() {
  if (!('speechSynthesis' in window)) return [];
  voiceCache = window.speechSynthesis.getVoices() || [];
  return voiceCache;
}

function findPersianVoice() {
  const voices = refreshVoices();
  return voices.find(voice => /^fa(?:-|_|$)/i.test(voice.lang))
    || voices.find(voice => /persian|farsi|iran/i.test(`${voice.name} ${voice.lang}`));
}

function stopSpeech() {
  speechRequest += 1;

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.replaceChildren();
    activeAudio.removeAttribute('src');
    activeAudio.load();
    activeAudio = null;
  }

  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  activeUtterance = null;
}

function setSpeechButtonBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

function speakWithBrowserVoice(text, requestId, button) {
  if (!('speechSynthesis' in window) || requestId !== speechRequest) {
    setSpeechButtonBusy(button, false);
    toast('Audio could not play in this browser');
    return;
  }

  const synthesis = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  const persianVoice = findPersianVoice();
  let started = false;

  if (persianVoice) utterance.voice = persianVoice;
  utterance.lang = persianVoice?.lang || 'fa-IR';
  utterance.rate = 0.78;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    if (requestId !== speechRequest) return;
    started = true;
    setSpeechButtonBusy(button, false);
  };

  utterance.onend = () => {
    if (requestId !== speechRequest) return;
    setSpeechButtonBusy(button, false);
    activeUtterance = null;
  };

  utterance.onerror = () => {
    if (requestId !== speechRequest) return;
    setSpeechButtonBusy(button, false);
    activeUtterance = null;
    toast('No Persian voice is available. Check your sound and internet connection.');
  };

  activeUtterance = utterance;
  synthesis.cancel();

  window.setTimeout(() => {
    if (requestId !== speechRequest) return;
    synthesis.resume();
    synthesis.speak(utterance);
  }, 70);

  window.setTimeout(() => {
    if (requestId !== speechRequest || started) return;
    synthesis.cancel();
    setSpeechButtonBusy(button, false);
    toast('No Persian voice is installed. The online pronunciation also failed.');
  }, 3500);
}

function speak(text, button = null) {
  stopSpeech();
  const requestId = speechRequest;
  setSpeechButtonBusy(button, true);

  const encoded = encodeURIComponent(text);
  const audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.playsInline = true;

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
  let fallbackStarted = false;
  let didStart = false;

  const fallback = () => {
    if (fallbackStarted || requestId !== speechRequest) return;
    fallbackStarted = true;
    if (activeAudio === audio) activeAudio = null;
    audio.pause();
    speakWithBrowserVoice(text, requestId, button);
  };

  audio.addEventListener('playing', () => {
    if (requestId !== speechRequest) return;
    didStart = true;
    setSpeechButtonBusy(button, false);
  }, { once: true });

  audio.addEventListener('ended', () => {
    if (requestId !== speechRequest) return;
    setSpeechButtonBusy(button, false);
    if (activeAudio === audio) activeAudio = null;
  }, { once: true });

  audio.addEventListener('error', fallback, { once: true });

  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(fallback);

  window.setTimeout(() => {
    if (!didStart) fallback();
  }, 5000);
}

function renderToday() {
  const index = todaysWordIndex();
  const word = getWord(index);
  $('todayFarsi').textContent = word.fa;
  $('todayLatin').textContent = word.latin;
  $('todayMeaning').textContent = word.en;
  $('wordCategory').textContent = word.category;
  $('wordDay').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  $('todayExampleFa').textContent = word.exFa;
  $('todayExampleLatin').textContent = word.exLatin;
  $('todayExampleEn').textContent = word.exEn;
  const added = Boolean(state.cards[index]);
  $('addTodayBtn').disabled = added;
  $('addTodayBtn').textContent = added ? 'Added to my words' : 'Add to my words';
}

function dueCardIndexes() {
  return Object.keys(state.cards)
    .map(Number)
    .filter(index => state.cards[index].dueAt <= now())
    .sort((a, b) => state.cards[a].dueAt - state.cards[b].dueAt);
}

function statusFor(card) {
  if (card.bad > card.good || card.lastResult === 'bad') return 'missed';
  if (card.streak >= 4 || card.intervalDays >= 14) return 'strong';
  return 'learning';
}

function streakDays() {
  let count = 0;
  let cursor = new Date();
  cursor.setHours(0,0,0,0);
  for (let i = 0; i < 3650; i++) {
    const key = cursor.toISOString().slice(0,10);
    if (state.history[key]) count++;
    else if (i !== 0) break;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return count;
}

function renderStats() {
  const learned = Object.keys(state.cards).length;
  const due = dueCardIndexes().length;
  const attempts = state.totalGood + state.totalBad;
  $('streakStat').textContent = streakDays();
  $('learnedStat').textContent = learned;
  $('dueStat').textContent = due;
  $('accuracyStat').textContent = attempts ? `${Math.round((state.totalGood / attempts) * 100)}%` : '—';
  $('reviewBadge').textContent = due;
}

function renderDeck() {
  const list = $('deckList');
  const query = $('searchInput').value.trim().toLowerCase();
  const entries = Object.keys(state.cards)
    .map(Number)
    .filter(index => {
      const word = getWord(index);
      const card = state.cards[index];
      const matchesSearch = !query || `${word.fa} ${word.latin} ${word.en}`.toLowerCase().includes(query);
      const matchesFilter = currentFilter === 'all' || statusFor(card) === currentFilter;
      return matchesSearch && matchesFilter;
    })
    .sort((a,b) => state.cards[b].addedAt - state.cards[a].addedAt);

  list.innerHTML = '';
  $('deckEmpty').classList.toggle('hidden', entries.length > 0 || Object.keys(state.cards).length > 0);

  entries.forEach(index => {
    const word = getWord(index);
    const card = state.cards[index];
    const status = statusFor(card);
    const dueText = card.dueAt <= now() ? 'Due now' : `Next ${formatDate(card.dueAt)}`;
    const item = document.createElement('article');
    item.className = 'deck-item';
    item.innerHTML = `
      <div class="deck-fa" lang="fa" dir="rtl">${word.fa}</div>
      <div class="deck-main">
        <strong>${word.latin} · ${word.en}</strong>
        <span><i class="status-dot ${status}"></i>${status === 'missed' ? 'Needs work' : status[0].toUpperCase() + status.slice(1)} · ${dueText} · ${card.good} right / ${card.bad} missed</span>
      </div>
      <div class="deck-actions">
        <button type="button" data-speak="${index}" aria-label="Speak ${word.fa}">🔊</button>
        <button type="button" data-review="${index}" aria-label="Review ${word.fa}">↻</button>
        <button type="button" data-remove="${index}" aria-label="Remove ${word.fa}">×</button>
      </div>`;
    list.appendChild(item);
  });
}

function buildReviewQueue(forceAny = false, singleIndex = null) {
  if (singleIndex !== null) reviewQueue = [singleIndex];
  else {
    reviewQueue = dueCardIndexes();
    if (!reviewQueue.length && forceAny) reviewQueue = Object.keys(state.cards).map(Number).sort(() => Math.random() - .5);
  }
  reviewIndex = 0;
  renderReviewCard();
}

function renderReviewCard() {
  const hasCards = reviewQueue.length > 0 && reviewIndex < reviewQueue.length;
  $('reviewEmpty').classList.toggle('hidden', hasCards);
  $('reviewCard').classList.toggle('hidden', !hasCards);
  if (!hasCards) return;

  const index = reviewQueue[reviewIndex];
  const word = getWord(index);
  $('reviewPrompt').textContent = word.fa;
  $('reviewLatin').textContent = word.latin;
  $('reviewMeaning').textContent = word.en;
  $('reviewCounter').textContent = `${reviewIndex + 1} of ${reviewQueue.length}`;
  $('reviewProgressFill').style.width = `${((reviewIndex) / reviewQueue.length) * 100}%`;
  $('reviewAnswer').classList.add('hidden');
  $('revealBtn').classList.remove('hidden');
}

function rateCard(result) {
  const index = reviewQueue[reviewIndex];
  const card = state.cards[index];
  const key = todayKey();
  card.lastReviewedAt = now();
  card.lastResult = result;

  if (result === 'bad') {
    card.bad += 1;
    card.streak = 0;
    card.intervalDays = 0;
    card.dueAt = now() + 10 * 60 * 1000;
    state.totalBad += 1;
    reviewQueue.push(index);
  } else {
    card.good += 1;
    card.streak += 1;
    const steps = [1, 3, 7, 14, 30, 60, 120];
    card.intervalDays = steps[Math.min(card.streak - 1, steps.length - 1)];
    card.dueAt = now() + card.intervalDays * DAY_MS;
    state.totalGood += 1;
  }

  state.history[key] = state.history[key] || { opened: true, reviewed: 0 };
  state.history[key].reviewed += 1;
  saveState();
  reviewIndex += 1;
  renderAll();
  renderReviewCard();
}

function showView(name) {
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `${name}View`));
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.view === name));
  if (name === 'review') buildReviewQueue(false);
  if (name === 'deck') renderDeck();
}

function renderAll() {
  renderToday();
  renderStats();
  renderDeck();
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.view)));
  document.querySelectorAll('.filter').forEach(btn => btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.filter').forEach(f => f.classList.toggle('active', f === btn));
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
  $('speakReviewBtn').addEventListener('click', event => speak(getWord(reviewQueue[reviewIndex]).fa, event.currentTarget));
  $('againBtn').addEventListener('click', () => rateCard('bad'));
  $('goodBtn').addEventListener('click', () => rateCard('good'));
  $('restartReviewBtn').addEventListener('click', () => buildReviewQueue(true));
  $('reviewAnyBtn').addEventListener('click', () => buildReviewQueue(true));
  $('searchInput').addEventListener('input', renderDeck);

  $('reviewCard').addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !$('revealBtn').classList.contains('hidden')) { event.preventDefault(); $('revealBtn').click(); }
    else if (!$('reviewAnswer').classList.contains('hidden') && event.key === '1') $('againBtn').click();
    else if (!$('reviewAnswer').classList.contains('hidden') && event.key === '2') $('goodBtn').click();
  });

  $('deckList').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.speak !== undefined) speak(getWord(Number(button.dataset.speak)).fa, button);
    if (button.dataset.review !== undefined) {
      showView('review');
      buildReviewQueue(false, Number(button.dataset.review));
    }
    if (button.dataset.remove !== undefined) {
      const index = Number(button.dataset.remove);
      if (confirm(`Remove “${getWord(index).fa}” from your flashcards?`)) {
        delete state.cards[index];
        saveState();
        renderAll();
      }
    }
  });

  $('resetBtn').addEventListener('click', () => {
    if (confirm('Reset all saved words and learning history?')) {
      state = defaultState();
      saveState();
      renderAll();
      showView('today');
      toast('Progress reset');
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
addWord(todaysWordIndex(), true);
bindEvents();
renderAll();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
