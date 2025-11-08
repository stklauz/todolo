import { useTodosStore } from '../useTodosStore';
import type { TodoList, EditorTodo } from '../../types';
import * as storage from '../../api/storage';

jest.mock('../../api/storage');

const mockStorage = storage as jest.Mocked<typeof storage>;

function seedList(
  id: string,
  todos: EditorTodo[],
  overrides: Partial<TodoList> = {},
): TodoList {
  return {
    id,
    name: 'Test',
    todos,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  } as TodoList;
}

describe('useTodosStore actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTodosStore.setState({
      lists: [],
      selectedListId: null,
      indexLoaded: false,
      loadedLists: new Set(),
      idCounter: 1,
    } as any);
    mockStorage.duplicateList.mockResolvedValue({
      success: true,
      newListId: 'duplicated-list-id',
    });
    mockStorage.deleteList.mockResolvedValue({ success: true });
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

  test('updateTodo moves list to the top based on recency', () => {
    const olderList = seedList(
      'list-older',
      [{ id: 1, text: 'A', completed: false, indent: 0, parentId: null }],
      { name: 'Older', updatedAt: '2024-01-01T00:00:00.000Z' },
    );
    const newerList = seedList('list-newer', [], {
      name: 'Newer',
      updatedAt: '2024-02-01T00:00:00.000Z',
    });

    useTodosStore.setState({
      lists: [newerList, olderList],
      selectedListId: 'list-older',
    } as any);

    useTodosStore.getState().updateTodo(1, 'Updated');

    const orderedIds = useTodosStore.getState().lists.map((l) => l.id);
    expect(orderedIds[0]).toBe('list-older');
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

  test('addList inserts the new list at the top', () => {
    const existing = seedList('existing', [], {
      name: 'Existing',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    useTodosStore.setState({
      lists: [existing],
      selectedListId: 'existing',
    } as any);

    const newListId = useTodosStore.getState().addList();

    const { lists } = useTodosStore.getState();
    expect(lists[0]?.id).toBe(newListId);
    expect(lists[1]?.id).toBe('existing');
    expect(useTodosStore.getState().selectedListId).toBe(newListId);
  });

  test('renameList moves the updated list to the top', () => {
    const older = seedList('older', [], {
      name: 'Older',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const newer = seedList('newer', [], {
      name: 'Newer',
      updatedAt: '2024-02-01T00:00:00.000Z',
    });

    useTodosStore.setState({
      lists: [newer, older],
      selectedListId: 'newer',
    } as any);

    useTodosStore.getState().renameList('older', 'Older Renamed');

    const [first, second] = useTodosStore.getState().lists;
    expect(first.id).toBe('older');
    expect(first.name).toBe('Older Renamed');
    expect(second.id).toBe('newer');
  });

  test('duplicateList inserts the new list at the top', async () => {
    const source = seedList('source', [], {
      name: 'Source',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    useTodosStore.setState({
      lists: [source],
      selectedListId: 'source',
    } as any);

    mockStorage.duplicateList.mockResolvedValue({
      success: true,
      newListId: 'copy-id',
    });

    const newId = await useTodosStore
      .getState()
      .duplicateList('source', 'Copy');

    const orderedIds = useTodosStore.getState().lists.map((l) => l.id);
    expect(newId).toBe('copy-id');
    expect(orderedIds[0]).toBe('copy-id');
    expect(orderedIds[1]).toBe('source');
    const duplicated = useTodosStore.getState().getListById('copy-id') as
      | TodoList
      | undefined;
    expect(duplicated?.updatedAt).toEqual(expect.any(String));
  });
});
