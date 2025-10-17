import React from 'react';

/**
 * Return type for the useListEditing hook
 */
export interface UseListEditingReturn {
  /** ID of the list currently being edited, null if none */
  editingListId: string | null;
  /** Current value of the editing input field */
  editingName: string;
  /** Ref to track if input was just focused (for cursor positioning) */
  inputJustFocusedRef: React.MutableRefObject<boolean>;
  /** Ref to the title input element */
  titleInputRef: React.RefObject<HTMLInputElement | null>;
  /** Ref to track if editing is currently active */
  isEditingRef: React.MutableRefObject<boolean>;
  /** Function to start editing a list */
  startRename: (listId: string, currentName: string) => void;
  /** Function to commit the rename (calls parent's rename logic) */
  commitRename: () => void;
  /** Function to cancel editing and reset state */
  cancelRename: () => void;
  /** Function to update the editing name */
  setEditingName: (name: string) => void;
}

/**
 * Custom hook for managing list editing/renaming state and behavior.
 *
 * This hook provides:
 * - State management for list editing mode
 * - Input focus management
 * - Rename workflow (start, commit, cancel)
 * - Integration with parent component's rename logic
 *
 * @returns Object containing list editing state and functions
 *
 * @example
 * ```tsx
 * const {
 *   editingListId,
 *   editingName,
 *   titleInputRef,
 *   startRename,
 *   commitRename,
 *   cancelRename,
 *   setEditingName
 * } = useListEditing();
 *
 * // Start editing a list
 * startRename(listId, currentName);
 *
 * // Handle input changes
 * const handleChange = (e) => setEditingName(e.target.value);
 * const handleKeyDown = (e) => e.key === 'Enter' && commitRename();
 * ```
 */
export default function useListEditing(): UseListEditingReturn {
  const [editingListId, setEditingListId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState<string>('');
  const inputJustFocusedRef = React.useRef(false);
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);
  const isEditingRef = React.useRef(false);

  // Focus the input when editing starts (only when editingListId changes)
  React.useEffect(() => {
    if (editingListId && titleInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          // Don't select all text - let user position cursor where they want
        }
      }, 10);
    }
  }, [editingListId]); // Only depend on editingListId

  function startRename(listId: string, current: string) {
    isEditingRef.current = true;
    setEditingListId(listId);
    setEditingName(current);
  }

  function commitRename() {
    if (!editingListId || !isEditingRef.current) return;
    const name = editingName.trim();
    if (!name) {
      setEditingListId(null);
      isEditingRef.current = false;
      return;
    }
    // The actual rename logic will be handled by the parent component
    // This hook just manages the editing state
    setEditingListId(null);
    isEditingRef.current = false;
  }

  function cancelRename() {
    setEditingListId(null);
    isEditingRef.current = false;
  }

  return {
    editingListId,
    editingName,
    inputJustFocusedRef,
    titleInputRef,
    isEditingRef,
    startRename,
    commitRename,
    cancelRename,
    setEditingName,
  };
}
