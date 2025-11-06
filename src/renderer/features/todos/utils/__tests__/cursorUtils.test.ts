import {
  getCursorPosition,
  isCursorAtStart,
  isCursorAtEnd,
} from '../cursorUtils';

describe('cursorUtils', () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
  });

  afterEach(() => {
    document.body.removeChild(textarea);
  });

  describe('getCursorPosition', () => {
    it('should return 0 when cursor is at start', () => {
      textarea.value = 'hello';
      textarea.setSelectionRange(0, 0);
      expect(getCursorPosition(textarea)).toBe(0);
    });

    it('should return correct position in middle of text', () => {
      textarea.value = 'hello world';
      textarea.setSelectionRange(5, 5);
      expect(getCursorPosition(textarea)).toBe(5);
    });

    it('should return text length when cursor is at end', () => {
      textarea.value = 'hello';
      textarea.setSelectionRange(5, 5);
      expect(getCursorPosition(textarea)).toBe(5);
    });

    it('should handle empty textarea', () => {
      textarea.value = '';
      textarea.setSelectionRange(0, 0);
      expect(getCursorPosition(textarea)).toBe(0);
    });
  });

  describe('isCursorAtStart', () => {
    it('should return true when cursor is at start', () => {
      textarea.value = 'hello';
      textarea.setSelectionRange(0, 0);
      expect(isCursorAtStart(textarea)).toBe(true);
    });

    it('should return false when cursor is not at start', () => {
      textarea.value = 'hello';
      textarea.setSelectionRange(3, 3);
      expect(isCursorAtStart(textarea)).toBe(false);
    });

    it('should return true for empty textarea', () => {
      textarea.value = '';
      textarea.setSelectionRange(0, 0);
      expect(isCursorAtStart(textarea)).toBe(true);
    });
  });

  describe('isCursorAtEnd', () => {
    it('should return true when cursor is at end', () => {
      textarea.value = 'hello';
      textarea.setSelectionRange(5, 5);
      expect(isCursorAtEnd(textarea)).toBe(true);
    });

    it('should return false when cursor is not at end', () => {
      textarea.value = 'hello';
      textarea.setSelectionRange(3, 3);
      expect(isCursorAtEnd(textarea)).toBe(false);
    });

    it('should return true for empty textarea', () => {
      textarea.value = '';
      textarea.setSelectionRange(0, 0);
      expect(isCursorAtEnd(textarea)).toBe(true);
    });
  });

  describe('Unicode character handling', () => {
    it('should handle emojis correctly', () => {
      textarea.value = 'Hello 👋 world';
      // Emoji "👋" is 2 UTF-16 code units, so position after "Hello " is 6
      textarea.setSelectionRange(6, 6);
      expect(getCursorPosition(textarea)).toBe(6);
      expect(isCursorAtStart(textarea)).toBe(false);
      expect(isCursorAtEnd(textarea)).toBe(false);
    });

    it('should handle accented characters correctly', () => {
      textarea.value = 'Café résumé';
      textarea.setSelectionRange(4, 4); // After "Café"
      expect(getCursorPosition(textarea)).toBe(4);
      expect(isCursorAtStart(textarea)).toBe(false);
    });

    it('should detect end correctly with emojis', () => {
      textarea.value = 'Hello 👋';
      // "Hello 👋" = 7 chars (H-e-l-l-o-space-👋) where 👋 is 2 code units
      // Total length is 8 UTF-16 code units
      textarea.setSelectionRange(8, 8);
      expect(isCursorAtEnd(textarea)).toBe(true);
      expect(getCursorPosition(textarea)).toBe(8);
    });

    it('should handle combining characters', () => {
      // Combining characters example: "é" can be "e" + combining acute accent
      textarea.value = 'café';
      textarea.setSelectionRange(4, 4); // At end
      expect(isCursorAtEnd(textarea)).toBe(true);
    });
  });
});
