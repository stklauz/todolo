export type EditorTodo = {
  id: number;
  text: string;
  completed: boolean;
  // indentation level: 0..1 (clamped)
  indent?: number;
};
export type TodoList = {
  id: string;
  name: string;
  todos: EditorTodo[];
  createdAt?: string;
  updatedAt?: string;
};
export type AppData = { version: 1; lists: TodoList[]; selectedListId?: string };
export type AppSettings = {
  hideCompletedItems: boolean;
};
export type Section = 'active' | 'completed';
