// TODO 应用 - TypeScript 实现

// 定义 Todo 接口
interface Todo {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Todo 类
class TodoApp {
  private todos: Todo[] = [];
  private nextId: number = 1;

  // 创建新的 TODO
  createTodo(title: string, description: string = ""): Todo {
    const newTodo: Todo = {
      id: this.nextId++,
      title,
      description,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.todos.push(newTodo);
    console.log(`✅ 创建 TODO: "${title}" (ID: ${newTodo.id})`);
    return newTodo;
  }

  // 获取所有 TODO
  getAllTodos(): Todo[] {
    return [...this.todos];
  }

  // 根据 ID 获取单个 TODO
  getTodoById(id: number): Todo | undefined {
    return this.todos.find(todo => todo.id === id);
  }

  // 更新 TODO
  updateTodo(id: number, updates: { title?: string; description?: string; completed?: boolean }): Todo | null {
    const todoIndex = this.todos.findIndex(todo => todo.id === id);
    if (todoIndex === -1) {
      console.log(`❌ 未找到 ID 为 ${id} 的 TODO`);
      return null;
    }

    this.todos[todoIndex] = {
      ...this.todos[todoIndex],
      ...updates,
      updatedAt: new Date(),
    };

    console.log(`📝 更新 TODO (ID: ${id})`);
    return this.todos[todoIndex];
  }

  // 删除 TODO
  deleteTodo(id: number): boolean {
    const todoIndex = this.todos.findIndex(todo => todo.id === id);
    if (todoIndex === -1) {
      console.log(`❌ 未找到 ID 为 ${id} 的 TODO`);
      return false;
    }

    const deletedTodo = this.todos.splice(todoIndex, 1)[0];
    console.log(`🗑️ 删除 TODO: "${deletedTodo.title}" (ID: ${id})`);
    return true;
  }

  // 切换 TODO 完成状态
  toggleTodo(id: number): Todo | null {
    const todo = this.getTodoById(id);
    if (!todo) {
      console.log(`❌ 未找到 ID 为 ${id} 的 TODO`);
      return null;
    }

    return this.updateTodo(id, { completed: !todo.completed });
  }

  // 获取已完成的 TODO
  getCompletedTodos(): Todo[] {
    return this.todos.filter(todo => todo.completed);
  }

  // 获取未完成的 TODO
  getIncompleteTodos(): Todo[] {
    return this.todos.filter(todo => !todo.completed);
  }

  // 显示所有 TODO
  displayTodos(): void {
    console.log("\n📋 当前 TODO 列表:");
    console.log("=".repeat(50));
    
    if (this.todos.length === 0) {
      console.log("暂无 TODO 项目");
      return;
    }

    this.todos.forEach(todo => {
      const status = todo.completed ? "✅ 已完成" : "⏳ 未完成";
      console.log(`${todo.id}. ${todo.title} - ${status}`);
      if (todo.description) {
        console.log(`   描述: ${todo.description}`);
      }
      console.log(`   创建时间: ${todo.createdAt.toLocaleString()}`);
      console.log(`   更新时间: ${todo.updatedAt.toLocaleString()}`);
      console.log("-".repeat(30);
    });
  }

  // 获取统计信息
  getStats(): { total: number; completed: number; incomplete: number } {
    return {
      total: this.todos.length,
      completed: this.getCompletedTodos().length,
      incomplete: this.getIncompleteTodos().length,
    };
  }
}

// 演示使用
function main(): void {
  const todoApp = new TodoApp();

  console.log("🚀 启动 TODO 应用演示\n");

  // 创建一些 TODO
  console.log("📝 创建 TODO:");
  todoApp.createTodo("学习 TypeScript", "完成基础语法和类型系统学习");
  todoApp.createTodo("完成项目作业", "周五前提交");
  todoApp.createTodo("购买 groceries", "牛奶、面包、鸡蛋");
  todoApp.createTodo("健身锻炼", "每周三次");

  // 显示所有 TODO
  todoApp.displayTodos();

  // 更新一个 TODO
  console.log("\n📝 更新 TODO:");
  todoApp.updateTodo(2, { description: "周五前提交，包括文档和代码" });
  
  // 标记一个 TODO 为完成
  console.log("\n✅ 标记 TODO 为完成:");
  todoApp.toggleTodo(3);

  // 显示更新后的列表
  todoApp.displayTodos();

  // 显示统计信息
  console.log("\n📊 统计信息:");
  const stats = todoApp.getStats();
  console.log(`总计: ${stats.total}`);
  console.log(`已完成: ${stats.completed}`);
  console.log(`未完成: ${stats.incomplete}`);

  // 删除一个 TODO
  console.log("\n🗑️ 删除 TODO:");
  todoApp.deleteTodo(4);

  // 显示最终列表
  todoApp.displayTodos();

  // 尝试获取不存在的 TODO
  console.log("\n🔍 查找 TODO:");
  const foundTodo = todoApp.getTodoById(999);
  if (!foundTodo) {
    console.log("❌ TODO 不存在");
  }
}

// 运行演示
main();

// 导出类和接口，方便其他模块使用
export { TodoApp, Todo };
