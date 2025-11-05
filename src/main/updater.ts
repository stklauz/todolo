/* eslint-disable no-console */
import { app, dialog, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

/**
 * Initialize auto-updater with sensible defaults.
 * - Only active in production and when AUTO_UPDATER !== 'false'
 * - Uses GitHub Releases per electron-builder config
 */
export function initAutoUpdater(mainWindow?: BrowserWindow | null) {
  try {
    // Avoid auto-downloading pre-releases unless explicitly allowed
    autoUpdater.allowPrerelease = process.env.ALLOW_PRERELEASE === 'true';
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('error', (err) => {
      console.warn('[Updater] error:', err?.message || err);
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[Updater] Update available:', info.version);
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[Updater] No updates available');
    });

    autoUpdater.on('download-progress', (progress) => {
      console.log(
        `[Updater] Download progress: ${progress.percent.toFixed(1)}% (${Math.round(progress.transferred / 1024 / 1024)}MB/${Math.round(progress.total / 1024 / 1024)}MB)`,
      );
    });

    autoUpdater.on('update-downloaded', async (info) => {
      console.log('[Updater] Update downloaded:', info.version);
      // Prompt user to restart now
      const dialogOptions = {
        type: 'info' as const,
        title: 'Update Ready',
        message: 'A new version has been downloaded. Restart to apply now?',
        buttons: ['Restart', 'Later'],
        defaultId: 0,
        cancelId: 1,
      };
      const resp = mainWindow
        ? await dialog.showMessageBox(mainWindow, dialogOptions)
        : await dialog.showMessageBox(dialogOptions);
      if (resp.response === 0) {
        setImmediate(() => autoUpdater.quitAndInstall());
      }
    });

    // Kick off check; also periodically re-check if desired
    void autoUpdater.checkForUpdatesAndNotify({
      title: 'Todolo Update Available',
      body: 'A new version is available and will be downloaded.',
    });

    const intervalMin = Number.parseInt(
      process.env.UPDATE_CHECK_INTERVAL_MIN || '240',
      10,
    ); // default 4h
    if (intervalMin > 0) {
      const interval = setInterval(
        () => {
          if (!app.isReady()) return;
          void autoUpdater
            .checkForUpdatesAndNotify()
            .catch((err) =>
              console.warn('[Updater] Periodic check failed:', err),
            );
        },
        intervalMin * 60 * 1000,
      );
      if (typeof (interval as any).unref === 'function')
        (interval as any).unref();
    }
  } catch (e) {
    console.warn('[Updater] Failed to initialize:', e);
  }
}
