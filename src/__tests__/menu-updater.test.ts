import type { BrowserWindow } from 'electron';

jest.mock('electron-updater', () => {
  const quitAndInstall = jest.fn();
  const downloadUpdate = jest.fn();
  const checkForUpdates = jest.fn();
  return {
    autoUpdater: {
      autoDownload: false,
      checkForUpdates,
      downloadUpdate,
      quitAndInstall,
      on: jest.fn(),
    },
  };
});

jest.mock('electron', () => {
  return {
    app: {
      getVersion: () => '1.0.0',
    },
    dialog: {
      showMessageBox: jest
        .fn()
        // First call: prompt to download
        .mockResolvedValueOnce({ response: 0 })
        // Second call: prompt to restart
        .mockResolvedValueOnce({ response: 0 }),
    },
  };
});

describe('menu manual updater flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('downloads and installs update when user confirms', async () => {
    const { autoUpdater } = require('electron-updater');
    const { dialog } = require('electron');

    // Simulate an update available (latest > current)
    autoUpdater.checkForUpdates.mockResolvedValue({
      updateInfo: { version: '1.1.0' },
    });
    autoUpdater.downloadUpdate.mockResolvedValue({});

    const MenuBuilder = require('../main/menu').default;
    const fakeWin = { webContents: {} } as unknown as BrowserWindow;
    const builder = new MenuBuilder(fakeWin);

    // Access private method for unit test purposes
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await builder.checkForUpdatesManually();

    expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
    expect(dialog.showMessageBox).toHaveBeenCalled();
    expect(autoUpdater.downloadUpdate).toHaveBeenCalled();
    expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
  });
});
