const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IOS = path.join(ROOT, 'ios');
const projectPath = path.join(IOS, 'App', 'App.xcodeproj', 'project.pbxproj');

if (!fs.existsSync(projectPath)) {
  console.log('iOS project has not been generated yet; the macOS generation workflow owns first creation.');
  process.exit(0);
}

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const requiredFiles = [
  'package-lock.json',
  'ios/.gitignore',
  'ios/App/App.xcodeproj/project.pbxproj',
  'ios/App/App/AppDelegate.swift',
  'ios/App/App/Info.plist',
  'ios/App/App/Base.lproj/Main.storyboard',
  'ios/App/App/Base.lproj/LaunchScreen.storyboard',
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png',
  'ios/App/App/Assets.xcassets/LaunchBackground.colorset/Contents.json',
  'ios/App/App/Assets.xcassets/LaunchMark.imageset/LaunchMark@3x.png',
  'ios/App/App/PrivacyInfo.xcprivacy',
  'ios/App/CapApp-SPM/Package.swift',
  'ios/BUILD_VERIFICATION.md'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(ROOT, file))) throw new Error(`Generated iOS project is missing ${file}.`);
}

const project = read('ios/App/App.xcodeproj/project.pbxproj');
for (const token of [
  'PRODUCT_BUNDLE_IDENTIFIER = com.farsidaily.app;',
  'CapApp-SPM in Frameworks',
  'PrivacyInfo.xcprivacy in Resources',
  'ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;',
  'CODE_SIGN_STYLE = Automatic;'
]) {
  if (!project.includes(token)) throw new Error(`Xcode project is missing ${token}`);
}

const info = read('ios/App/App/Info.plist');
if (!info.includes('<string>Farsi Daily</string>')) throw new Error('Info.plist is missing the Farsi Daily display name.');
if (!info.includes('<key>UILaunchStoryboardName</key>')) throw new Error('Info.plist is missing the launch storyboard key.');

const launch = read('ios/App/App/Base.lproj/LaunchScreen.storyboard');
for (const token of ['image="LaunchMark"', 'name="LaunchBackground"', 'centerX', 'centerY']) {
  if (!launch.includes(token)) throw new Error(`Launch storyboard is missing ${token}`);
}

const privacy = read('ios/App/App/PrivacyInfo.xcprivacy');
if (!privacy.includes('NSPrivacyAccessedAPICategoryUserDefaults') || !privacy.includes('CA92.1')) {
  throw new Error('Bundled iOS privacy manifest is incomplete.');
}

const swiftPackage = read('ios/App/CapApp-SPM/Package.swift');
for (const token of ['Capacitor', 'CapacitorHaptics', 'CapacitorLocalNotifications', 'CapacitorPreferences', 'CapacitorShare']) {
  if (!swiftPackage.includes(token)) throw new Error(`CapApp-SPM is missing ${token}.`);
}

const report = read('ios/BUILD_VERIFICATION.md');
if (!report.includes('Simulator build: passed')) throw new Error('The committed iOS build verification is not marked passed.');

console.log('Generated Xcode project, native packages, launch assets, privacy manifest, and simulator verification passed.');
