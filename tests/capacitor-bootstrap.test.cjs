const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const config = read('capacitor.config.ts');
const bridge = read('native/native-bridge.ts');
const build = read('tools/build-native.mjs');
const configure = read('tools/configure-ios.mjs');
const privacy = read('native/PrivacyInfo.xcprivacy');
const settings = read('settings.js');
const ignore = read('.gitignore');

for (const [name, version] of Object.entries({
  '@capacitor/core': '8.4.2',
  '@capacitor/ios': '8.4.2',
  '@capacitor/preferences': '8.0.1',
  '@capacitor/local-notifications': '8.2.1',
  '@capacitor/haptics': '8.0.1',
  '@capacitor/share': '8.0.1'
})) {
  if (packageJson.dependencies[name] !== version) throw new Error(`${name} is not pinned to ${version}.`);
}
if (packageJson.devDependencies['@capacitor/cli'] !== '8.4.2') throw new Error('Capacitor CLI is not pinned.');
if (packageJson.devDependencies.esbuild !== '0.28.1') throw new Error('esbuild is not pinned.');
for (const script of ['build:native', 'cap:add:ios', 'cap:sync:ios', 'cap:open:ios', 'ios:configure']) {
  if (!packageJson.scripts[script]) throw new Error(`Missing npm script ${script}.`);
}

for (const token of [
  "appId: 'com.farsidaily.app'",
  "appName: 'Farsi Daily'",
  "webDir: 'dist'",
  "presentationOptions: ['badge', 'sound', 'banner', 'list']"
]) {
  if (!config.includes(token)) throw new Error(`Capacitor config is missing ${token}.`);
}

for (const token of [
  "from '@capacitor/preferences'",
  "from '@capacitor/local-notifications'",
  "from '@capacitor/haptics'",
  "from '@capacitor/share'",
  'FarsiPlatform?.registerAdapter',
  'FarsiStorage?.registerAdapter',
  'LocalNotifications.checkPermissions()',
  'LocalNotifications.requestPermissions()',
  'schedule: { on: { hour, minute, second: 0 } }',
  'DAILY_REMINDER_ID',
  'Share.canShare()',
  'await startAppScripts()'
]) {
  if (!bridge.includes(token)) throw new Error(`Native bridge is missing ${token}.`);
}
const hydrationPosition = bridge.indexOf('FarsiStorage?.registerAdapter');
const appStartPosition = bridge.indexOf('await startAppScripts()');
if (hydrationPosition < 0 || appStartPosition < hydrationPosition) {
  throw new Error('App scripts are not gated behind native storage hydration.');
}
if (/Preferences\.clear\s*\(/.test(bridge)) throw new Error('Native storage clears unrelated Preferences values.');

for (const token of [
  "from 'esbuild'",
  "EARLY_SCRIPTS = new Set(['platform.js?v=1', 'storage.js?v=1'])",
  '__FARSI_NATIVE_APP_SCRIPTS__',
  'native-bridge.js',
  'deferredAppScripts'
]) {
  if (!build.includes(token)) throw new Error(`Native build is missing ${token}.`);
}

for (const token of [
  'AppIcon.appiconset',
  'LaunchBackground.colorset',
  'LaunchMark.imageset',
  'PrivacyInfo.xcprivacy',
  '<key>UILaunchScreen</key>'
]) {
  if (!configure.includes(token)) throw new Error(`iOS configuration is missing ${token}.`);
}

if (!privacy.includes('NSPrivacyAccessedAPICategoryUserDefaults') || !privacy.includes('<string>CA92.1</string>')) {
  throw new Error('Preferences privacy-manifest reason is missing.');
}
if (!ignore.includes('node_modules/') || !ignore.includes('dist/') || ignore.includes('\nios/\n')) {
  throw new Error('Generated web output should be ignored without excluding the future iOS project.');
}
if (settings.includes('connected during the Xcode step') || settings.includes('activated during the Xcode notification step')) {
  throw new Error('Settings still claims the native reminder adapter is not connected.');
}

console.log('Capacitor configuration, startup gating, native adapters, and iOS handoff checks passed.');
