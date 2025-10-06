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
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

// Import DB module only after userData path is finalized to avoid any
// accidental early reads of the default path inside the module.
import {
  loadListsIndex as dbLoadListsIndex,
  saveListsIndex as dbSaveListsIndex,
  loadListTodos as dbLoadListTodos,
  saveListTodos as dbSaveListTodos,
  loadAppSettings as dbLoadAppSettings,
  saveAppSettings as dbSaveAppSettings,
  duplicateList as dbDuplicateList,
  setSelectedListMeta as dbSetSelectedListMeta,
  closeDatabase,
} from './db';

// Separate Dev and Prod databases by using different userData paths.
// Development uses a dedicated Dev directory; production uses Electron defaults.
// Must run before any userData path is consumed.
if (!app.isPackaged) {
  try {
    const devUserData = path.join(
      app.getPath('appData'),
      `${app.getName()}-Dev`,
    );
    app.setPath('userData', devUserData);
    console.log(`[STORAGE] userData path (dev) -> ${devUserData}`);
  } catch (e) {
    console.warn('[STORAGE] Unable to set dev userData path', e);
  }
} else {
  console.log(`[STORAGE] userData path (prod) -> ${app.getPath('userData')}`);
}

// Auto-update logic removed per user request.

let mainWindow: BrowserWindow | null = null;

// New IPC: per-list storage (SQLite-backed)
ipcMain.handle('load-lists', async () => {
  const startTime = performance.now();
  try {
    console.log(`[PERF] Starting load-lists operation (sqlite)`);
    const data = dbLoadListsIndex();
    const duration = performance.now() - startTime;
    console.log(`[PERF] load-lists completed in ${duration.toFixed(2)}ms`);
    return data;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(
      `[PERF] load-lists failed after ${duration.toFixed(2)}ms:`,
      error,
    );
    return { version: 2, lists: [], selectedListId: undefined };
  }
});

ipcMain.handle('save-lists', async (_event, indexDoc: any) => {
  const startTime = performance.now();
  try {
    console.log(`[PERF] Starting save-lists operation (sqlite)`);
    const res = dbSaveListsIndex(indexDoc);
    const duration = performance.now() - startTime;
    console.log(`[PERF] save-lists completed in ${duration.toFixed(2)}ms`);
    return res;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(
      `[PERF] save-lists failed after ${duration.toFixed(2)}ms:`,
      error,
    );
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('load-list-todos', async (_event, listId: string) => {
  const startTime = performance.now();
  try {
    console.log(
      `[PERF] Starting load-list-todos operation for list ${listId} (sqlite)`,
    );
    const doc = dbLoadListTodos(listId);
    const duration = performance.now() - startTime;
    console.log(`[PERF] load-list-todos completed in ${duration.toFixed(2)}ms`);
    return doc;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(
      `[PERF] load-list-todos failed after ${duration.toFixed(2)}ms:`,
      error,
    );
    return { version: 2, todos: [] };
  }
});

ipcMain.handle(
  'save-list-todos',
  async (_event, listId: string, todosDoc: any) => {
    const startTime = performance.now();
    try {
      console.log(
        `[PERF] Starting save-list-todos for list ${listId} (sqlite)`,
      );
      const res = dbSaveListTodos(listId, todosDoc);
      const duration = performance.now() - startTime;
      console.log(
        `[PERF] save-list-todos completed in ${duration.toFixed(2)}ms`,
      );
      return res;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(
        `[PERF] save-list-todos failed after ${duration.toFixed(2)}ms:`,
        error,
      );
      return { success: false, error: String(error) };
    }
  },
);

ipcMain.handle('load-app-settings', async () => {
  const startTime = performance.now();
  try {
    console.log(`[PERF] Starting load-app-settings operation (sqlite)`);
    const data = dbLoadAppSettings();
    const duration = performance.now() - startTime;
    console.log(
      `[PERF] load-app-settings completed in ${duration.toFixed(2)}ms`,
    );
    return data;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(
      `[PERF] load-app-settings failed after ${duration.toFixed(2)}ms:`,
      error,
    );
    return { hideCompletedItems: true };
  }
});

ipcMain.handle('save-app-settings', async (_event, settings: any) => {
  const startTime = performance.now();
  try {
    console.log(`[PERF] Starting save-app-settings operation (sqlite)`);
    const res = dbSaveAppSettings(settings);
    const duration = performance.now() - startTime;
    console.log(
      `[PERF] save-app-settings completed in ${duration.toFixed(2)}ms`,
    );
    return res;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(
      `[PERF] save-app-settings failed after ${duration.toFixed(2)}ms:`,
      error,
    );
    return { success: false, error: String(error) };
  }
});

ipcMain.handle(
  'duplicate-list',
  async (_event, sourceListId: unknown, newListName?: unknown) => {
    const startTime = performance.now();
    try {
      console.log(`[PERF] Starting duplicate-list operation (sqlite)`);
      if (typeof sourceListId !== 'string' || sourceListId.trim() === '') {
        return { success: false, error: 'invalid_source_id' } as const;
      }
      const safeName =
        typeof newListName === 'string' ? newListName : undefined;
      const result = dbDuplicateList(sourceListId, safeName);
      const duration = performance.now() - startTime;
      console.log(
        `[PERF] duplicate-list completed in ${duration.toFixed(2)}ms`,
      );
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(
        `[PERF] duplicate-list failed after ${duration.toFixed(2)}ms:`,
        error,
      );
      return { success: false, error: 'internal_error' } as const;
    }
  },
);

ipcMain.handle('set-selected-list-meta', async (_event, listId: unknown) => {
  const startTime = performance.now();
  try {
    console.log(`[PERF] Starting set-selected-list-meta operation (sqlite)`);
    const safeListId = typeof listId === 'string' ? listId : null;
    dbSetSelectedListMeta(safeListId);
    const duration = performance.now() - startTime;
    console.log(
      `[PERF] set-selected-list-meta completed in ${duration.toFixed(2)}ms`,
    );
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(
      `[PERF] set-selected-list-meta failed after ${duration.toFixed(2)}ms:`,
      error,
    );
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

  // Updates are handled manually via the Help > Check for Updates menu.
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  console.log('[APP] All windows closed');
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('[APP] App is quitting, closing database...');
  // Ensure database is properly closed and all data is persisted
  closeDatabase();
});

// Handle app termination on macOS
app.on('will-quit', (event) => {
  console.log('[APP] App will quit, ensuring database is closed...');
  closeDatabase();
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
