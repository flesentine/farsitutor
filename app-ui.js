let reviewRetryCounts = new Map();
let reviewRatingLocked = false;

function readStoredObject(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...fallback, ...value }
      : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function practiceSentence(word) {
  if (word?.exFa) return { fa: word.exFa, latin: word.exLatin || '', en: word.exEn || '' };
  return {
    fa: `من کلمهٔ «${word.fa}» را یاد می‌گیرم.`,
    latin: `Man kalame-ye “${word.latin}” râ yâd migiram.`,
    en: `I am learning the Persian word for “${word.en}.”`
  };
}

function renderToday() {
  const index = todaysWordIndex();
  const word = getWord(index);
  const sentence = practiceSentence(word);
  $('todayFarsi').textContent = word.fa;
  $('todayLatin').textContent = word.latin;
  $('todayMeaning').textContent = word.en;
  $('wordCategory').textContent = word.pos === 'verb' ? 'Verb' : word.category;
  const dateText = new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  }).format(new Date());
  $('wordDay').textContent = `Frequency #${word.rank || index + 1} of ${typeof DAILY_ORDER !== 'undefined' ? DAILY_ORDER.length : WORDS.length} · ${dateText}`;
  const box = $('todayExampleFa').closest('.example-box');
  box.classList.remove('hidden');
  $('todayExampleFa').textContent = sentence.fa;
  $('todayExampleLatin').textContent = sentence.latin;
  $('todayExampleEn').textContent = sentence.en;
  renderVerbDetails('todayVerbPanel', word);
  const added = Boolean(state.cards[index]);
  $('addTodayBtn').disabled = added;
  $('addTodayBtn').textContent = added ? 'Added to my words' : 'Add to my words';
}

function dueCardIndexes() {
  return Object.keys(state.cards)
    .map(Number)
    .filter(index => state.cards[index] && getWord(index) && state.cards[index].dueAt <= now())
    .sort((left, right) => state.cards[left].dueAt - state.cards[right].dueAt);
}

function statusFor(card) {
  if (card.bad > card.good || card.lastResult === 'bad') return 'missed';
  if (card.streak >= 4 || card.intervalDays >= 14) return 'strong';
  return 'learning';
}

function streakDays() {
  const guided = readStoredObject('farsi-guided-today-v2', { days: {} });
  const script = readStoredObject('farsi-script-v1', { completed: {} });
  let count = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < 3650; offset += 1) {
    const key = localDateKey(cursor);
    const practiced = Boolean(
      guided.days?.[key]?.completedAt
      || Number(state.history?.[key]?.reviewed || 0) > 0
      || script.completed?.[key]
    );
    if (practiced) count += 1;
    else if (offset !== 0) break;
    cursor.setDate(cursor.getDate() - 1);
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
  $('accuracyStat').textContent = attempts ? `${Math.round(state.totalGood / attempts * 100)}%` : '—';
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
      if (!word || !card) return false;
      return (!query || `${word.fa} ${word.latin} ${word.en}`.toLowerCase().includes(query))
        && (currentFilter === 'all' || statusFor(card) === currentFilter);
    })
    .sort((left, right) => state.cards[right].addedAt - state.cards[left].addedAt);

  list.innerHTML = '';
  $('deckEmpty').classList.toggle('hidden', entries.length > 0 || Object.keys(state.cards).length > 0);
  entries.forEach(index => {
    const word = getWord(index);
    const card = state.cards[index];
    const status = statusFor(card);
    const due = card.dueAt <= now() ? 'Due now' : `Next ${formatDate(card.dueAt)}`;
    const item = document.createElement('article');
    item.className = 'deck-item';
    item.innerHTML = `<div class="deck-fa" lang="fa" dir="rtl">${escapeHTML(word.fa)}</div><div class="deck-main"><strong>${escapeHTML(word.latin)} · ${escapeHTML(word.en)}</strong><span><i class="status-dot ${status}"></i>#${word.rank || index + 1} · ${word.pos === 'verb' ? 'Verb · ' : ''}${status === 'missed' ? 'Needs work' : status[0].toUpperCase() + status.slice(1)} · ${due} · ${card.good} right / ${card.bad} missed</span></div><div class="deck-actions"><button type="button" data-speak="${index}" aria-label="Speak ${escapeHTML(word.fa)}">🔊</button><button type="button" data-review="${index}" aria-label="Review ${escapeHTML(word.fa)}">↻</button><button type="button" data-remove="${index}" aria-label="Remove ${escapeHTML(word.fa)}">×</button></div>`;
    list.appendChild(item);
  });
}

function shuffleIndexes(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function validReviewIndex(index) {
  return Number.isInteger(index) && Boolean(state.cards[index]) && Boolean(getWord(index));
}

function sanitizeReviewQueue() {
  const oldQueue = Array.isArray(reviewQueue) ? reviewQueue : [];
  const removedBeforeCurrent = oldQueue
    .slice(0, Math.max(0, reviewIndex))
    .filter(index => !validReviewIndex(index)).length;
  reviewQueue = oldQueue.filter(validReviewIndex);
  reviewIndex = Math.max(0, Math.min(reviewQueue.length, reviewIndex - removedBeforeCurrent));
  return reviewQueue.length > 0 && reviewIndex < reviewQueue.length;
}

function buildReviewQueue(forceAny = false, singleIndex = null) {
  if (singleIndex !== null && validReviewIndex(Number(singleIndex))) {
    reviewQueue = [Number(singleIndex)];
  } else {
    reviewQueue = dueCardIndexes();
    if (!reviewQueue.length && forceAny) {
      reviewQueue = shuffleIndexes(Object.keys(state.cards).map(Number).filter(validReviewIndex));
    }
  }
  reviewIndex = 0;
  reviewRetryCounts = new Map();
  reviewRatingLocked = false;
  renderReviewCard();
}

function reviewStage(card) {
  if ((card?.good || 0) < 3) return 'english';
  if ((card?.good || 0) < 6) return 'latin';
  return 'script';
}

function renderReviewCard() {
  const hasCard = sanitizeReviewQueue();
  $('reviewEmpty').classList.toggle('hidden', hasCard);
  $('reviewCard').classList.toggle('hidden', !hasCard);
  if (!hasCard) return;

  const index = reviewQueue[reviewIndex];
  const word = getWord(index);
  const card = state.cards[index];
  const stage = reviewStage(card);
  const prompt = $('reviewPrompt');
  prompt.classList.remove('flash-prompt-english', 'flash-prompt-latin');
  prompt.removeAttribute('lang');
  prompt.removeAttribute('dir');

  if (stage === 'english') {
    $('reviewDirection').textContent = 'English → spoken Persian';
    prompt.textContent = word.en;
    prompt.classList.add('flash-prompt-english');
  } else if (stage === 'latin') {
    $('reviewDirection').textContent = 'Pronunciation → Persian script';
    prompt.textContent = word.latin;
    prompt.classList.add('flash-prompt-latin');
  } else {
    $('reviewDirection').textContent = 'Persian script → meaning';
    prompt.textContent = word.fa;
    prompt.lang = 'fa';
    prompt.dir = 'rtl';
  }

  const sentence = practiceSentence(word);
  $('reviewAnswerFarsi').textContent = word.fa;
  $('reviewLatin').textContent = word.latin;
  $('reviewMeaning').textContent = word.en;
  $('reviewExampleBox').classList.remove('hidden');
  $('reviewExampleFa').textContent = sentence.fa;
  $('reviewExampleLatin').textContent = sentence.latin;
  $('reviewExampleEn').textContent = sentence.en;
  renderVerbDetails('reviewVerbPanel', word);
  $('reviewCounter').textContent = `${reviewIndex + 1} of ${reviewQueue.length}`;
  $('reviewProgressFill').style.width = `${((reviewIndex + 1) / reviewQueue.length) * 100}%`;
  $('reviewAnswer').classList.add('hidden');
  $('revealBtn').classList.remove('hidden');
  $('revealBtn').textContent = stage === 'script' ? 'Show meaning' : 'Show Persian';
  $('speakReviewBtn').classList.add('hidden');
  const status = $('reviewSpeechStatus');
  if (status) {
    status.textContent = '';
    status.classList.remove('error');
  }
}

function rateCard(result) {
  if (reviewRatingLocked) return;
  reviewRatingLocked = true;
  $('againBtn').disabled = true;
  $('goodBtn').disabled = true;

  if (!sanitizeReviewQueue()) {
    reviewRatingLocked = false;
    renderReviewCard();
    return;
  }

  const index = reviewQueue[reviewIndex];
  const card = state.cards[index];
  if (!card) {
    reviewRatingLocked = false;
    sanitizeReviewQueue();
    renderReviewCard();
    return;
  }

  const key = todayKey();
  card.lastReviewedAt = now();
  card.lastResult = result;
  if (result === 'bad') {
    card.bad += 1;
    card.streak = 0;
    card.intervalDays = 0;
    card.dueAt = now() + 600000;
    state.totalBad += 1;
    const retries = reviewRetryCounts.get(index) || 0;
    if (retries < 1) {
      reviewQueue.push(index);
      reviewRetryCounts.set(index, retries + 1);
    }
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
  window.setTimeout(() => {
    reviewRatingLocked = false;
    $('againBtn').disabled = false;
    $('goodBtn').disabled = false;
  }, 300);
}

function showView(name) {
  document.querySelectorAll('.view').forEach(element => element.classList.toggle('active', element.id === `${name}View`));
  document.querySelectorAll('.tab').forEach(element => element.classList.toggle('active', element.dataset.view === name));
  if (name === 'review' && !sanitizeReviewQueue()) buildReviewQueue(false);
  if (name === 'deck') renderDeck();
}

function renderAll() {
  renderToday();
  renderStats();
  renderDeck();
}

let toastTimer;
function toast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2200);
}
