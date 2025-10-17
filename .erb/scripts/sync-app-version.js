const fs = require('fs');
const path = require('path');

const rootPkgPath = path.join(__dirname, '../..', 'package.json');
const appPkgPath = path.join(
  __dirname,
  '../..',
  'release',
  'app',
  'package.json',
);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  const content = `${JSON.stringify(obj, null, 2)}\n`;
  fs.writeFileSync(p, content, 'utf8');
}

function main() {
  const appPkg = readJson(appPkgPath);

  // Prefer explicit VERSION env (e.g., from tag name in CI)
  let targetVersion = process.env.VERSION;
  if (targetVersion) {
    // Normalize: strip leading 'v' if present
    targetVersion = String(targetVersion).replace(/^v/i, '');
  } else {
    // Fallback to root package.json version locally
    const rootPkg = readJson(rootPkgPath);
    if (!rootPkg.version) {
      console.error('Root package.json has no version');
      process.exit(1);
    }
    targetVersion = rootPkg.version;
  }

  if (appPkg.version === targetVersion) {
    console.log(`App version already ${targetVersion}`);
  } else {
    appPkg.version = targetVersion;
    writeJson(appPkgPath, appPkg);
    console.log(`Synced app version to ${targetVersion}`);
  }

  // Stage the change when used during `npm version`
  try {
    require('child_process').execSync(`git add ${appPkgPath}`, {
      stdio: 'ignore',
    });
  } catch {
    // ignore if git not available
  }
}

main();
