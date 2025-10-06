import React from 'react';
import { IoReload } from 'react-icons/io5';

type SpinnerProps = {
  size?: number;
  className?: string;
};

export default function Spinner({
  size = 16,
  className,
}: SpinnerProps): React.ReactElement {
  return (
    <IoReload
      size={size}
      className={className}
      style={{
        animation: 'spin 1s linear infinite',
      }}
    />
  );
}
