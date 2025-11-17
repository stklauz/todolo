// Global test setup (no tests here)
import '@testing-library/jest-dom';

// Mock audio files
jest.mock('../../assets/sounds/bell.mp3', () => 'mock-bell-audio');

// Mock window.electron for all tests
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      invoke: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      sendMessage: jest.fn(),
    },
  },
  writable: true,
  configurable: true,
});

// Suppress console noise during tests; restored via restoreMocks/reset in Jest config
/**
 * Tests are only allowed to emit through console.info. All other console methods
 * are redirected to console.info (which is mocked to a noop) so accidental
 * usages are easy to audit and don't pollute test output.
 */
beforeEach(() => {
  const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

  const redirectToInfo =
    (label: string) =>
    (message?: unknown, ...rest: unknown[]) =>
      console.info(`[${label}]`, message, ...rest);

  jest.spyOn(console, 'log').mockImplementation(redirectToInfo('console.log'));
  jest
    .spyOn(console, 'warn')
    .mockImplementation(redirectToInfo('console.warn'));
  jest
    .spyOn(console, 'error')
    .mockImplementation(redirectToInfo('console.error'));
});
