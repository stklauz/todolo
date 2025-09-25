declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage: (
          channel:
            | 'ipc-example'
            | 'save-todos'
            | 'load-todos'
            | 'load-lists'
            | 'save-lists'
            | 'load-list-todos'
            | 'save-list-todos',
          ...args: unknown[]
        ) => void;
        on: (
          channel:
            | 'ipc-example'
            | 'save-todos'
            | 'load-todos'
            | 'load-lists'
            | 'save-lists'
            | 'load-list-todos'
            | 'save-list-todos',
          func: (...args: unknown[]) => void
        ) => () => void;
        once: (
          channel:
            | 'ipc-example'
            | 'save-todos'
            | 'load-todos'
            | 'load-lists'
            | 'save-lists'
            | 'load-list-todos'
            | 'save-list-todos',
          func: (...args: unknown[]) => void
        ) => void;
        invoke: (
          channel:
            | 'ipc-example'
            | 'save-todos'
            | 'load-todos'
            | 'load-lists'
            | 'save-lists'
            | 'load-list-todos'
            | 'save-list-todos',
          ...args: unknown[]
        ) => Promise<unknown>;
      };
    };
  }
}

export {};

