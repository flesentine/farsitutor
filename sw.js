const CACHE = 'farsi-daily-cache-v32';
const ASSETS = [
  './', './index.html', './styles.css?v=32', './verb-upgrade.css', './learning-upgrade.css',
  './script-review.css?v=4', './design-spec.css?v=1', './words.js',
  './words-part-01.js', './words-part-02.js', './words-part-03.js', './words-part-04.js',
  './words-part-05.js', './words-part-06.js', './words-part-07.js', './words-part-08.js',
  './words-part-09.js', './words-order.js', './verbs.js', './script-lessons.js',
  './app-core.js', './script-quiz-utils.js?v=1', './app-ui.js?v=3', './app-main.js?v=3',
  './speech-fix.js?v=8', './learning-upgrade.js?v=3', './sentence-audio-manifest.js?v=1',
  './sentence-audio-v4.js?v=2', './sentence-local-audio.js?v=1',
  './script-review-v2.js?v=4', './guided-today-v4.js?v=2', './manifest.json', './icon.svg'
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
