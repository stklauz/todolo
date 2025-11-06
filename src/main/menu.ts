import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
  dialog,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import { shouldEnableDebugUI } from './util';

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  private async promptDownloadAndInstall() {
    // Download the update and prompt to restart
    await autoUpdater.downloadUpdate();
    const restart = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message:
        'The update has been downloaded. Restart now to apply the update?',
      buttons: ['Restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (restart.response === 0) {
      autoUpdater.quitAndInstall();
    }
  }

  private async shouldDownloadAndInstall(latest: string, current: string) {
    const resp = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${latest}) is available. You are on ${current}.\n\nWould you like to download and install it now?`,
      buttons: ['Download and Install', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });
    return resp.response === 0;
  }

  private async checkForUpdatesManually() {
    let originalAutoDownload: boolean | undefined;
    try {
      // For manual checks, allow user-triggered download & install flow
      originalAutoDownload = autoUpdater.autoDownload;
      autoUpdater.autoDownload = false;

      // Perform a one-time check
      const result = await autoUpdater.checkForUpdates();
      const latest = result?.updateInfo?.version;
      const current = app.getVersion();

      if (!latest || latest === current) {
        await dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'Up to Date',
          message: `You’re running the latest version (${current}).`,
          buttons: ['OK'],
          defaultId: 0,
        });
        return;
      }

      const confirm = await this.shouldDownloadAndInstall(latest, current);
      if (confirm) {
        try {
          await this.promptDownloadAndInstall();
        } catch (error_: any) {
          const retry = await dialog.showMessageBox(this.mainWindow, {
            type: 'warning',
            title: 'Download Failed',
            message: `Could not download the update. ${
              error_?.message ?? ''
            }`.trim(),
            buttons: ['Open Releases Page', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
          });
          if (retry.response === 0) {
            shell.openExternal('https://github.com/stklauz/todolo/releases');
          }
        }
      }
    } catch (err: any) {
      const resp = await dialog.showMessageBox(this.mainWindow, {
        type: 'warning',
        title: 'Update Check Failed',
        message: `Could not check for updates. ${err?.message ?? ''}`.trim(),
        buttons: ['Open Releases Page', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
      });
      if (resp.response === 0) {
        shell.openExternal('https://github.com/stklauz/todolo/releases');
      }
    } finally {
      // Restore original autoDownload setting for auto-updater
      if (typeof originalAutoDownload === 'boolean') {
        autoUpdater.autoDownload = originalAutoDownload;
      }
    }
  }

  buildMenu(): Menu {
    const enableDebugUI = shouldEnableDebugUI(process.env);
    if (enableDebugUI) {
      this.setupDevelopmentEnvironment();
    }

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template as any);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.webContents.inspectElement(x, y);
          },
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'Todolo',
      submenu: [
        {
          label: 'About Todolo',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: 'Hide Todolo',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Debug Mode',
          accelerator: 'Command+D',
          click: () => {
            this.mainWindow.webContents.send('toggle-debug-mode');
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click() {
            shell.openExternal('https://electronjs.org');
          },
        },
        {
          label: 'Documentation',
          click() {
            shell.openExternal(
              'https://github.com/electron/electron/tree/main/docs#readme',
            );
          },
        },
        {
          label: 'Check for Updates…',
          click: () => {
            void this.checkForUpdatesManually();
          },
        },
        {
          label: 'Search Issues',
          click() {
            shell.openExternal('https://github.com/stklauz/todolo/issues');
          },
        },
      ],
    };

    const enableDebugUI = shouldEnableDebugUI(process.env);
    const subMenuView = enableDebugUI ? subMenuViewDev : subMenuViewProd;

    return [
      subMenuAbout,
      subMenuEdit,
      subMenuView,
      subMenuWindow,
      subMenuHelp,
    ] as any[];
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&File',
        submenu: [
          {
            label: '&Open',
            accelerator: 'Ctrl+O',
          },
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click: () => {
              this.mainWindow.close();
            },
          },
        ],
      },
      {
        label: '&View',
        submenu: ((): MenuItemConstructorOptions[] => {
          const enableDebugUI = shouldEnableDebugUI(process.env);
          if (enableDebugUI) {
            return [
              {
                label: '&Reload',
                accelerator: 'Ctrl+R',
                click: () => {
                  this.mainWindow.webContents.reload();
                },
              },
              {
                label: 'Toggle &Full Screen',
                accelerator: 'F11',
                click: () => {
                  this.mainWindow.setFullScreen(
                    !this.mainWindow.isFullScreen(),
                  );
                },
              },
              {
                label: 'Toggle &Developer Tools',
                accelerator: 'Alt+Ctrl+I',
                click: () => {
                  this.mainWindow.webContents.toggleDevTools();
                },
              },
              { type: 'separator' },
              {
                label: 'Toggle &Debug Mode',
                accelerator: 'Ctrl+D',
                click: () => {
                  this.mainWindow.webContents.send('toggle-debug-mode');
                },
              },
            ];
          }
          return [
            {
              label: 'Toggle &Full Screen',
              accelerator: 'F11',
              click: () => {
                this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
              },
            },
          ];
        })(),
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Learn More',
            click() {
              shell.openExternal('https://electronjs.org');
            },
          },
          {
            label: 'Documentation',
            click() {
              shell.openExternal(
                'https://github.com/electron/electron/tree/main/docs#readme',
              );
            },
          },
          {
            label: 'Check for Updates…',
            click: async () => {
              await this.checkForUpdatesManually();
            },
          },
          {
            label: 'Todolo Discussions',
            click() {
              shell.openExternal(
                'https://github.com/stklauz/todolo/discussions',
              );
            },
          },
          {
            label: 'Search Issues',
            click() {
              shell.openExternal('https://github.com/stklauz/todolo/issues');
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
