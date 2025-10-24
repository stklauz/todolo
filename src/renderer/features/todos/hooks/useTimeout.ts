import React from 'react';

export function useTimeout() {
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCleanupTimeout = React.useCallback(
    (callback: () => void, delay: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(callback, delay);
    },
    [],
  );

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return setCleanupTimeout;
}
