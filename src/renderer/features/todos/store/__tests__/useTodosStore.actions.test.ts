import { useTodosStore } from '../useTodosStore';
import type { TodoList, EditorTodo } from '../../types';

function seedList(id: string, todos: EditorTodo[]): TodoList {
  return {
    id,
    name: 'Test',
    todos,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;
}

describe('useTodosStore actions', () => {
  beforeEach(() => {
    useTodosStore.setState({
      lists: [],
      selectedListId: null,
      indexLoaded: false,
      loadedLists: new Set(),
      idCounter: 1,
    } as any);
  });

  test('updateTodo updates text of selected list', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'A', completed: false, indent: 0, parentId: null },
    ];
    const list = seedList('list-1', todos);
    useTodosStore.setState({ lists: [list], selectedListId: 'list-1' } as any);

    useTodosStore.getState().updateTodo(1, 'Updated');

    const selected = useTodosStore.getState().getSelectedList();
    expect(selected?.todos[0].text).toBe('Updated');
  });

  test('toggleTodo toggles and applies to descendants when parent', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'P', completed: false, indent: 0, parentId: null },
      { id: 2, text: 'C1', completed: false, indent: 1, parentId: 1 },
      { id: 3, text: 'C2', completed: false, indent: 1, parentId: 1 },
    ];
    const list = seedList('list-1', todos);
    useTodosStore.setState({ lists: [list], selectedListId: 'list-1' } as any);

    useTodosStore.getState().toggleTodo(1);

    const selected = useTodosStore.getState().getSelectedList();
    expect(selected?.todos.map((t) => t.completed)).toEqual([true, true, true]);
  });

  test('insertTodoBelow inserts with inherited parent', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'A', completed: false, indent: 0, parentId: null },
    ];
    useTodosStore.setState({
      lists: [seedList('l', todos)],
      selectedListId: 'l',
      idCounter: 10,
    } as any);

    const id = useTodosStore.getState().insertTodoBelow(0, 'B');

    const selected = useTodosStore.getState().getSelectedList();
    expect(id).toBe(10);
    expect(selected?.todos.length).toBe(2);
    expect(selected?.todos[1].parentId).toBeNull();
  });

  test('removeTodoAt re-parents children when removing top-level parent', () => {
    const todos: EditorTodo[] = [
      { id: 1, text: 'P1', completed: false, indent: 0, parentId: null },
      { id: 2, text: 'C1', completed: false, indent: 1, parentId: 1 },
      { id: 3, text: 'P2', completed: false, indent: 0, parentId: null },
      { id: 4, text: 'C2', completed: false, indent: 1, parentId: 1 },
    ];
    useTodosStore.setState({
      lists: [seedList('l', todos)],
      selectedListId: 'l',
    } as any);

    useTodosStore.getState().removeTodoAt(0);

    const selected = useTodosStore.getState().getSelectedList();
    const c1 = selected?.todos.find((t) => t.id === 2);
    const c2 = selected?.todos.find((t) => t.id === 4);
    // Expect children reparented to nearest previous active top-level (id 3)
    expect(c1?.parentId).toBe(3);
    expect(c2?.parentId).toBe(3);
  });
});
