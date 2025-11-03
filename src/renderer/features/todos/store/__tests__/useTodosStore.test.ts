import { useTodosStore } from '../useTodosStore';
import type { TodoList } from '../../types';

describe('useTodosStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useTodosStore.setState({
      lists: [],
      selectedListId: null,
      indexLoaded: false,
      loadedLists: new Set(),
      idCounter: 1,
    });
  });

  describe('lists management', () => {
    it('should set and get lists', () => {
      const testLists: TodoList[] = [
        { id: 'list-1', name: 'Test List', todos: [] },
      ];

      useTodosStore.getState().setLists(testLists);
      expect(useTodosStore.getState().lists).toEqual(testLists);
    });

    it('should set and get selectedListId', () => {
      useTodosStore.getState().setSelectedListId('list-1');
      expect(useTodosStore.getState().selectedListId).toBe('list-1');
    });

    it('should get selected list', () => {
      const testLists: TodoList[] = [
        { id: 'list-1', name: 'Test List 1', todos: [] },
        { id: 'list-2', name: 'Test List 2', todos: [] },
      ];

      useTodosStore.getState().setLists(testLists);
      useTodosStore.getState().setSelectedListId('list-2');

      const selected = useTodosStore.getState().getSelectedList();
      expect(selected).toEqual(testLists[1]);
    });
  });

  describe('loaded lists tracking', () => {
    it('should mark list as loaded', () => {
      useTodosStore.getState().markListAsLoaded('list-1');
      expect(useTodosStore.getState().isListLoaded('list-1')).toBe(true);
    });

    it('should return false for unloaded list', () => {
      expect(useTodosStore.getState().isListLoaded('list-1')).toBe(false);
    });
  });

  describe('ID counter', () => {
    it('should generate sequential IDs', () => {
      const id1 = useTodosStore.getState().nextId();
      const id2 = useTodosStore.getState().nextId();
      const id3 = useTodosStore.getState().nextId();

      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(id3).toBe(3);
    });

    it('should sync counter to max ID + 1', () => {
      useTodosStore.getState().syncIdCounter(10);
      expect(useTodosStore.getState().idCounter).toBe(11);

      const nextId = useTodosStore.getState().nextId();
      expect(nextId).toBe(11);
    });

    it('should not decrease counter if max ID is lower', () => {
      useTodosStore.getState().syncIdCounter(10); // Counter = 11
      useTodosStore.getState().syncIdCounter(5); // Should not change

      expect(useTodosStore.getState().idCounter).toBe(11);
    });
  });

  describe('indexLoaded', () => {
    it('should set and get indexLoaded', () => {
      expect(useTodosStore.getState().indexLoaded).toBe(false);

      useTodosStore.getState().setIndexLoaded(true);
      expect(useTodosStore.getState().indexLoaded).toBe(true);
    });
  });
});
