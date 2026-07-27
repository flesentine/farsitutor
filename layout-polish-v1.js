// Loads the consolidated visual upgrade and iPhone hardening after the existing app modules.
(() => {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && !viewport.content.includes('viewport-fit=cover')) {
    viewport.content = `${viewport.content},viewport-fit=cover`;
  }

  function ensureStylesheet(selector, href, datasetName, datasetValue) {
    if (document.querySelector(selector)) return;
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = href;
    stylesheet.dataset[datasetName] = datasetValue;
    document.head.appendChild(stylesheet);
  }

  function ensureScript(selector, source, datasetName, datasetValue) {
    if (document.querySelector(selector)) return;
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.dataset[datasetName] = datasetValue;
    document.head.appendChild(script);
  }

  ensureStylesheet('link[data-confirmation-dialog-style]', './confirmation-dialog.css?v=1', 'confirmationDialogStyle', 'true');
  ensureStylesheet('link[data-visual-upgrade="v2"]', './visual-upgrade-v2.css?v=1', 'visualUpgrade', 'v2');
  ensureStylesheet('link[data-iphone-hardening="v1"]', './iphone-hardening.css?v=1', 'iphoneHardening', 'v1');

  ensureScript('script[data-visual-upgrade="v2"]', './visual-upgrade-v2.js?v=1', 'visualUpgrade', 'v2');
  ensureScript('script[data-iphone-hardening="v1"]', './iphone-hardening.js?v=1', 'iphoneHardening', 'v1');
})();
