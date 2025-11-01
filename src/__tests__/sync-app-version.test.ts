import fs from 'fs';
import os from 'os';
import path from 'path';

const TEMP_PREFIX = path.join(os.tmpdir(), 'todolo-sync-version-test-');

function createPackageFixtures(options?: {
  rootVersion?: string;
  appVersion?: string;
}) {
  const rootVersion = options?.rootVersion ?? '0.0.1';
  const appVersion = options?.appVersion ?? '0.0.0';

  const tempDir = fs.mkdtempSync(TEMP_PREFIX);
  const rootPkgPath = path.join(tempDir, 'package.json');
  const appDir = path.join(tempDir, 'release', 'app');
  const appPkgPath = path.join(appDir, 'package.json');

  fs.mkdirSync(appDir, { recursive: true });

  fs.writeFileSync(
    rootPkgPath,
    `${JSON.stringify(
      {
        name: 'root-test',
        version: rootVersion,
      },
      null,
      2,
    )}\n`,
  );

  fs.writeFileSync(
    appPkgPath,
    `${JSON.stringify(
      {
        name: 'app-test',
        version: appVersion,
      },
      null,
      2,
    )}\n`,
  );

  return { tempDir, rootPkgPath, appPkgPath };
}

describe('sync-app-version script', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('updates both root and app package versions when VERSION env is provided', () => {
    const { tempDir, rootPkgPath, appPkgPath } = createPackageFixtures({
      rootVersion: '1.0.0',
      appVersion: '0.1.0',
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { syncAppVersion } = require('../../.erb/scripts/sync-app-version');

    const execMock = jest.fn();

    syncAppVersion({
      rootPkgPath,
      appPkgPath,
      envVersion: 'v1.5.4',
      execSyncImpl: execMock,
    });

    const updatedRoot = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    const updatedApp = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));

    expect(updatedRoot.version).toBe('1.5.4');
    expect(updatedApp.version).toBe('1.5.4');

    expect(execMock).toHaveBeenCalledWith(`git add ${rootPkgPath}`, {
      stdio: 'ignore',
    });
    expect(execMock).toHaveBeenCalledWith(`git add ${appPkgPath}`, {
      stdio: 'ignore',
    });

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('falls back to root package version when VERSION env is not provided', () => {
    const { tempDir, rootPkgPath, appPkgPath } = createPackageFixtures({
      rootVersion: '2.3.4',
      appVersion: '1.0.0',
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { syncAppVersion } = require('../../.erb/scripts/sync-app-version');

    const execMock = jest.fn();

    syncAppVersion({
      rootPkgPath,
      appPkgPath,
      execSyncImpl: execMock,
    });

    const updatedApp = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
    expect(updatedApp.version).toBe('2.3.4');

    // root file should remain unchanged
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    expect(rootPkg.version).toBe('2.3.4');

    // Only app package should be staged (no change to root)
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`git add ${appPkgPath}`, {
      stdio: 'ignore',
    });

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
