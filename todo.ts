// ==================== 模型定义 ====================

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type NewTodo = Pick<Todo, "title">;

// ==================== 服务层 ====================

class TodoService {
  private todos: Todo[] = [];
  private nextId: number = 1;

  /** 新增 */
  create(data: NewTodo): Todo {
    const now = new Date();
    const todo: Todo = {
      id: this.nextId++,
      title: data.title,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    this.todos.push(todo);
    return { ...todo };
  }

  /** 查询全部 */
  findAll(): Todo[] {
    return this.todos.map((t) => ({ ...t }));
  }

  /** 按 ID 查询 */
  findById(id: number): Todo | undefined {
    const todo = this.todos.find((t) => t.id === id);
    return todo ? { ...todo } : undefined;
  }

  /** 修改（支持部分更新） */
  update(
    id: number,
    changes: Partial<Pick<Todo, "title" | "completed">>
  ): Todo | undefined {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) return undefined;

    if (changes.title !== undefined) todo.title = changes.title;
    if (changes.completed !== undefined) todo.completed = changes.completed;
    todo.updatedAt = new Date();

    return { ...todo };
  }

  /** 删除 */
  delete(id: number): boolean {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.todos.splice(index, 1);
    return true;
  }
}

// ==================== 控制器（CLI 交互） ====================

class TodoController {
  constructor(private service: TodoService) {}

  /** 创建 */
  add(title: string): void {
    if (!title.trim()) {
      console.log("❌ 标题不能为空");
      return;
    }
    const todo = this.service.create({ title: title.trim() });
    console.log(`✅ 已添加: [${todo.id}] ${todo.title}`);
  }

  /** 列出全部 */
  list(): void {
    const todos = this.service.findAll();
    if (todos.length === 0) {
      console.log("📭 暂无待办事项");
      return;
    }
    console.log("\n📋 待办列表:");
    console.log("─".repeat(60));
    todos.forEach((t) => {
      const status = t.completed ? "✅" : "⬜";
      console.log(`  ${status} [${t.id}] ${t.title}`);
      console.log(`         创建: ${t.createdAt.toLocaleString()}`);
    });
    console.log("─".repeat(60));
    const done = todos.filter((t) => t.completed).length;
    console.log(`  共 ${todos.length} 项，已完成 ${done} 项\n`);
  }

  /** 完成 / 取消完成 */
  toggle(id: number): void {
    const existing = this.service.findById(id);
    if (!existing) {
      console.log(`❌ ID ${id} 不存在`);
      return;
    }
    const updated = this.service.update(id, { completed: !existing.completed });
    if (updated) {
      const status = updated.completed ? "已完成" : "未完成";
      console.log(`🔄 [${updated.id}] ${updated.title} → ${status}`);
    }
  }

  /** 修改标题 */
  edit(id: number, newTitle: string): void {
    if (!newTitle.trim()) {
      console.log("❌ 标题不能为空");
      return;
    }
    const updated = this.service.update(id, { title: newTitle.trim() });
    if (updated) {
      console.log(`✏️  [${updated.id}] 标题已修改为: ${updated.title}`);
    } else {
      console.log(`❌ ID ${id} 不存在`);
    }
  }

  /** 删除 */
  remove(id: number): void {
    const success = this.service.delete(id);
    if (success) {
      console.log(`🗑️  已删除 ID ${id}`);
    } else {
      console.log(`❌ ID ${id} 不存在`);
    }
  }
}

// ==================== 交互式 CLI ====================

class TodoApp {
  private controller: TodoController;

  constructor() {
    this.controller = new TodoController(new TodoService());
  }

  start(): void {
    console.log("🚀 Todo 应用已启动！");
    this.printHelp();
    this.run();
  }

  private printHelp(): void {
    console.log(`
📖 命令列表:
   add <标题>       - 新增待办
   list             - 查看全部待办
   done <id>        - 切换完成状态
   edit <id> <标题> - 修改标题
   rm  <id>         - 删除待办
   help             - 显示帮助
   exit             - 退出
`);
  }

  private run(): void {
    // 在 Node.js 环境中读取 stdin
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdin.setEncoding("utf-8");

    stdin.on("data", (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      const [cmd, ...args] = trimmed.split(/\s+/);

      switch (cmd.toLowerCase()) {
        case "add":
          this.controller.add(args.join(" "));
          break;
        case "list":
          this.controller.list();
          break;
        case "done":
          this.controller.toggle(Number(args[0]));
          break;
        case "edit":
          this.controller.edit(Number(args[0]), args.slice(1).join(" "));
          break;
        case "rm":
          this.controller.remove(Number(args[0]));
          break;
        case "help":
          this.printHelp();
          break;
        case "exit":
          console.log("👋 再见！");
          process.exit(0);
          break;
        default:
          console.log(`❓ 未知命令: ${cmd}，输入 help 查看帮助`);
      }
    });

    stdin.resume();
    stdout.write("todo> ");
  }
}

// ==================== 演示模式 ====================

function demo(): void {
  console.log("🎯 演示模式\n");

  const service = new TodoService();
  const controller = new TodoController(service);

  // 1. 创建
  console.log("=== 1. 创建待办 ===");
  controller.add("学习 TypeScript");
  controller.add("写一个 TODO 应用");
  controller.add("准备面试");

  // 2. 查询
  console.log("\n=== 2. 查看全部 ===");
  controller.list();

  // 3. 修改（切换完成状态）
  console.log("=== 3. 标记完成 ===");
  controller.toggle(1);
  controller.toggle(2);

  // 4. 修改标题
  console.log("\n=== 4. 修改标题 ===");
  controller.edit(3, "准备前端面试");

  // 5. 再次查看
  console.log("\n=== 5. 更新后查看 ===");
  controller.list();

  // 6. 删除
  console.log("=== 6. 删除 ===");
  controller.remove(2);

  // 7. 最终结果
  console.log("\n=== 7. 最终结果 ===");
  controller.list();
}

// ==================== 入口 ====================

// 默认运行演示模式
demo();

// 如果想启用交互式 CLI，注释掉 demo()，取消下面这行的注释：
// new TodoApp().start();

