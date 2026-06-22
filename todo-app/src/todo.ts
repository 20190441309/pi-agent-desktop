export interface Todo {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TodoManager {
  private todos: Map<number, Todo> = new Map();
  private nextId: number = 1;

  // 创建
  create(title: string, description: string = ""): Todo {
    const now = new Date();
    const todo: Todo = {
      id: this.nextId++,
      title,
      description,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    this.todos.set(todo.id, todo);
    return todo;
  }

  // 查询所有
  findAll(): Todo[] {
    return Array.from(this.todos.values());
  }

  // 根据 ID 查询
  findById(id: number): Todo | undefined {
    return this.todos.get(id);
  }

  // 更新
  update(
    id: number,
    updates: Partial<Pick<Todo, "title" | "description" | "completed">>
  ): Todo | undefined {
    const todo = this.todos.get(id);
    if (!todo) return undefined;

    if (updates.title !== undefined) todo.title = updates.title;
    if (updates.description !== undefined) todo.description = updates.description;
    if (updates.completed !== undefined) todo.completed = updates.completed;
    todo.updatedAt = new Date();

    return todo;
  }

  // 删除
  delete(id: number): boolean {
    return this.todos.delete(id);
  }
}
