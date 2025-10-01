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
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
