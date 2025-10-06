// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'save-todos'
  | 'load-todos'
  | 'load-lists'
  | 'save-lists'
  | 'load-list-todos'
  | 'save-list-todos'
  | 'load-app-settings'
  | 'save-app-settings'
  | 'toggle-debug-mode'
  | 'duplicate-list'
  | 'set-selected-list-meta';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    invoke(channel: Channels, ...args: unknown[]) {
      return ipcRenderer.invoke(channel, ...args);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = {
  ipcRenderer: {
    sendMessage: (channel: Channels, ...args: unknown[]) => void;
    on: (channel: Channels, func: (...args: unknown[]) => void) => () => void;
    once: (channel: Channels, func: (...args: unknown[]) => void) => void;
    invoke: (channel: Channels, ...args: unknown[]) => Promise<unknown>;
  };
};
