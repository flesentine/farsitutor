const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = filename => fs.readFileSync(path.join(ROOT, filename), 'utf8');
const css = read('iphone-hardening.css');
const runtime = read('iphone-hardening.js');
const loader = read('layout-polish-v1.js');
const serviceWorker = read('sw.js');
const index = read('index.html');

for (const token of [
  'safe-area-inset-top',
  'safe-area-inset-right',
  'safe-area-inset-bottom',
  'safe-area-inset-left',
  '100dvh',
  'body.keyboard-open .tabbar',
  'grid-template-columns: repeat(3, minmax(0, 1fr))',
  '@media (max-width: 359px)',
  '@media (orientation: landscape) and (max-height: 500px)',
  'font-size: max(16px, 1rem)',
  'max-height: calc(var(--visual-viewport-height'
]) {
  if (!css.includes(token)) throw new Error(`Missing iPhone hardening style: ${token}`);
}

for (const token of [
  'viewport-fit=cover',
  './confirmation-dialog.css?v=1',
  './iphone-hardening.css?v=1',
  './iphone-hardening.js?v=1'
]) {
  if (!loader.includes(token)) throw new Error(`Layout loader is missing: ${token}`);
}

for (const asset of ['./iphone-hardening.css?v=1', './iphone-hardening.js?v=1']) {
  if (!serviceWorker.includes(`'${asset}'`)) throw new Error(`Offline cache is missing ${asset}.`);
}

const viewportPolicy = `${index}\n${loader}`;
if (/maximum-scale\s*=\s*1/i.test(viewportPolicy) || /user-scalable\s*=\s*no/i.test(viewportPolicy)) {
  throw new Error('Viewport configuration disables user zoom.');
}

const styleValues = new Map();
const bodyClasses = new Set();
const listeners = new Map();
let editable = true;
const activeElement = {
  matches(selector) { return editable && selector.includes('input'); },
  scrollIntoView() {}
};

const body = {
  classList: {
    toggle(name, enabled) {
      if (enabled) bodyClasses.add(name);
      else bodyClasses.delete(name);
    },
    remove(name) { bodyClasses.delete(name); }
  }
};

const visualViewport = {
  height: 500,
  offsetTop: 0,
  addEventListener(name, handler) { listeners.set(`viewport:${name}`, handler); }
};

const context = {
  console,
  CustomEvent: class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  },
  document: {
    body,
    activeElement,
    documentElement: {
      clientHeight: 800,
      style: { setProperty(name, value) { styleValues.set(name, value); } }
    },
    addEventListener(name, handler) { listeners.set(`document:${name}`, handler); },
    dispatchEvent() {}
  },
  window: {
    __FARSI_TEST__: true,
    innerHeight: 800,
    visualViewport,
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { callback(); return 1; },
    addEventListener(name, handler) { listeners.set(`window:${name}`, handler); },
    matchMedia() { return { matches: false, addEventListener() {} }; }
  }
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(runtime, context, { filename: 'iphone-hardening.js' });

const api = context.window.__FARSI_VIEWPORT_TEST__;
if (!api) throw new Error('Viewport test API was not exposed.');
let metrics = api.currentMetrics();
if (!metrics.keyboardOpen || metrics.keyboardHeight !== 300) {
  throw new Error(`Focused keyboard metrics were wrong: ${JSON.stringify(metrics)}`);
}
api.applyMetrics();
if (!bodyClasses.has('keyboard-open')) throw new Error('Keyboard-open class was not applied.');
if (styleValues.get('--visual-viewport-height') !== '500px') throw new Error('Visual viewport height was not published.');
if (styleValues.get('--keyboard-height') !== '300px') throw new Error('Keyboard height was not published.');

editable = false;
metrics = api.currentMetrics();
if (metrics.keyboardOpen) throw new Error('Address-bar or viewport shrinkage was mistaken for a keyboard without editable focus.');
api.applyMetrics();
if (bodyClasses.has('keyboard-open')) throw new Error('Keyboard-open class was not cleared.');

visualViewport.height = 800;
editable = true;
metrics = api.currentMetrics();
if (metrics.keyboardOpen || metrics.keyboardHeight !== 0) throw new Error('Full-height viewport was incorrectly treated as keyboard-open.');

console.log('iPhone safe-area, keyboard, landscape, and text-scaling safeguards passed.');
