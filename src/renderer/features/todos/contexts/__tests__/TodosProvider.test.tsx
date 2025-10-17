import React from 'react';
import { render } from '@testing-library/react';
import { useTodosContext } from '../TodosContext';
import { useTodosActions } from '../TodosActionsContext';

describe('Context Error Handling', () => {
  it('should throw error when useTodosContext is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    function TestComponent() {
      useTodosContext();
      return <div>Test</div>;
    }

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTodosContext must be used within a TodosProvider');

    consoleSpy.mockRestore();
  });

  it('should throw error when useTodosActions is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    function TestActionsComponent() {
      useTodosActions();
      return <div>Test</div>;
    }

    expect(() => {
      render(<TestActionsComponent />);
    }).toThrow('useTodosActions must be used within a TodosActionsProvider');

    consoleSpy.mockRestore();
  });
});
