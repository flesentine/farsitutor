// Layout density and icon placement polish. Learning behavior stays unchanged.
(() => {
  const paths = {
    today: '<path d="M7 2v3M17 2v3M3.5 9.5h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="m8.5 15 2.2 2.2 4.8-5"/>',
    review: '<path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/>',
    deck: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H14v18a3 3 0 0 1 3-3h.5a2.5 2.5 0 0 1 2.5 2.5Z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    speaker: '<path d="M11 5 6.5 9H3v6h3.5L11 19Z"/><path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7.5 7.5 0 0 1 0 10"/>',
    more: '<circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.25" fill="currentColor" stroke="none"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>'
  };

  function svg(name, className = '') {
    return `<svg class="ui-svg ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
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
      [...button.childNodes].forEach(node => {
        if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue.includes('🔊')) return;
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

  if (typeof renderStats === 'function') {
    const originalRenderStats = renderStats;
    renderStats = function renderStatsWithBadgeVisibility(...args) {
      const result = originalRenderStats.apply(this, args);
      syncReviewBadge();
      return result;
    };
  }

  if (typeof renderDeck === 'function') {
    renderDeck = function renderCompactDeck() {
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
        item.className = 'deck-item deck-item-compact';
        item.innerHTML = `
          <div class="deck-word">
            <div class="deck-fa" lang="fa" dir="rtl">${escapeHTML(word.fa)}</div>
            <button type="button" class="deck-audio" data-speak="${index}" aria-label="Play pronunciation for ${escapeHTML(word.fa)}">${svg('speaker')}</button>
          </div>
          <div class="deck-main">
            <strong>${escapeHTML(word.latin)} · ${escapeHTML(word.en)}</strong>
            <span><i class="status-dot ${status}"></i>Frequency #${word.rank || index + 1} · ${word.pos === 'verb' ? 'Verb · ' : ''}${status === 'missed' ? 'Needs work' : status[0].toUpperCase() + status.slice(1)} · ${due} · ${card.good} correct · ${card.bad} missed</span>
          </div>
          <div class="deck-actions">
            <button type="button" class="deck-review" data-review="${index}" aria-label="Review ${escapeHTML(word.fa)}">${svg('review')}<span>Review</span></button>
            <details class="deck-more">
              <summary aria-label="More actions for ${escapeHTML(word.fa)}">${svg('more')}</summary>
              <div class="deck-more-menu">
                <button type="button" data-remove="${index}" aria-label="Remove ${escapeHTML(word.fa)}">${svg('trash')}<span>Remove</span></button>
              </div>
            </details>
          </div>`;
        list.appendChild(item);
      });
    };
  }

  function syncLayout() {
    installStaticIcons();
    replaceSpeakerIcons();
    moveReviewReset();
    compactCompletion();
    syncReviewBadge();
  }

  document.addEventListener('click', event => {
    if (event.target.closest('.deck-more')) return;
    document.querySelectorAll('.deck-more[open]').forEach(menu => menu.removeAttribute('open'));
  });

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
  syncLayout();
  if (typeof renderDeck === 'function') renderDeck();
  if (typeof renderStats === 'function') renderStats();
})();
