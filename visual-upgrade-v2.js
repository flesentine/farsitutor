// Layout, achievements, and swipe actions. Learning behavior stays unchanged.
(() => {
  const paths = {
    today: '<path d="M7 2v3M17 2v3M3.5 9.5h17M5 4h14a2 2 0 0 1 2 2v13a2 2.5 0 0 1-2 2H5a2 2.5 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="m8.5 15 2.2 2.2 4.8-5"/>',
    review: '<path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/>',
    deck: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H14v18a3 3 0 0 1 3-3h.5a2.5 2.5 0 0 1 2.5 2.5Z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    speaker: '<path d="M11 5 6.5 9H3v6h3.5L11 19Z"/><path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7.5 7.5 0 0 1 0 10"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
    lock: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/>'
  };

  const svg = (name, className = '') => `<svg class="ui-svg ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;

  function readObject(key, fallback = {}) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value)
        ? { ...fallback, ...value }
        : { ...fallback };
    } catch {
      return { ...fallback };
    }
  }

  function installStaticIcons() {
    document.querySelectorAll('.tab[data-view]').forEach(tab => {
      if (tab.querySelector('.tab-icon')) return;
      const name = tab.dataset.view === 'deck' ? 'deck' : tab.dataset.view;
      if (!paths[name]) return;
      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      icon.innerHTML = svg(name);
      tab.prepend(icon);
    });

    const searchIcon = document.querySelector('.search-wrap > span');
    if (searchIcon && !searchIcon.classList.contains('search-icon')) {
      searchIcon.className = 'search-icon';
      searchIcon.innerHTML = svg('search');
    }
  }

  function replaceSpeakerIcons(root = document) {
    root.querySelectorAll('button').forEach(button => {
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        if (!node.nodeValue.includes('🔊')) return;
        const parts = node.nodeValue.split('🔊');
        const fragment = document.createDocumentFragment();
        parts.forEach((part, index) => {
          if (index > 0) {
            const icon = document.createElement('span');
            icon.className = 'button-icon';
            icon.innerHTML = svg('speaker');
            fragment.appendChild(icon);
          }
          if (part) fragment.appendChild(document.createTextNode(part));
        });
        node.replaceWith(fragment);
      });
    });
  }

  function moveReviewReset() {
    const reset = document.getElementById('restartReviewBtn');
    const meta = document.querySelector('#reviewCard .flash-meta');
    if (!reset || !meta || reset.parentElement === meta) return;
    reset.textContent = 'Start over';
    reset.classList.add('review-reset-link');
    const audio = document.getElementById('speakReviewBtn');
    meta.insertBefore(reset, audio || null);
  }

  function compactCompletion() {
    const cards = document.querySelectorAll('#guidedTodayV3 .guided-card');
    const card = [...cards].find(candidate => {
      const label = candidate.querySelector('.guided-kicker')?.textContent.trim();
      return label === 'LESSON COMPLETE' || label === 'DONE FOR TODAY';
    });
    if (!card) return;
    card.classList.add('guided-complete-card');
    if (card.querySelector(':scope > .guided-complete-heading')) return;

    const check = card.querySelector(':scope > .guided-done');
    const kicker = card.querySelector(':scope > .guided-kicker');
    const heading = card.querySelector(':scope > h3');
    if (!check || !kicker || !heading) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'guided-complete-heading';
    const copy = document.createElement('div');
    copy.className = 'guided-complete-copy';
    copy.append(kicker, heading);
    wrapper.append(check, copy);
    card.prepend(wrapper);
  }

  function syncReviewBadge() {
    const badge = document.getElementById('reviewBadge');
    if (!badge) return;
    badge.hidden = !(Number(badge.textContent.trim()) > 0);
  }

  function installEmptyStateArt() {
    const states = [
      ['reviewEmpty', 'assets/empty-caught-up.svg?v=1', 'empty-illustration-caught-up'],
      ['deckEmpty', 'assets/empty-no-words.svg?v=1', 'empty-illustration-words']
    ];
    states.forEach(([id, source, extraClass]) => {
      const stateElement = document.getElementById(id);
      if (!stateElement || stateElement.querySelector('.empty-illustration')) return;
      const oldIcon = stateElement.querySelector('.empty-icon');
      const image = document.createElement('img');
      image.className = `empty-illustration ${extraClass}`;
      image.src = source;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      if (oldIcon) oldIcon.replaceWith(image);
      else stateElement.prepend(image);
    });
  }

  function ensureAchievementSection() {
    let section = document.getElementById('achievementSection');
    if (section) return section;
    const list = document.getElementById('deckList');
    if (!list) return null;
    section = document.createElement('section');
    section.id = 'achievementSection';
    section.className = 'achievement-section';
    section.setAttribute('aria-labelledby', 'achievementTitle');
    section.innerHTML = `
      <div class="achievement-heading">
        <div><p class="eyebrow">MILESTONES</p><h3 id="achievementTitle">Achievements</h3></div>
        <span id="achievementCount" class="muted">0 of 4</span>
      </div>
      <div id="achievementStrip" class="achievement-strip"></div>`;
    list.before(section);
    return section;
  }

  function achievementData() {
    const guided = readObject('farsi-guided-today-v2', { days: {} });
    const script = readObject('farsi-script-v1', { completed: {} });
    const scriptReview = readObject('farsi-script-review-v1', { letters: {} });
    const completedLessons = Object.values(guided.days || {}).filter(day => Boolean(day?.completedAt)).length;
    const streak = typeof streakDays === 'function' ? streakDays() : 0;
    const savedWords = Object.keys(state?.cards || {}).length;
    const reviewedLetters = Object.values(scriptReview.letters || {}).filter(letter => Number(letter?.attempts || 0) > 0).length;
    const completedScriptDays = Object.values(script.completed || {}).filter(Boolean).length;
    const letters = Math.max(reviewedLetters, completedScriptDays);

    return [
      {
        key: 'first', title: 'First lesson', source: 'assets/badge-first-lesson.svg?v=1',
        unlocked: completedLessons >= 1, progress: completedLessons >= 1 ? 'Unlocked' : 'Complete 1 lesson'
      },
      {
        key: 'streak', title: '7-day streak', source: 'assets/badge-streak-7.svg?v=1',
        unlocked: streak >= 7, progress: streak >= 7 ? 'Unlocked' : `${Math.min(streak, 7)}/7 days`
      },
      {
        key: 'words', title: '25 words', source: 'assets/badge-25-words.svg?v=1',
        unlocked: savedWords >= 25, progress: savedWords >= 25 ? 'Unlocked' : `${Math.min(savedWords, 25)}/25 words`
      },
      {
        key: 'alphabet', title: 'Letter explorer', source: 'assets/badge-alphabet.svg?v=1',
        unlocked: letters >= 5, progress: letters >= 5 ? 'Unlocked' : `${Math.min(letters, 5)}/5 letters`
      }
    ];
  }

  function renderAchievements() {
    if (!ensureAchievementSection()) return;
    const strip = document.getElementById('achievementStrip');
    const count = document.getElementById('achievementCount');
    if (!strip || !count) return;
    const achievements = achievementData();
    count.textContent = `${achievements.filter(item => item.unlocked).length} of ${achievements.length}`;
    strip.innerHTML = achievements.map(item => `
      <article class="achievement-item${item.unlocked ? ' unlocked' : ' locked'}" aria-label="${escapeHTML(item.title)}. ${escapeHTML(item.progress)}">
        <div class="achievement-art">
          <img src="${item.source}" alt="" loading="lazy" decoding="async">
          ${item.unlocked ? '' : `<span class="achievement-lock">${svg('lock')}</span>`}
        </div>
        <strong>${escapeHTML(item.title)}</strong>
        <span>${escapeHTML(item.progress)}</span>
      </article>`).join('');
  }

  const statusLabel = status => status === 'missed' ? 'Needs work' : status[0].toUpperCase() + status.slice(1);

  function renderCompactDeck() {
    const list = $('deckList');
    if (!list) return;
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
      .sort((left, right) => (state.cards[right].addedAt || 0) - (state.cards[left].addedAt || 0));

    list.innerHTML = '';
    $('deckEmpty').classList.toggle('hidden', entries.length > 0 || Object.keys(state.cards).length > 0);

    entries.forEach(index => {
      const word = getWord(index);
      const card = state.cards[index];
      const status = statusFor(card);
      const due = card.dueAt <= now() ? 'Due now' : `Next ${formatDate(card.dueAt)}`;
      const detail = `Frequency #${word.rank || index + 1}. ${statusLabel(status)}. ${due}. ${card.good} correct and ${card.bad} missed.`;
      const row = document.createElement('article');
      row.className = 'deck-swipe';
      row.dataset.swipeIndex = String(index);
      row.innerHTML = `
        <button type="button" class="deck-swipe-delete" data-swipe-remove="${index}" tabindex="-1" aria-label="Remove ${escapeHTML(word.fa)} from My Words">${svg('trash')}<span>Delete</span></button>
        <div class="deck-item deck-item-compact deck-swipe-content" tabindex="0" role="group" aria-label="${escapeHTML(word.fa)}, ${escapeHTML(word.latin)}, ${escapeHTML(word.en)}. ${escapeHTML(detail)} Swipe left or press Delete to remove.">
          <div class="deck-word">
            <div class="deck-fa" lang="fa" dir="rtl">${escapeHTML(word.fa)}</div>
          </div>
          <div class="deck-main" title="${escapeHTML(detail)}">
            <strong>${escapeHTML(word.latin)} · ${escapeHTML(word.en)}</strong>
            <div class="deck-meta-row">
              <span class="word-status-chip status-${status}"><i class="status-dot ${status}"></i>${statusLabel(status)}</span>
              <span class="deck-next">${escapeHTML(due)}</span>
            </div>
          </div>
          <div class="deck-actions">
            <button type="button" class="deck-audio" data-speak="${index}" aria-label="Play pronunciation for ${escapeHTML(word.fa)}">${svg('speaker')}</button>
            <button type="button" class="deck-review" data-review="${index}" aria-label="Review ${escapeHTML(word.fa)}">${svg('review')}<span>Review</span></button>
          </div>
          <button type="button" class="visually-hidden deck-delete-accessible" data-accessible-remove="${index}">Remove ${escapeHTML(word.fa)} from My Words</button>
        </div>`;
      list.appendChild(row);
    });
    renderAchievements();
  }

  if (typeof renderDeck === 'function') renderDeck = renderCompactDeck;

  if (typeof renderStats === 'function') {
    const originalRenderStats = renderStats;
    renderStats = function renderStatsWithVisuals(...args) {
      const result = originalRenderStats.apply(this, args);
      syncReviewBadge();
      renderAchievements();
      return result;
    };
  }

  let openRow = null;
  let drag = null;
  const deleteWidth = 82;

  function setRowOpen(row, shouldOpen) {
    if (!row) return;
    if (shouldOpen && openRow && openRow !== row) setRowOpen(openRow, false);
    row.classList.toggle('is-open', shouldOpen);
    row.classList.remove('is-dragging');
    const content = row.querySelector('.deck-swipe-content');
    if (content) content.style.transform = '';
    const removeButton = row.querySelector('.deck-swipe-delete');
    if (removeButton) removeButton.tabIndex = shouldOpen ? 0 : -1;
    openRow = shouldOpen ? row : (openRow === row ? null : openRow);
  }

  function removeSavedWord(index) {
    const word = getWord(index);
    if (!word || !state.cards[index]) return;
    if (!confirm(`Remove “${word.fa}” from My Words?`)) return;
    delete state.cards[index];
    saveState();
    if (typeof sanitizeReviewQueue === 'function') sanitizeReviewQueue();
    if (typeof renderAll === 'function') renderAll();
    else {
      renderCompactDeck();
      if (typeof renderStats === 'function') renderStats();
    }
    if (document.getElementById('reviewView')?.classList.contains('active') && typeof renderReviewCard === 'function') renderReviewCard();
    if (typeof toast === 'function') toast('Removed from My Words');
  }

  function startDrag(event) {
    const content = event.target.closest('.deck-swipe-content');
    if (!content || event.target.closest('button')) return;
    const row = content.closest('.deck-swipe');
    if (!row) return;
    drag = {
      row, content, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY,
      startOffset: row.classList.contains('is-open') ? -deleteWidth : 0,
      offset: row.classList.contains('is-open') ? -deleteWidth : 0,
      axis: null
    };
    content.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) drag.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
    if (drag.axis !== 'x') return;
    if (event.cancelable) event.preventDefault();
    drag.row.classList.add('is-dragging');
    drag.offset = Math.max(-deleteWidth, Math.min(0, drag.startOffset + dx));
    drag.content.style.transform = `translateX(${drag.offset}px)`;
  }

  function finishDrag(event) {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const current = drag;
    drag = null;
    const shouldOpen = current.axis === 'x' ? current.offset < -deleteWidth / 2 : current.row.classList.contains('is-open');
    setRowOpen(current.row, shouldOpen);
  }

  document.addEventListener('pointerdown', startDrag);
  document.addEventListener('pointermove', moveDrag, { passive: false });
  document.addEventListener('pointerup', finishDrag);
  document.addEventListener('pointercancel', finishDrag);

  document.addEventListener('keydown', event => {
    const content = event.target.closest('.deck-swipe-content');
    if (!content) return;
    const row = content.closest('.deck-swipe');
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setRowOpen(row, true);
    } else if (event.key === 'ArrowRight' || event.key === 'Escape') {
      event.preventDefault();
      setRowOpen(row, false);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && !event.target.closest('button')) {
      event.preventDefault();
      removeSavedWord(Number(row.dataset.swipeIndex));
    }
  });

  document.addEventListener('click', event => {
    const remove = event.target.closest('[data-swipe-remove], [data-accessible-remove]');
    if (remove) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const index = Number(remove.dataset.swipeRemove ?? remove.dataset.accessibleRemove);
      removeSavedWord(index);
      return;
    }
    if (!event.target.closest('.deck-swipe') && openRow) setRowOpen(openRow, false);
  }, true);

  function syncLayout() {
    installStaticIcons();
    replaceSpeakerIcons();
    moveReviewReset();
    compactCompletion();
    syncReviewBadge();
    installEmptyStateArt();
    ensureAchievementSection();
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      syncLayout();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.getElementById('searchInput')?.addEventListener('input', () => window.requestAnimationFrame(renderCompactDeck));
  syncLayout();
  renderCompactDeck();
  if (typeof renderStats === 'function') renderStats();
})();
