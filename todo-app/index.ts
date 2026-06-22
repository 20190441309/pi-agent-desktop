// ============================
// 简单的 TODO 应用（TypeScript）
// 包含增删改查功能
// ============================

// ---------------------
// 1. 类型定义
// ---------------------
interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: Date;
}

// ---------------------
// 2. Todo 存储管理类
// ---------------------
class TodoStore {
  private todos: Todo[] = [];
  private nextId: number = 1;

  // 创建：添加新的 TODO
  add(title: string): Todo {
    const todo: Todo = {
      id: this.nextId++,
      title,
      completed: false,
      createdAt: new Date(),
    };
    this.todos.push(todo);
    return todo;
  }

  // 读取：获取所有 TODO
  getAll(): Todo[] {
    return [...this.todos]; // 返回副本，防止外部直接修改
  }

  // 读取：根据 ID 获取单个 TODO
  getById(id: number): Todo | undefined {
    return this.todos.find((t) => t.id === id);
  }

  // 读取：根据状态筛选
  getByStatus(completed: boolean): Todo[] {
    return this.todos.filter((t) => t.completed === completed);
  }

  // 更新：修改标题
  updateTitle(id: number, newTitle: string): Todo | undefined {
    const todo = this.getById(id);
    if (todo) {
      todo.title = newTitle;
    }
    return todo;
  }

  // 更新：切换完成状态
  toggle(id: number): Todo | undefined {
    const todo = this.getById(id);
    if (todo) {
      todo.completed = !todo.completed;
    }
    return todo;
  }

  // 删除：根据 ID 删除
  delete(id: number): boolean {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.todos.splice(index, 1);
      return true;
    }
    return false;
  }

  // 删除：清除所有已完成
  clearCompleted(): number {
    const before = this.todos.length;
    this.todos = this.todos.filter((t) => !t.completed);
    return before - this.todos.length;
  }

  // 统计信息
  getStats(): { total: number; active: number; completed: number } {
    const total = this.todos.length;
    const completed = this.todos.filter((t) => t.completed).length;
    return { total, active: total - completed, completed };
  }
}

// ---------------------
// 3. 格式化显示工具
// ---------------------
function formatTodo(todo: Todo): string {
  const status = todo.completed ? "✅" : "⬜";
  const date = todo.createdAt.toLocaleDateString("zh-CN");
  return `[${todo.id}] ${status} ${todo.title}  (${date})`;
}

function printSeparator(): void {
  console.log("─".repeat(50));
}

// ---------------------
// 4. 演示：测试所有功能
// ---------------------
function main(): void {
  const store = new TodoStore();

  console.log("\n📝 TODO 应用演示\n");

  // ---- 增：添加 TODO ----
  console.log("【1. 添加 TODO】");
  store.add("学习 TypeScript 基础语法");
  store.add("完成 TODO 应用开发");
  store.add("阅读设计模式书籍");
  store.add("健身 30 分钟");
  store.add("买菜做饭");

  store.getAll().forEach((t) => console.log("  " + formatTodo(t)));
  printSeparator();

  // ---- 查：查询所有 ----
  console.log("\n【2. 查询所有 TODO】");
  console.log(`  共 ${store.getAll().length} 条记录`);
  store.getAll().forEach((t) => console.log("  " + formatTodo(t)));
  printSeparator();

  // ---- 查：按 ID 查询 ----
  console.log("\n【3. 按 ID 查询】");
  const found = store.getById(2);
  if (found) {
    console.log("  找到: " + formatTodo(found));
  }
  const notFound = store.getById(999);
  console.log(`  查询 ID=999: ${notFound ? "找到" : "不存在"}`);
  printSeparator();

  // ---- 查：按状态筛选 ----
  console.log("\n【4. 按状态筛选】");
  console.log("  未完成的 TODO:");
  store.getByStatus(false).forEach((t) => console.log("    " + formatTodo(t)));
  printSeparator();

  // ---- 改：更新标题 ----
  console.log("\n【5. 更新标题】");
  store.updateTitle(1, "深入学习 TypeScript 泛型和装饰器");
  console.log("  更新 ID=1 后: " + formatTodo(store.getById(1)!));
  printSeparator();

  // ---- 改：切换完成状态 ----
  console.log("\n【6. 切换完成状态】");
  store.toggle(2);
  store.toggle(4);
  console.log("  切换 ID=2 后: " + formatTodo(store.getById(2)!));
  console.log("  切换 ID=4 后: " + formatTodo(store.getById(4)!));
  printSeparator();

  // ---- 查看统计 ----
  console.log("\n【7. 统计信息】");
  const stats = store.getStats();
  console.log(`  总计: ${stats.total}  |  未完成: ${stats.active}  |  已完成: ${stats.completed}`);
  printSeparator();

  // ---- 查：按状态筛选（已完成） ----
  console.log("\n【8. 查看已完成的 TODO】");
  store.getByStatus(true).forEach((t) => console.log("  " + formatTodo(t)));
  printSeparator();

  // ---- 删：删除单条 ----
  console.log("\n【9. 删除 TODO】");
  const deleted = store.delete(5);
  console.log(`  删除 ID=5: ${deleted ? "成功" : "失败"}`);
  store.getAll().forEach((t) => console.log("  " + formatTodo(t)));
  printSeparator();

  // ---- 删：清除已完成 ----
  console.log("\n【10. 清除所有已完成】");
  const cleared = store.clearCompleted();
  console.log(`  清除了 ${cleared} 条已完成记录`);
  store.getAll().forEach((t) => console.log("  " + formatTodo(t)));
  printSeparator();

  // ---- 最终统计 ----
  console.log("\n【最终统计】");
  const finalStats = store.getStats();
  console.log(`  总计: ${finalStats.total}  |  未完成: ${finalStats.active}  |  已完成: ${finalStats.completed}`);
  printSeparator();
}

// 运行
main();
