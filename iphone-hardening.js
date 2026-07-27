// Keeps the fixed mobile UI clear of the iPhone keyboard and visual viewport.
(() => {
  const root = document.documentElement;
  const body = document.body;
  const viewport = window.visualViewport || null;
  const editableSelector = 'input, textarea, select, [contenteditable="true"]';
  const landscapeQuery = window.matchMedia?.('(orientation: landscape) and (max-height: 500px) and (max-width: 950px)');
  let scheduled = false;
  let lastKeyboardOpen = false;

  function isEditable(element) {
    return Boolean(element?.matches?.(editableSelector));
  }

  function currentMetrics() {
    const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1));
    const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    const layoutHeight = Math.max(height, Math.round(window.innerHeight || height));
    const keyboardHeight = Math.max(0, layoutHeight - height - offsetTop);
    const focused = isEditable(document.activeElement);
    const keyboardOpen = focused && keyboardHeight >= 96;
    return { height, offsetTop, keyboardHeight, keyboardOpen };
  }

  function applyMetrics() {
    scheduled = false;
    const metrics = currentMetrics();
    root.style.setProperty('--visual-viewport-height', `${metrics.height}px`);
    root.style.setProperty('--visual-viewport-offset-top', `${metrics.offsetTop}px`);
    root.style.setProperty('--keyboard-height', `${metrics.keyboardHeight}px`);
    body?.classList.toggle('keyboard-open', metrics.keyboardOpen);
    body?.classList.toggle('iphone-landscape', Boolean(landscapeQuery?.matches));
    lastKeyboardOpen = metrics.keyboardOpen;
    document.dispatchEvent(new CustomEvent('farsi:viewport-change', { detail: metrics }));
  }

  function scheduleMetrics() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(applyMetrics);
  }

  function revealFocusedControl(target) {
    if (!isEditable(target)) return;
    window.setTimeout(() => {
      scheduleMetrics();
      target.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 180);
  }

  viewport?.addEventListener('resize', scheduleMetrics);
  viewport?.addEventListener('scroll', scheduleMetrics);
  window.addEventListener('resize', scheduleMetrics);
  window.addEventListener('orientationchange', () => window.setTimeout(scheduleMetrics, 80));
  landscapeQuery?.addEventListener?.('change', scheduleMetrics);

  document.addEventListener('focusin', event => revealFocusedControl(event.target));
  document.addEventListener('focusout', () => {
    window.setTimeout(() => {
      scheduleMetrics();
      if (lastKeyboardOpen && !isEditable(document.activeElement)) body?.classList.remove('keyboard-open');
    }, 160);
  });

  applyMetrics();

  window.FarsiViewport = {
    refresh: applyMetrics,
    diagnostics: currentMetrics
  };

  if (window.__FARSI_TEST__) {
    window.__FARSI_VIEWPORT_TEST__ = { currentMetrics, applyMetrics, isEditable };
  }
})();
