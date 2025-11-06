/**
 * Utilities for working with cursor positions in textarea elements.
 *
 * These utilities help detect and manipulate cursor positions for text editing
 * features like content splitting on Enter key press.
 */

/**
 * Gets the current cursor position in a textarea element.
 *
 * @param el - The textarea element
 * @returns The cursor position (0-based index)
 *
 * @example
 * ```typescript
 * const textarea = document.querySelector('textarea');
 * const pos = getCursorPosition(textarea);
 * ```
 */
export function getCursorPosition(el: HTMLTextAreaElement): number {
  return el.selectionStart;
}

/**
 * Checks if the cursor is at the start of the textarea content.
 *
 * @param el - The textarea element
 * @returns True if cursor is at position 0
 *
 * @example
 * ```typescript
 * if (isCursorAtStart(textarea)) {
 *   // Handle cursor at start
 * }
 * ```
 */
export function isCursorAtStart(el: HTMLTextAreaElement): boolean {
  return el.selectionStart === 0;
}

/**
 * Checks if the cursor is at the end of the textarea content.
 *
 * @param el - The textarea element
 * @returns True if cursor is at the end of the text
 *
 * @example
 * ```typescript
 * if (isCursorAtEnd(textarea)) {
 *   // Handle cursor at end
 * }
 * ```
 */
export function isCursorAtEnd(el: HTMLTextAreaElement): boolean {
  return el.selectionStart === el.value.length;
}
