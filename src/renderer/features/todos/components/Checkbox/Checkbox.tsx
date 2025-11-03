import React from 'react';
import { Check } from 'lucide-react';

const styles = require('./Checkbox.module.css');

type CheckboxProps = {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggle?: () => void;
  ariaLabel?: string;
  className?: string;
  spacing?: 'none' | 'sm' | 'md';
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked,
      indeterminate = false,
      disabled = false,
      onChange,
      onToggle,
      ariaLabel,
      className,
      spacing,
    },
    ref,
  ) => {
    const checkboxRef = React.useRef<HTMLInputElement | null>(null);
    const combinedRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        checkboxRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    React.useEffect(() => {
      if (checkboxRef.current) {
        checkboxRef.current.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e);
      } else if (onToggle) {
        onToggle();
      }
    };

    const spacingClass =
      spacing === 'none'
        ? styles.spacingNone
        : spacing === 'sm'
          ? styles.spacingSm
          : spacing === 'md'
            ? styles.spacingMd
            : '';

    return (
      <span
        className={`${styles.checkboxWrapper} ${spacingClass} ${className || ''}`}
      >
        <input
          type="checkbox"
          aria-label={ariaLabel}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className={styles.checkbox}
          ref={combinedRef}
        />
        <Check className={styles.checkboxIcon} strokeWidth={4} />
        <span className={styles.checkboxIndeterminateIcon} />
      </span>
    );
  },
);

Checkbox.displayName = 'Checkbox';
