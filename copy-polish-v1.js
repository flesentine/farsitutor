// Centralized learner-facing copy polish. No lesson or review behavior changes.
(() => {
  const exactText = new Map([
    ['Daily lesson complete', 'Lesson complete'],
    ['Add to my words', 'Save to My Words'],
    ['Added to my words', 'Saved to My Words'],
    ['Everything required for today is saved.', 'Your progress is saved.'],
    ['Play word again', 'Hear word again'],
    ['Continue to sentence', 'Next: Sentence'],
    ['Play sentence', 'Hear sentence'],
    ['Play sentence again', 'Hear sentence again'],
    ['Continue to memory check', 'Next: Memory check'],
    ['Listen to the complete phrase before moving on.', 'Listen once before moving on.'],
    ['Play slowly', 'Hear it slowly'],
    ['Repeat sentence ×3', 'Hear sentence 3 times'],
    ['Word → sentence', 'Hear word, then sentence'],
    ['Hear word separately', 'Hear just the word'],
    ['Play word', 'Hear word'],
    ['Continue to today’s letter', 'Next: Today’s letter'],
    ['Start letter quiz', 'Start the quiz'],
    ['Complete today’s lesson', 'Finish lesson'],
    ['DONE FOR TODAY', 'LESSON COMPLETE'],
    ['You completed your daily Farsi lesson.', 'You finished today’s four learning steps.'],
    ['Practice more words', 'Practice words'],
    ['Practice older letters', 'Review a previous letter'],
    ['QUICK SCRIPT REVIEW', 'BONUS LETTER REVIEW'],
    ['Review one older letter', 'Review a previous letter'],
    ['Review an older letter', 'Review a previous letter'],
    ['Review another older letter', 'Review another letter'],
    ['Skip for today', 'Skip this review'],
    ['Finish for today', 'Finish review'],
    ['✓ Older-letter review complete today.', '✓ Letter review complete.'],
    ['Older-letter review skipped for today.', 'Letter review skipped.'],
    ['This uses the same progress and review history as the full Script practice screen.', 'Optional. Letters you miss will return more often.'],
    ['OPTIONAL PRACTICE', 'EXTRA PRACTICE'],
    ['Review older letters', 'Review previous letters'],
    ['Practice letters from earlier lessons when you want extra review.', 'Practice a previous letter whenever you want.'],
    ['OLDER LETTER REVIEW', 'PREVIOUS LETTER REVIEW'],
    ['Keep earlier letters fresh', 'Keep previous letters fresh'],
    ['Open review', 'Start review'],
    ['Close review', 'Hide review'],
    ['No earlier studied letters yet. Complete a letter lesson and it will return on a future day.', 'No previous letters are ready yet. Finish another letter lesson first.'],
    ['Earlier studied letters will appear here on future days.', 'Previous letters will appear here on future days.'],
    ['Start quiz', 'Start the quiz'],
    ['Practice this letter again', 'Review this letter again'],
    ['English → Persian', 'Recall the Farsi word'],
    ['English → spoken Persian', 'Recall the Farsi word'],
    ['Pronunciation → Persian script', 'Recall the Persian spelling'],
    ['Persian script → meaning', 'Recall the English meaning'],
    ['Audio played successfully.', 'Audio finished.'],
    ['Audio could not play.', 'Audio couldn’t play. Check your volume and try again.'],
    ['The full sentence is not available yet.', 'Sentence audio isn’t available for this word yet.'],
    ['The current web build may use a remote pronunciation fallback when bundled and device audio are unavailable.', 'Curriculum words and sentences use bundled audio. Uncommon phrases use a genuine Persian system voice when available.']
  ]);

  const phraseText = [
    ['Play word again', 'Hear word again'],
    ['Play sentence again', 'Hear sentence again'],
    ['Play sentence', 'Hear sentence'],
    ['Play word', 'Hear word']
  ];

  function preserveSpacing(original, replacement) {
    const leading = original.match(/^\s*/)?.[0] || '';
    const trailing = original.match(/\s*$/)?.[0] || '';
    return `${leading}${replacement}${trailing}`;
  }

  function rewriteValue(value) {
    const trimmed = value.trim();
    if (!trimmed) return value;

    if (exactText.has(trimmed)) return preserveSpacing(value, exactText.get(trimmed));

    let next = value;
    phraseText.forEach(([from, to]) => {
      if (next.includes(from)) next = next.replaceAll(from, to);
    });

    next = next
      .replace(/Review (\d+) due word(s?)/g, 'Review $1 word$2')
      .replace(/(\d+) additional word is ready for review\./g, '$1 word is ready to review.')
      .replace(/(\d+) additional words are ready for review\./g, '$1 words are ready to review.')
      .replace(/No vocabulary reviews are due right now\./g, 'No word reviews are due right now.')
      .replace(/Which letter is called “([^”]+)”\?/g, 'Which letter is named “$1”?')
      .replace(/Which base letter matches this starting form\?/g, 'Which letter has this beginning form?')
      .replace(/Which base letter matches this middle form\?/g, 'Which letter has this middle form?')
      .replace(/Which base letter matches this ending form\?/g, 'Which letter has this end form?')
      .replace(/(\d+) of (\d+) previous-letter reviews correct today/g, '$1 of $2 letter reviews correct today')
      .replace(/Daily script quiz complete/g, 'Today’s letter quiz complete')
      .replace(/(\d+) correct of (\d+) attempts/g, '$1 of $2 correct')
      .replace(/(\d+) right \/ (\d+) missed/g, '$1 correct · $2 missed')
      .replace(/(^|·\s*)#(\d+)\s*·/g, '$1Frequency #$2 ·');

    return next;
  }

  function rewriteTextNodes(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const next = rewriteValue(node.nodeValue || '');
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }

  function polishLetterForms() {
    document.querySelectorAll('.script-forms small, .guided-study-forms small').forEach(label => {
      if (label.textContent.trim() === 'Start') label.textContent = 'Beginning';
    });
  }

  function polishNameAndSound() {
    document.querySelectorAll('.guided-card h3').forEach(heading => {
      const match = heading.textContent.trim().match(/^(.+?) · Sound “(.+?)”$/);
      if (match) heading.textContent = `Name: ${match[1]} · Sound: ${match[2]}`;
    });
  }

  function polishAccessibility() {
    const today = document.getElementById('speakTodayBtn');
    if (today) today.setAttribute('aria-label', 'Play pronunciation of today’s Farsi word');

    const review = document.getElementById('speakReviewBtn');
    if (review) review.setAttribute('aria-label', 'Play pronunciation for the review word');

    const search = document.getElementById('searchInput');
    if (search) search.setAttribute('aria-label', 'Search saved words');

    document.querySelectorAll('[aria-label^="Speak "]').forEach(button => {
      const subject = button.getAttribute('aria-label').slice(6);
      button.setAttribute('aria-label', `Play pronunciation for ${subject}`);
    });
  }

  function polishCopy() {
    rewriteTextNodes(document.body);
    polishLetterForms();
    polishNameAndSound();
    polishAccessibility();
  }

  const originalToast = window.toast;
  if (typeof originalToast === 'function') {
    window.toast = function polishedToast(message) {
      const copy = message === 'Audio could not start. Check media volume, then try Slow sentence.'
        ? 'Audio couldn’t play. Check your volume and try again.'
        : rewriteValue(String(message || ''));
      return originalToast(copy);
    };
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      polishCopy();
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  polishCopy();
})();
