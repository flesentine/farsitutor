import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IOS_ROOT = path.join(ROOT, 'ios', 'App');
const IOS_APP = path.join(IOS_ROOT, 'App');
const DEST_CATALOG = path.join(IOS_APP, 'Assets.xcassets');
const SOURCE_CATALOG = path.join(ROOT, 'app-store-assets', 'Assets.xcassets');
const ASSET_SETS = ['AppIcon.appiconset', 'LaunchBackground.colorset', 'LaunchMark.imageset'];
const privacyPath = path.join(IOS_APP, 'PrivacyInfo.xcprivacy');
const projectPath = path.join(IOS_ROOT, 'App.xcodeproj', 'project.pbxproj');
const launchStoryboardPath = path.join(IOS_APP, 'Base.lproj', 'LaunchScreen.storyboard');

function projectId(seed) {
  return createHash('sha1').update(`farsi-daily:${seed}`).digest('hex').slice(0, 24).toUpperCase();
}

function insertAfter(source, marker, value, label) {
  if (!source.includes(marker)) throw new Error(`Could not find ${label} marker in the Xcode project.`);
  return source.replace(marker, `${marker}\n${value}`);
}

function addPrivacyManifestToProject(source) {
  if (source.includes('PrivacyInfo.xcprivacy in Resources')) return source;

  const fileId = projectId('privacy-file');
  const buildId = projectId('privacy-build');
  let project = source;

  project = insertAfter(
    project,
    '/* Begin PBXBuildFile section */',
    `\t\t${buildId} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${fileId} /* PrivacyInfo.xcprivacy */; };`,
    'PBXBuildFile'
  );
  project = insertAfter(
    project,
    '/* Begin PBXFileReference section */',
    `\t\t${fileId} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };`,
    'PBXFileReference'
  );

  const appGroupPattern = /(\t\t[A-F0-9]{24} \/\* App \*\/ = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n)([\s\S]*?)(\t\t\t\);\n\t\t\tpath = App;)/;
  if (!appGroupPattern.test(project)) throw new Error('Could not locate the App PBXGroup.');
  project = project.replace(appGroupPattern, `$1\t\t\t\t${fileId} /* PrivacyInfo.xcprivacy */,\n$2$3`);

  const resourcesPattern = /(\t\t[A-F0-9]{24} \/\* Resources \*\/ = \{\n\t\t\tisa = PBXResourcesBuildPhase;[\s\S]*?\t\t\tfiles = \(\n)([\s\S]*?)(\t\t\t\);)/;
  if (!resourcesPattern.test(project)) throw new Error('Could not locate the app Resources build phase.');
  project = project.replace(resourcesPattern, `$1\t\t\t\t${buildId} /* PrivacyInfo.xcprivacy in Resources */,\n$2$3`);

  return project;
}

function configureSigning(source) {
  const team = String(process.env.APPLE_DEVELOPMENT_TEAM || '').trim();
  if (!team) return source;
  if (!/^[A-Z0-9]{10}$/.test(team)) {
    throw new Error('APPLE_DEVELOPMENT_TEAM must be a 10-character Apple Developer Team ID.');
  }

  let project = source.replace(/^\s*DEVELOPMENT_TEAM = [A-Z0-9]+;\n/gm, '');
  project = project.replace(
    /(\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com\.farsidaily\.app;)/g,
    `\t\t\t\tDEVELOPMENT_TEAM = ${team};\n$1`
  );
  return project;
}

const launchStoryboard = `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="23096" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="FD0-VC-001">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="23084"/>
        <capability name="Named colors" minToolsVersion="9.0"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="FD0-SCENE-001">
            <objects>
                <viewController id="FD0-VC-001" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="FD0-VIEW-001">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <subviews>
                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" image="LaunchMark" translatesAutoresizingMaskIntoConstraints="NO" id="FD0-IMAGE-001">
                                <rect key="frame" x="116.5" y="346" width="160" height="160"/>
                                <constraints>
                                    <constraint firstAttribute="width" constant="160" id="FD0-WIDTH-001"/>
                                    <constraint firstAttribute="height" constant="160" id="FD0-HEIGHT-001"/>
                                </constraints>
                            </imageView>
                        </subviews>
                        <viewLayoutGuide key="safeArea" id="FD0-SAFE-001"/>
                        <color key="backgroundColor" name="LaunchBackground"/>
                        <constraints>
                            <constraint firstItem="FD0-IMAGE-001" firstAttribute="centerX" secondItem="FD0-VIEW-001" secondAttribute="centerX" id="FD0-CENTER-X"/>
                            <constraint firstItem="FD0-IMAGE-001" firstAttribute="centerY" secondItem="FD0-VIEW-001" secondAttribute="centerY" id="FD0-CENTER-Y"/>
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="FD0-FIRST-001" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
        </scene>
    </scenes>
    <resources>
        <image name="LaunchMark" width="160" height="160"/>
        <namedColor name="LaunchBackground">
            <color red="0.968627451" green="0.968627451" blue="0.9882352941" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
        </namedColor>
    </resources>
</document>
`;

await mkdir(DEST_CATALOG, { recursive: true });
for (const assetSet of ASSET_SETS) {
  const destination = path.join(DEST_CATALOG, assetSet);
  await rm(destination, { recursive: true, force: true });
  await cp(path.join(SOURCE_CATALOG, assetSet), destination, { recursive: true });
}
await rm(path.join(DEST_CATALOG, 'Splash.imageset'), { recursive: true, force: true });

await cp(path.join(ROOT, 'native', 'PrivacyInfo.xcprivacy'), privacyPath);
await writeFile(launchStoryboardPath, launchStoryboard);

const infoPath = path.join(IOS_APP, 'Info.plist');
let info = await readFile(infoPath, 'utf8');
info = info.replace(
  /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
  '<key>CFBundleDisplayName</key>\n\t<string>Farsi Daily</string>'
);
info = info.replace(/\s*<key>UILaunchScreen<\/key>\s*<dict>[\s\S]*?<\/dict>/, '');
await writeFile(infoPath, info);

let project = await readFile(projectPath, 'utf8');
project = addPrivacyManifestToProject(project);
project = configureSigning(project);
await writeFile(projectPath, project);

console.log(
  `Applied Farsi Daily icons, branded launch storyboard, bundled PrivacyInfo.xcprivacy${process.env.APPLE_DEVELOPMENT_TEAM ? ', and signing team' : ''}.`
);
