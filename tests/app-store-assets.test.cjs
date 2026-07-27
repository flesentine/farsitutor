const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file));
const text = file => read(file).toString('utf8');

function png(file, width, height, alphaAllowed = true) {
  const bytes = read(file);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, 8).equals(signature)) throw new Error(`${file} is not a PNG.`);
  if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) {
    throw new Error(`${file} has the wrong dimensions.`);
  }
  const colorType = bytes[25];
  if (!alphaAllowed && [4, 6].includes(colorType)) throw new Error(`${file} contains an alpha channel.`);
}

png('app-store-assets/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png', 1024, 1024, false);
png('app-store-assets/Assets.xcassets/LaunchMark.imageset/LaunchMark.png', 160, 160);
png('app-store-assets/Assets.xcassets/LaunchMark.imageset/LaunchMark@2x.png', 320, 320);
png('app-store-assets/Assets.xcassets/LaunchMark.imageset/LaunchMark@3x.png', 480, 480);
png('assets/icons/apple-touch-icon-180.png', 180, 180, false);
png('assets/icons/farsi-daily-192.png', 192, 192, false);
png('assets/icons/farsi-daily-512.png', 512, 512, false);
png('assets/icons/farsi-daily-maskable-512.png', 512, 512, false);

const appIcon = JSON.parse(text('app-store-assets/Assets.xcassets/AppIcon.appiconset/Contents.json'));
const iconEntry = appIcon.images?.[0];
if (iconEntry?.filename !== 'AppIcon-1024.png' || iconEntry?.size !== '1024x1024' || iconEntry?.platform !== 'ios') {
  throw new Error('AppIcon asset catalog is not configured as a single iOS 1024 source.');
}

const launch = JSON.parse(text('app-store-assets/Assets.xcassets/LaunchMark.imageset/Contents.json'));
if ((launch.images || []).map(item => item.scale).join(',') !== '1x,2x,3x') {
  throw new Error('Launch mark does not include 1x, 2x, and 3x assets.');
}

const manifest = JSON.parse(text('manifest.json'));
for (const required of [
  'assets/icons/farsi-daily-192.png',
  'assets/icons/farsi-daily-512.png',
  'assets/icons/farsi-daily-maskable-512.png'
]) {
  if (!(manifest.icons || []).some(icon => icon.src === required)) throw new Error(`Web manifest is missing ${required}.`);
  if (!text('sw.js').includes(`'./${required}'`)) throw new Error(`Offline cache is missing ${required}.`);
}

const launchSnippet = text('app-store-assets/LaunchScreen.plist-snippet.xml');
for (const value of ['UILaunchScreen', 'LaunchBackground', 'LaunchMark', 'UIImageRespectsSafeAreaInsets']) {
  if (!launchSnippet.includes(value)) throw new Error(`Launch configuration is missing ${value}.`);
}

const screenshotPlan = text('app-store-assets/screenshots/README.md');
for (const size of ['1260 × 2736', '1290 × 2796', '1320 × 2868']) {
  if (!screenshotPlan.includes(size)) throw new Error(`Screenshot plan is missing ${size}.`);
}

console.log('App Store icon, launch assets, PWA icons, and capture plan passed.');
