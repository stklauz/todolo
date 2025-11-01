const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const defaultRootPkgPath = path.join(__dirname, '../..', 'package.json');
const defaultAppPkgPath = path.join(
  __dirname,
  '../..',
  'release',
  'app',
  'package.json',
);

function readJson(fsImpl, filePath) {
  return JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
}

function writeJson(fsImpl, filePath, data) {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  fsImpl.writeFileSync(filePath, content, 'utf8');
}

function normalizeVersion(value) {
  if (!value) {
    return undefined;
  }

  return String(value).replace(/^v/i, '').trim();
}

function syncAppVersion({
  rootPkgPath = defaultRootPkgPath,
  appPkgPath = defaultAppPkgPath,
  envVersion,
  fsImpl = fs,
  execSyncImpl = execSync,
  logger = console,
} = {}) {
  const normalizedEnvVersion = normalizeVersion(envVersion);

  const rootPkg = readJson(fsImpl, rootPkgPath);
  const appPkg = readJson(fsImpl, appPkgPath);

  let targetVersion = normalizedEnvVersion;
  if (!targetVersion) {
    if (!rootPkg.version) {
      throw new Error('Root package.json has no version');
    }
    targetVersion = rootPkg.version;
  }

  const updatedFiles = [];

  if (normalizedEnvVersion && rootPkg.version !== targetVersion) {
    rootPkg.version = targetVersion;
    writeJson(fsImpl, rootPkgPath, rootPkg);
    logger.log(`Synced root package version to ${targetVersion}`);
    updatedFiles.push(rootPkgPath);
  } else {
    logger.log(`Root package version is ${rootPkg.version || targetVersion}`);
  }

  if (appPkg.version !== targetVersion) {
    appPkg.version = targetVersion;
    writeJson(fsImpl, appPkgPath, appPkg);
    logger.log(`Synced app version to ${targetVersion}`);
    updatedFiles.push(appPkgPath);
  } else {
    logger.log(`App version already ${targetVersion}`);
  }

  updatedFiles.forEach((filePath) => {
    try {
      execSyncImpl(`git add ${filePath}`, { stdio: 'ignore' });
    } catch {
      // ignore when git is not available (e.g., local testing)
    }
  });

  return { targetVersion, updatedFiles };
}

function main() {
  try {
    syncAppVersion({ envVersion: process.env.VERSION });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { syncAppVersion };
