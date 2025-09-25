/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import fs from 'fs';
import { exec } from 'child_process';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

// Storage helpers (legacy single-file and new per-list layout)
const getUserDataDir = () => app.getPath('userData');
const getLegacyTodosPath = () => path.join(getUserDataDir(), 'todos.json');
const getDataDir = () => path.join(getUserDataDir(), 'data');
const getListsIndexPath = () => path.join(getDataDir(), 'lists.json');
const getListTodosPath = (listId: string) => path.join(getDataDir(), `list-${listId}.json`);
const ensureDataDir = () => {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Self-update mechanism for unsigned apps
const performSelfUpdate = (info: any): Promise<boolean> => {
  return new Promise((resolve) => {
    const updatePath = `/Users/claudiacarvalho/Library/Caches/todolo-updater/pending/Todolo-${info.version}-arm64-mac.zip`;
    const tempDir = '/tmp/todolo-update';
    const appPath = '/Applications/Todolo.app';
    
    // Show progress dialog
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Installing Update',
        message: `Installing Todolo ${info.version}...\n\nThis will require your admin password in the next step.\n\nIf you don't have admin privileges, the update will fail and you'll be directed to manual installation.`,
        buttons: ['Cancel'],
        defaultId: 0,
      }).catch(() => {}); // Ignore if user closes dialog
    }
    
    if (!fs.existsSync(updatePath)) {
      log.error('Update file not found:', updatePath);
      showUpdateError(`Update file not found. Please download manually from:\nhttps://github.com/stklauz/todolo/releases`);
      resolve(false);
      return;
    }

    try {
      // Extract the update
      exec(`mkdir -p "${tempDir}" && cd "${tempDir}" && unzip -q "${updatePath}"`, (error) => {
        if (error) {
          log.error('Failed to extract update:', error);
          showUpdateError(`Failed to extract update file. Please try downloading manually from:\nhttps://github.com/stklauz/todolo/releases`);
          resolve(false);
          return;
        }

        // Create update script with better error handling
        const updateScript = `#!/bin/bash
set -e  # Exit on any error

echo "Starting Todolo update..."
echo "Version: ${info.version}"

# Check if we can write to Applications folder
if [ ! -w "/Applications" ]; then
    echo "Error: Cannot write to Applications folder. Admin privileges required."
    exit 1
fi

# Remove old app
echo "Removing old version..."
if [ -d "${appPath}" ]; then
    rm -rf "${appPath}"
    echo "Old version removed."
else
    echo "Warning: Old version not found at ${appPath}"
fi

# Install new app
echo "Installing new version..."
if [ -d "${tempDir}/Todolo.app" ]; then
    cp -R "${tempDir}/Todolo.app" "${appPath}"
    echo "New version installed successfully."
else
    echo "Error: New app not found in extracted files."
    exit 1
fi

# Clean up
echo "Cleaning up..."
rm -rf "${tempDir}"
rm -f "/tmp/update-todolo.sh"

echo "Update complete! Starting Todolo..."
open "${appPath}"
`;

        const scriptPath = '/tmp/update-todolo.sh';
        fs.writeFileSync(scriptPath, updateScript);
        fs.chmodSync(scriptPath, '755');

        // Run the update script
        exec(`osascript -e 'do shell script "bash ${scriptPath}" with administrator privileges'`, (execError, stdout, stderr) => {
          if (execError) {
            log.error('Failed to run update script:', execError);
            log.error('Script stderr:', stderr);
            
            // Show specific error based on the error type
            let errorMessage = `Automatic update failed.\n\n`;
            
            if (execError.message.includes('User canceled') || execError.message.includes('canceled')) {
              errorMessage += `You canceled the update. You can try again or update manually.`;
            } else if (execError.message.includes('not allowed')) {
              errorMessage += `Permission denied. Please try running the app with administrator privileges or update manually.`;
            } else {
              errorMessage += `Error: ${execError.message}\n\nPlease update manually from:\nhttps://github.com/stklauz/todolo/releases`;
            }
            
            showUpdateError(errorMessage);
            resolve(false);
          } else {
            log.info('Update script completed successfully');
            log.info('Script output:', stdout);
            // Update successful, quit the current app
            setTimeout(() => {
              app.quit();
            }, 1000); // Give a moment for the log
            resolve(true);
          }
        });
      });

    } catch (error) {
      log.error('Self-update failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showUpdateError(`Update failed: ${errorMessage}\n\nPlease update manually from:\nhttps://github.com/stklauz/todolo/releases`);
      resolve(false);
    }
  });
};

// Helper function to show update errors with consistent formatting
const showUpdateError = (message: string) => {
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Failed',
      message: message,
      buttons: ['Open Releases Page', 'OK'],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) {
        shell.openExternal('https://github.com/stklauz/todolo/releases');
      }
    }).catch((e) => log.warn('Error dialog failed:', e));
  }
};

class AppUpdater {
  constructor(window?: BrowserWindow | null) {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    autoUpdater.autoDownload = true;

    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version);
      if (window) {
        dialog
          .showMessageBox(window, {
            type: 'info',
            title: 'Update Available',
            message: `A new version (${info.version}) is available. It will download in the background.`,
            buttons: ['OK'],
            defaultId: 0,
          })
          .catch((e) => log.warn('Update available dialog error', e));
      }
    });

    autoUpdater.on('download-progress', (progress) => {
      log.info(
        `Download speed: ${Math.round(progress.bytesPerSecond / 1024)} KB/s - ` +
          `Downloaded ${Math.round(progress.percent)}% (${progress.transferred}/${progress.total})`,
      );
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
      if (window) {
        dialog
          .showMessageBox(window, {
            type: 'question',
            title: 'Update Ready',
            message: `Update ${info.version} is ready! Choose how to install:\n\n• "Install Now" - Attempts automatic installation (may require admin password)\n• "Manual Install" - Opens download page for manual installation`,
            buttons: ['Install Now', 'Manual Install', 'Later'],
            defaultId: 0,
            cancelId: 2,
          })
          .then((result) => {
            if (result.response === 0) {
              // Try self-update mechanism
              performSelfUpdate(info).then((success) => {
                if (!success) {
                  // Fallback to manual instructions (already handled in performSelfUpdate)
                  log.info('Self-update failed, user should see error dialog');
                }
              }).catch((error) => {
                log.error('Self-update promise rejected:', error);
                showUpdateError(`Update failed unexpectedly: ${error.message}\n\nPlease update manually from:\nhttps://github.com/stklauz/todolo/releases`);
              });
            } else if (result.response === 1) {
              // Open GitHub releases page
              shell.openExternal('https://github.com/stklauz/todolo/releases');
            }
          })
          .catch((e) => log.warn('Update downloaded dialog error', e));
      } else {
        // Fallback if no window is present - try self-update
        performSelfUpdate(info).then((success) => {
          if (!success) {
            shell.openExternal('https://github.com/stklauz/todolo/releases');
          }
        }).catch((error) => {
          log.error('Self-update failed in fallback mode:', error);
          shell.openExternal('https://github.com/stklauz/todolo/releases');
        });
      }
    });

    // Handle download failures
    autoUpdater.on('error', (err) => {
      log.error('Auto update error:', err);
      
      // Check if it's a download-specific error
      if (err.message.includes('download') || err.message.includes('network') || err.message.includes('timeout')) {
        if (window) {
          dialog.showMessageBox(window, {
            type: 'warning',
            title: 'Download Failed',
            message: `Failed to download update: ${err.message}\n\nThis might be due to:\n• Network connectivity issues\n• Firewall blocking the download\n• Server temporarily unavailable\n\nYou can try again later or download manually.`,
            buttons: ['Retry Download', 'Manual Download', 'OK'],
            defaultId: 0,
          }).then((result) => {
            if (result.response === 0) {
              // Retry the download
              autoUpdater.checkForUpdatesAndNotify();
            } else if (result.response === 1) {
              shell.openExternal('https://github.com/stklauz/todolo/releases');
            }
          }).catch((e) => log.warn('Download error dialog failed:', e));
        }
      } else {
        // General error handling (already implemented above)
        if (window) {
          dialog.showMessageBox(window, {
            type: 'warning',
            title: 'Update Error',
            message: `Failed to check for updates: ${err.message}\n\nYou can manually check for updates at:\nhttps://github.com/stklauz/todolo/releases`,
            buttons: ['Open Releases Page', 'OK'],
            defaultId: 0,
          }).then((result) => {
            if (result.response === 0) {
              shell.openExternal('https://github.com/stklauz/todolo/releases');
            }
          }).catch((e) => log.warn('Error dialog failed:', e));
        }
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
      if (window) {
        dialog
          .showMessageBox(window, {
            type: 'question',
            title: 'Update Ready',
            message: `Update ${info.version} is ready! Choose how to install:\n\n• "Install Now" - Attempts automatic installation (may require admin password)\n• "Manual Install" - Opens download page for manual installation`,
            buttons: ['Install Now', 'Manual Install', 'Later'],
            defaultId: 0,
            cancelId: 2,
          })
          .then((result) => {
            if (result.response === 0) {
              // Try self-update mechanism
              performSelfUpdate(info).then((success) => {
                if (!success) {
                  // Fallback to manual instructions (already handled in performSelfUpdate)
                  log.info('Self-update failed, user should see error dialog');
                }
              }).catch((error) => {
                log.error('Self-update promise rejected:', error);
                showUpdateError(`Update failed unexpectedly: ${error.message}\n\nPlease update manually from:\nhttps://github.com/stklauz/todolo/releases`);
              });
            } else if (result.response === 1) {
              // Open GitHub releases page
              shell.openExternal('https://github.com/stklauz/todolo/releases');
            }
          })
          .catch((e) => log.warn('Update downloaded dialog error', e));
      } else {
        // Fallback if no window is present - try self-update
        performSelfUpdate(info).then((success) => {
          if (!success) {
            shell.openExternal('https://github.com/stklauz/todolo/releases');
          }
        }).catch((error) => {
          log.error('Self-update failed in fallback mode:', error);
          shell.openExternal('https://github.com/stklauz/todolo/releases');
        });
      }
    });

    autoUpdater.on('update-not-available', () => {
      log.info('No updates available');
    });

    // Start the check on startup
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

// IPC handlers for todo operations
ipcMain.on('save-todos', async (event, todos) => {
  try {
    const target = getLegacyTodosPath();
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(todos));
    fs.renameSync(tmp, target);
    event.reply('save-todos', { success: true });
  } catch (error) {
    console.error('Failed to save todos:', error);
    event.reply('save-todos', { success: false, error });
  }
});

ipcMain.handle('load-todos', async () => {
  try {
    if (fs.existsSync(getLegacyTodosPath())) {
      const data = fs.readFileSync(getLegacyTodosPath(), 'utf-8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Failed to load todos:', error);
    return [];
  }
});

// New IPC: per-list storage
ipcMain.handle('load-lists', async () => {
  try {
    ensureDataDir();
    const listsPath = getListsIndexPath();
    // If index exists, load and return
    if (fs.existsSync(listsPath)) {
      const raw = fs.readFileSync(listsPath, 'utf-8');
      const data = JSON.parse(raw);
      return data;
    }
    // Migration from legacy
    const legacyPath = getLegacyTodosPath();
    if (fs.existsSync(legacyPath)) {
      const rawLegacy = fs.readFileSync(legacyPath, 'utf-8');
      let migratedIndex: any;
      try {
        const parsed = JSON.parse(rawLegacy);
        if (Array.isArray(parsed)) {
          // Legacy array -> single list
          const id = `${Date.now()}`;
          const now = new Date().toISOString();
          const index = { version: 2, lists: [{ id, name: 'My Todos', createdAt: now }], selectedListId: id };
          const todosDoc = { version: 2, todos: parsed };
          const todosPath = getListTodosPath(id);
          const tmpTodos = `${todosPath}.tmp`;
          fs.writeFileSync(tmpTodos, JSON.stringify(todosDoc));
          fs.renameSync(tmpTodos, todosPath);
          migratedIndex = index;
        } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).lists)) {
          const lists = (parsed as any).lists.map((l: any, i: number) => ({
            id: typeof l.id === 'string' ? l.id : String(i + 1),
            name: typeof l.name === 'string' ? l.name : `List ${i + 1}`,
            createdAt: l.createdAt || new Date().toISOString(),
            updatedAt: l.updatedAt || l.createdAt || undefined,
          }));
          // Write each list's todos
          lists.forEach((l: any, i: number) => {
            const todos = Array.isArray((parsed as any).lists?.[i]?.todos) ? (parsed as any).lists[i].todos : [];
            const doc = { version: 2, todos };
            const p = getListTodosPath(l.id);
            const tmp = `${p}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(doc));
            fs.renameSync(tmp, p);
          });
          migratedIndex = { version: 2, lists, selectedListId: (parsed as any).selectedListId };
        }
      } catch (e) {
        console.error('Failed parsing legacy todos for migration', e);
      }
      if (migratedIndex) {
        const tmp = `${listsPath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(migratedIndex));
        fs.renameSync(tmp, listsPath);
        return migratedIndex;
      }
    }
    // Fresh install default
    const fresh = { version: 2, lists: [], selectedListId: undefined } as const;
    const tmp = `${listsPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(fresh));
    fs.renameSync(tmp, listsPath);
    return fresh;
  } catch (error) {
    console.error('Failed to load lists:', error);
    return { version: 2, lists: [], selectedListId: undefined };
  }
});

ipcMain.handle('save-lists', async (_event, indexDoc: any) => {
  try {
    ensureDataDir();
    const target = getListsIndexPath();
    const tmp = `${target}.tmp`;
    // Keep backup of previous version
    if (fs.existsSync(target)) {
      fs.copyFileSync(target, `${target}.bak`);
    }
    fs.writeFileSync(tmp, JSON.stringify(indexDoc));
    fs.renameSync(tmp, target);
    return { success: true };
  } catch (error) {
    console.error('Failed to save lists:', error);
    // Try to restore backup on failure
    const target = getListsIndexPath();
    const backup = `${target}.bak`;
    if (fs.existsSync(backup)) {
      try {
        fs.copyFileSync(backup, target);
      } catch (restoreError) {
        console.error('Failed to restore backup:', restoreError);
      }
    }
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('load-list-todos', async (_event, listId: string) => {
  try {
    ensureDataDir();
    const p = getListTodosPath(listId);
    if (!fs.existsSync(p)) return { version: 2, todos: [] };
    const raw = fs.readFileSync(p, 'utf-8');
    const doc = JSON.parse(raw);
    if (doc && typeof doc === 'object' && Array.isArray((doc as any).todos)) return doc;
    return { version: 2, todos: [] };
  } catch (error) {
    console.error('Failed to load list todos:', error);
    return { version: 2, todos: [] };
  }
});

ipcMain.handle('save-list-todos', async (_event, listId: string, todosDoc: any) => {
  try {
    ensureDataDir();
    const target = getListTodosPath(listId);
    const tmp = `${target}.tmp`;
    // Keep backup of previous version
    if (fs.existsSync(target)) {
      fs.copyFileSync(target, `${target}.bak`);
    }
    fs.writeFileSync(tmp, JSON.stringify(todosDoc));
    fs.renameSync(tmp, target);
    return { success: true };
  } catch (error) {
    console.error('Failed to save list todos:', error);
    // Try to restore backup on failure
    const target = getListTodosPath(listId);
    const backup = `${target}.bak`;
    if (fs.existsSync(backup)) {
      try {
        fs.copyFileSync(backup, target);
      } catch (restoreError) {
        console.error('Failed to restore backup:', restoreError);
      }
    }
    return { success: false, error: String(error) };
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icons/icon.png'),
    frame: false,
    titleBarStyle: 'hiddenInset',
    // Optionally adjust traffic light position on macOS later if needed
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Auto updates: show notifications and prompt to install when ready
  // eslint-disable-next-line
  new AppUpdater(mainWindow);
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
