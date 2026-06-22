import { Todo, CreateTodoDTO, UpdateTodoDTO } from './types';

export class TodoService {
  private todos: Todo[] = [];
  private nextId: number = 1;

  // 创建 TODO
  create(dto: CreateTodoDTO): Todo {
    const now = new Date();
    const todo: Todo = {
      id: this.nextId++,
      title: dto.title,
      description: dto.description || '',
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    this.todos.push(todo);
    return todo;
  }

  // 查询所有 TODO
  findAll(): Todo[] {
    return [...this.todos];
  }

  // 根据 ID 查询单个 TODO
  findById(id: number): Todo | undefined {
    return this.todos.find(todo => todo.id === id);
  }

  // 更新 TODO
  update(id: number, dto: UpdateTodoDTO): Todo | null {
    const index = this.todos.findIndex(todo => todo.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.todos[index];
    const updated: Todo = {
      ...existing,
      ...dto,
      id: existing.id, // 防止 id 被覆盖
      updatedAt: new Date(),
    };
    this.todos[index] = updated;
    return updated;
  }

  // 删除 TODO
  delete(id: number): boolean {
    const index = this.todos.findIndex(todo => todo.id === id);
    if (index === -1) {
      return false;
    }
    this.todos.splice(index, 1);
    return true;
  }

  // 切换完成状态
  toggle(id: number): Todo | null {
    const todo = this.findById(id);
    if (!todo) {
      return null;
    }
    return this.update(id, { completed: !todo.completed });
  }

  // 获取统计信息
  getStats(): { total: number; completed: number; pending: number } {
    const total = this.todos.length;
    const completed = this.todos.filter(t => t.completed).length;
    return {
      total,
      completed,
      pending: total - completed,
    };
  }
}
