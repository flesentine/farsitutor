// Loads the consolidated visual upgrade after the existing app modules.
(() => {
  if (!document.querySelector('link[data-visual-upgrade="v2"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = './visual-upgrade-v2.css?v=1';
    stylesheet.dataset.visualUpgrade = 'v2';
    document.head.appendChild(stylesheet);
  }

  if (!document.querySelector('script[data-visual-upgrade="v2"]')) {
    const script = document.createElement('script');
    script.src = './visual-upgrade-v2.js?v=1';
    script.async = false;
    script.dataset.visualUpgrade = 'v2';
    document.head.appendChild(script);
  }
})();
