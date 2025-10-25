import React from 'react';

/**
 * Return type for the useListDuplication hook
 */
export interface UseListDuplicationReturn {
  /** Whether a duplication operation is currently in progress */
  isDuplicating: boolean;
  /** Status message to display to the user */
  statusMessage: string | null;
  /** ID of the list to focus after duplication (temporary) */
  focusListId: string | null;
  /** Function to handle the duplication process */
  handleDuplicate: (
    selectedListId: string,
    duplicateListFn: (id: string) => Promise<string | null>,
  ) => Promise<void>;
  /** Function to manually set focus list ID */
  setFocusListId: (id: string | null) => void;
}

/**
 * Custom hook for managing list duplication with loading states and user feedback.
 *
 * This hook provides:
 * - Loading state management during duplication
 * - User feedback via status messages
 * - Spinner display with delay
 * - Focus management for the newly created list
 * - Error handling and recovery
 *
 * @returns Object containing duplication state and handler function
 *
 * @example
 * ```tsx
 * const {
 *   isDuplicating,
 *   statusMessage,
 *   focusListId,
 *   handleDuplicate
 * } = useListDuplication();
 *
 * // Handle duplication
 * const onDuplicate = () => {
 *   handleDuplicate(selectedListId, duplicateList);
 * };
 *
 * // Use in component
 * const statusDisplay = statusMessage || '';
 * ```
 */
export default function useListDuplication(): UseListDuplicationReturn {
  const [isDuplicating, setIsDuplicating] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [focusListId, setFocusListId] = React.useState<string | null>(null);

  // Clear focus after it's been set
  React.useEffect(() => {
    if (focusListId) {
      // Clear focus after a short delay to allow the focus to be applied
      const timeout = setTimeout(() => {
        setFocusListId(null);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [focusListId]);

  const handleDuplicate = React.useCallback(
    async (
      selectedListId: string,
      duplicateListFn: (id: string) => Promise<string | null>,
    ) => {
      if (isDuplicating || !selectedListId) return;

      const spinnerTimeout: number | null = null;

      try {
        setIsDuplicating(true);
        setStatusMessage('Duplicating…');

        const newId = await duplicateListFn(selectedListId);

        if (newId) {
          setStatusMessage('List duplicated');
          // Set focus to the newly created list
          setFocusListId(newId);
        } else {
          setStatusMessage("Couldn't duplicate this list. Try again.");
        }
      } finally {
        // Clear spinner timeout if it hasn't fired yet
        if (spinnerTimeout) {
          clearTimeout(spinnerTimeout);
        }
        setIsDuplicating(false);
      }
    },
    [isDuplicating],
  );

  return {
    isDuplicating,
    statusMessage,
    focusListId,
    handleDuplicate,
    setFocusListId,
  };
}
