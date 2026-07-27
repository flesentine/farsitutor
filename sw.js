const CACHE = 'farsi-daily-cache-v46';
const ASSETS = [
  './', './index.html', './privacy.html', './support.html', './styles.css', './settings.css?v=1',
  './confirmation-dialog.css?v=1', './iphone-hardening.css?v=1', './legal.css?v=1', './verb-upgrade.css', './learning-upgrade.css',
  './guided-learning.css?v=1', './ux-polish.css?v=1', './mobile-experience.css?v=2',
  './script-review.css?v=3', './guided-today-v3.css?v=1', './guided-usability.css?v=2',
  './guided-audio-recovery.css?v=1', './guided-flow-v2.css?v=1', './guided-script-inline.css?v=1',
  './color-system-v1.css?v=1', './layout-polish-v1.css?v=1', './generated-art-v1.css?v=1',
  './word-fit-v1.css?v=1', './visual-upgrade-v2.css?v=1', './platform.js?v=1', './storage.js?v=1',
  './words.js', './words-part-01.js', './words-part-02.js', './words-part-03.js', './words-part-04.js',
  './words-part-05.js', './words-part-06.js', './words-part-07.js', './words-part-08.js',
  './words-part-09.js', './words-order.js', './verbs.js', './script-lessons.js', './app-core.js',
  './script-quiz-utils.js?v=1', './app-ui.js?v=2', './app-main.js?v=3', './settings.js?v=1',
  './confirmation-dialog.js?v=1', './iphone-hardening.js?v=1', './speech-fix.js?v=9', './learning-upgrade.js?v=3', './guided-learning.js?v=3',
  './sentence-audio-manifest.js?v=1', './sentence-audio-v4.js?v=2', './sentence-local-audio.js?v=1',
  './script-review-v2.js?v=4', './guided-integrity-v3.js?v=1', './guided-today-v5.js?v=1',
  './guided-script-inline.js?v=1', './guided-sentence-recovery.js?v=3', './runtime-integrity-v3.js?v=1',
  './copy-polish-v1.js?v=1', './layout-polish-v1.js?v=1', './visual-upgrade-v2.js?v=1',
  './manifest.json', './icon.svg?v=2', './assets/icons/apple-touch-icon-180.png',
  './assets/icons/farsi-daily-192.png', './assets/icons/farsi-daily-512.png', './assets/icons/farsi-daily-maskable-512.png',
  './lesson-complete-badge.svg?v=1',
  './assets/empty-no-words.svg?v=1', './assets/empty-caught-up.svg?v=1',
  './assets/badge-first-lesson.svg?v=1', './assets/badge-streak-7.svg?v=1',
  './assets/badge-25-words.svg?v=1', './assets/badge-alphabet.svg?v=1'
];

self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
));

self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Never cache byte-range media responses. A cached 206 can corrupt later playback.
  if (event.request.headers.has('range')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(response => {
        if (
          response.status === 200
          && response.type === 'basic'
          && event.request.url.startsWith(self.location.origin)
        ) {
          caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        throw new Error('Network and cache unavailable');
      })
  );
});
