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
import {
  loadListsIndex as dbLoadListsIndex,
  saveListsIndex as dbSaveListsIndex,
  loadListTodos as dbLoadListTodos,
  saveListTodos as dbSaveListTodos,
  closeDatabase,
} from './db';

// In development, point userData to the same directory name as production
// so the SQLite DB file is shared between dev and packaged app.
// Must run before any userData path is consumed.
if (process.env.NODE_ENV === 'development') {
  try {
    const prodLikeUserData = path.join(app.getPath('appData'), 'Todolo');
    app.setPath('userData', prodLikeUserData);
    console.log(`[STORAGE] userData path (dev) -> ${prodLikeUserData}`);
  } catch (e) {
    console.warn('[STORAGE] Unable to set dev userData path', e);
  }
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
    console.error(`[PERF] load-lists failed after ${duration.toFixed(2)}ms:`, error);
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
    console.error(`[PERF] save-lists failed after ${duration.toFixed(2)}ms:`, error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('load-list-todos', async (_event, listId: string) => {
  const startTime = performance.now();
  try {
    console.log(`[PERF] Starting load-list-todos operation for list ${listId} (sqlite)`);
    const doc = dbLoadListTodos(listId);
    const duration = performance.now() - startTime;
    console.log(`[PERF] load-list-todos completed in ${duration.toFixed(2)}ms`);
    return doc;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[PERF] load-list-todos failed after ${duration.toFixed(2)}ms:`, error);
    return { version: 2, todos: [] };
  }
});

ipcMain.handle('save-list-todos', async (_event, listId: string, todosDoc: any) => {
  const startTime = performance.now();
  try {
    console.log(`[PERF] Starting save-list-todos operation for list ${listId} (sqlite)`);
    console.log(`[DEBUG] Todos to save:`, JSON.stringify(todosDoc, null, 2));
    const res = dbSaveListTodos(listId, todosDoc);
    const duration = performance.now() - startTime;
    console.log(`[PERF] save-list-todos completed in ${duration.toFixed(2)}ms`);
    console.log(`[DEBUG] Save result:`, res);
    return res;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[PERF] save-list-todos failed after ${duration.toFixed(2)}ms:`, error);
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

  // Updates are handled manually via the Help > Check for Updates menu.
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

app.on('before-quit', () => {
  // Ensure database is properly closed and all data is persisted
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
