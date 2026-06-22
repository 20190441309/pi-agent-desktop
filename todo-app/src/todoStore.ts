// src/todoStore.ts

import { Todo, CreateTodoDTO, UpdateTodoDTO } from "./types";

/**
 * 内存中的 TODO 存储，提供增删改查功能
 */
export class TodoStore {
  private todos: Map<string, Todo> = new Map();
  private idCounter: number = 1;

  /** 生成唯一 ID */
  private generateId(): string {
    return String(this.idCounter++);
  }

  /**
   * 创建新的 TODO
   */
  create(dto: CreateTodoDTO): Todo {
    const now = new Date();
    const todo: Todo = {
      id: this.generateId(),
      title: dto.title,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    this.todos.set(todo.id, todo);
    return { ...todo };
  }

  /**
   * 查询所有 TODO
   */
  findAll(): Todo[] {
    return Array.from(this.todos.values()).map((todo) => ({ ...todo }));
  }

  /**
   * 根据 ID 查询单个 TODO
   */
  findById(id: string): Todo | undefined {
    const todo = this.todos.get(id);
    return todo ? { ...todo } : undefined;
  }

  /**
   * 根据 ID 更新 TODO
   */
  update(id: string, dto: UpdateTodoDTO): Todo | undefined {
    const todo = this.todos.get(id);
    if (!todo) return undefined;

    if (dto.title !== undefined) {
      todo.title = dto.title;
    }
    if (dto.completed !== undefined) {
      todo.completed = dto.completed;
    }
    todo.updatedAt = new Date();

    return { ...todo };
  }

  /**
   * 根据 ID 删除 TODO
   */
  delete(id: string): boolean {
    return this.todos.delete(id);
  }
}
