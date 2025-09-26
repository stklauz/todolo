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
import fs from 'fs';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  loadListsIndex as dbLoadListsIndex,
  saveListsIndex as dbSaveListsIndex,
  loadListTodos as dbLoadListTodos,
  saveListTodos as dbSaveListTodos,
} from './db';

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

// Auto-update logic removed per user request.

let mainWindow: BrowserWindow | null = null;

// IPC handlers for todo operations
ipcMain.on('save-todos', async (event, todos) => {
  const startTime = performance.now();
  try {
    console.log(`[PERF] Starting save-todos operation`);
    const target = getLegacyTodosPath();
    const tmp = `${target}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(todos));
    await fs.promises.rename(tmp, target);
    const duration = performance.now() - startTime;
    console.log(`[PERF] save-todos completed in ${duration.toFixed(2)}ms`);
    event.reply('save-todos', { success: true });
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[PERF] save-todos failed after ${duration.toFixed(2)}ms:`, error);
    event.reply('save-todos', { success: false, error });
  }
});

ipcMain.handle('load-todos', async () => {
  const startTime = performance.now();
  try {
    console.log(`[PERF] Starting load-todos operation`);
    if (fs.existsSync(getLegacyTodosPath())) {
      const data = await fs.promises.readFile(getLegacyTodosPath(), 'utf-8');
      const result = JSON.parse(data);
      const duration = performance.now() - startTime;
      console.log(`[PERF] load-todos completed in ${duration.toFixed(2)}ms`);
      return result;
    }
    const duration = performance.now() - startTime;
    console.log(`[PERF] load-todos completed (no file) in ${duration.toFixed(2)}ms`);
    return [];
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[PERF] load-todos failed after ${duration.toFixed(2)}ms:`, error);
    return [];
  }
});

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
    const res = dbSaveListTodos(listId, todosDoc);
    const duration = performance.now() - startTime;
    console.log(`[PERF] save-list-todos completed in ${duration.toFixed(2)}ms`);
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
