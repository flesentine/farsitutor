const CACHE = 'farsi-daily-cache-v14';
const ASSETS = [
  './', './index.html', './styles.css', './verb-upgrade.css', './learning-upgrade.css',
  './mobile-experience.css?v=1', './guided-learning.css?v=1', './ux-polish.css?v=1',
  './script-review.css?v=1',
  './words.js', './words-part-01.js', './words-part-02.js', './words-part-03.js',
  './words-part-04.js', './words-part-05.js', './words-part-06.js', './words-part-07.js',
  './words-part-08.js', './words-part-09.js', './words-order.js', './verbs.js',
  './script-lessons.js', './app-core.js', './app-ui.js', './app-main.js',
  './speech-fix.js?v=8', './learning-upgrade.js?v=1', './guided-learning.js?v=2',
  './sentence-audio-v2.js?v=1', './script-review.js?v=1', './guided-today-phase1.js?v=1',
  './manifest.json', './icon.svg'
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
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(response => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
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
