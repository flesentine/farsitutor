import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IOS_APP = path.join(ROOT, 'ios', 'App', 'App');
const DEST_CATALOG = path.join(IOS_APP, 'Assets.xcassets');
const SOURCE_CATALOG = path.join(ROOT, 'app-store-assets', 'Assets.xcassets');
const ASSET_SETS = ['AppIcon.appiconset', 'LaunchBackground.colorset', 'LaunchMark.imageset'];

await mkdir(DEST_CATALOG, { recursive: true });
for (const assetSet of ASSET_SETS) {
  const destination = path.join(DEST_CATALOG, assetSet);
  await rm(destination, { recursive: true, force: true });
  await cp(path.join(SOURCE_CATALOG, assetSet), destination, { recursive: true });
}

await cp(
  path.join(ROOT, 'native', 'PrivacyInfo.xcprivacy'),
  path.join(IOS_APP, 'PrivacyInfo.xcprivacy')
);

const infoPath = path.join(IOS_APP, 'Info.plist');
let info = await readFile(infoPath, 'utf8');
if (!info.includes('<key>UILaunchScreen</key>')) {
  const launchDictionary = `\n\t<key>UILaunchScreen</key>\n\t<dict>\n\t\t<key>UIColorName</key>\n\t\t<string>LaunchBackground</string>\n\t\t<key>UIImageName</key>\n\t\t<string>LaunchMark</string>\n\t\t<key>UIImageRespectsSafeAreaInsets</key>\n\t\t<true/>\n\t</dict>`;
  const closing = '\n</dict>\n</plist>';
  if (!info.includes(closing)) throw new Error('Could not safely update ios/App/App/Info.plist.');
  info = info.replace(closing, `${launchDictionary}${closing}`);
  await writeFile(infoPath, info);
}

console.log('Applied Farsi Daily icons, launch assets, and PrivacyInfo.xcprivacy to the iOS project.');
