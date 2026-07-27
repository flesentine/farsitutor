// Accessible in-app confirmation sheet for destructive actions.
(() => {
  if (!document.querySelector('link[data-confirmation-dialog]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = './confirmation-dialog.css?v=1';
    stylesheet.dataset.confirmationDialog = 'true';
    document.head.appendChild(stylesheet);
  }

  let layer = null;
  let titleElement = null;
  let messageElement = null;
  let confirmButton = null;
  let cancelButton = null;
  let activeRequest = null;
  let previousFocus = null;

  function ensureDialog() {
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'confirmationLayer';
    layer.className = 'confirm-layer';
    layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `
      <section class="confirm-sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirmationTitle" aria-describedby="confirmationMessage">
        <div class="confirm-symbol" aria-hidden="true">!</div>
        <div class="confirm-copy">
          <h2 id="confirmationTitle"></h2>
          <p id="confirmationMessage"></p>
        </div>
        <div class="confirm-actions">
          <button type="button" class="secondary-btn confirm-cancel">Cancel</button>
          <button type="button" class="confirm-accept">Confirm</button>
        </div>
      </section>`;

    document.body.appendChild(layer);
    titleElement = layer.querySelector('#confirmationTitle');
    messageElement = layer.querySelector('#confirmationMessage');
    confirmButton = layer.querySelector('.confirm-accept');
    cancelButton = layer.querySelector('.confirm-cancel');

    cancelButton.addEventListener('click', () => close(false));
    confirmButton.addEventListener('click', () => close(true));
    layer.addEventListener('click', event => {
      if (event.target === layer) close(false);
    });
    layer.addEventListener('keydown', handleKeydown);
    return layer;
  }

  function focusableControls() {
    if (!layer) return [];
    return [...layer.querySelectorAll('button:not([disabled])')].filter(button => !button.hidden);
  }

  function handleKeydown(event) {
    if (!activeRequest) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close(false);
      return;
    }
    if (event.key !== 'Tab') return;

    const controls = focusableControls();
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function close(result) {
    if (!activeRequest || !layer) return;
    const request = activeRequest;
    activeRequest = null;
    layer.classList.remove('is-open');
    layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('confirm-open');
    const restoreTarget = previousFocus;
    previousFocus = null;
    request.resolve(Boolean(result));
    restoreTarget?.focus?.({ preventScroll: true });
  }

  function ask(options = {}) {
    ensureDialog();
    if (activeRequest) close(false);

    const {
      title = 'Are you sure?',
      message = 'This action cannot be undone.',
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      tone = 'danger'
    } = options;

    titleElement.textContent = title;
    messageElement.textContent = message;
    confirmButton.textContent = confirmLabel;
    cancelButton.textContent = cancelLabel;
    confirmButton.className = `confirm-accept${tone === 'danger' ? ' is-danger' : ''}`;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    layer.hidden = false;
    layer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('confirm-open');

    return new Promise(resolve => {
      activeRequest = { resolve };
      window.requestAnimationFrame(() => {
        layer.classList.add('is-open');
        cancelButton.focus({ preventScroll: true });
      });
    });
  }

  window.FarsiConfirm = {
    ask,
    cancel: () => close(false),
    isOpen: () => Boolean(activeRequest)
  };

  if (window.__FARSI_TEST__) {
    window.__FARSI_CONFIRM_TEST__ = { ensureDialog, ask, close, handleKeydown };
  }
})();
