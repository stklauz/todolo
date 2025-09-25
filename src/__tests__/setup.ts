// Test setup file
import '@testing-library/jest-dom';

// Mock audio files
jest.mock('../../assets/sounds/bell.wav', () => 'mock-bell-audio');
jest.mock('../../assets/sounds/pop.mp3', () => 'mock-pop-audio');

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
});

// Add a dummy test to prevent Jest from complaining
describe('Setup', () => {
  it('should run setup', () => {
    expect(true).toBe(true);
  });
});
