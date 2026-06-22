"use strict";
// TODO 应用 - TypeScript 实现
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoApp = void 0;
// Todo 类
var TodoApp = /** @class */ (function () {
    function TodoApp() {
        this.todos = [];
        this.nextId = 1;
    }
    // 创建新的 TODO
    TodoApp.prototype.createTodo = function (title, description) {
        if (description === void 0) { description = ""; }
        var newTodo = {
            id: this.nextId++,
            title: title,
            description: description,
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.todos.push(newTodo);
        console.log("\u2705 \u521B\u5EFA TODO: \"".concat(title, "\" (ID: ").concat(newTodo.id, ")"));
        return newTodo;
    };
    // 获取所有 TODO
    TodoApp.prototype.getAllTodos = function () {
        return __spreadArray([], this.todos, true);
    };
    // 根据 ID 获取单个 TODO
    TodoApp.prototype.getTodoById = function (id) {
        return this.todos.find(function (todo) { return todo.id === id; });
    };
    // 更新 TODO
    TodoApp.prototype.updateTodo = function (id, updates) {
        var todoIndex = this.todos.findIndex(function (todo) { return todo.id === id; });
        if (todoIndex === -1) {
            console.log("\u274C \u672A\u627E\u5230 ID \u4E3A ".concat(id, " \u7684 TODO"));
            return null;
        }
        this.todos[todoIndex] = __assign(__assign(__assign({}, this.todos[todoIndex]), updates), { updatedAt: new Date() });
        console.log("\uD83D\uDCDD \u66F4\u65B0 TODO (ID: ".concat(id, ")"));
        return this.todos[todoIndex];
    };
    // 删除 TODO
    TodoApp.prototype.deleteTodo = function (id) {
        var todoIndex = this.todos.findIndex(function (todo) { return todo.id === id; });
        if (todoIndex === -1) {
            console.log("\u274C \u672A\u627E\u5230 ID \u4E3A ".concat(id, " \u7684 TODO"));
            return false;
        }
        var deletedTodo = this.todos.splice(todoIndex, 1)[0];
        console.log("\uD83D\uDDD1\uFE0F \u5220\u9664 TODO: \"".concat(deletedTodo.title, "\" (ID: ").concat(id, ")"));
        return true;
    };
    // 切换 TODO 完成状态
    TodoApp.prototype.toggleTodo = function (id) {
        var todo = this.getTodoById(id);
        if (!todo) {
            console.log("\u274C \u672A\u627E\u5230 ID \u4E3A ".concat(id, " \u7684 TODO"));
            return null;
        }
        return this.updateTodo(id, { completed: !todo.completed });
    };
    // 获取已完成的 TODO
    TodoApp.prototype.getCompletedTodos = function () {
        return this.todos.filter(function (todo) { return todo.completed; });
    };
    // 获取未完成的 TODO
    TodoApp.prototype.getIncompleteTodos = function () {
        return this.todos.filter(function (todo) { return !todo.completed; });
    };
    // 显示所有 TODO
    TodoApp.prototype.displayTodos = function () {
        console.log("\n📋 当前 TODO 列表:");
        console.log("=".repeat(50));
        if (this.todos.length === 0) {
            console.log("暂无 TODO 项目");
            return;
        }
        this.todos.forEach(function (todo) {
            var status = todo.completed ? "✅ 已完成" : "⏳ 未完成";
            console.log("".concat(todo.id, ". ").concat(todo.title, " - ").concat(status));
            if (todo.description) {
                console.log("   \u63CF\u8FF0: ".concat(todo.description));
            }
            console.log("   \u521B\u5EFA\u65F6\u95F4: ".concat(todo.createdAt.toLocaleString()));
            console.log("   \u66F4\u65B0\u65F6\u95F4: ".concat(todo.updatedAt.toLocaleString()));
            console.log("-".repeat(30));
        });
    };
    // 获取统计信息
    TodoApp.prototype.getStats = function () {
        return {
            total: this.todos.length,
            completed: this.getCompletedTodos().length,
            incomplete: this.getIncompleteTodos().length,
        };
    };
    return TodoApp;
}());
exports.TodoApp = TodoApp;
// 演示使用
function main() {
    var todoApp = new TodoApp();
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
    var stats = todoApp.getStats();
    console.log("\u603B\u8BA1: ".concat(stats.total));
    console.log("\u5DF2\u5B8C\u6210: ".concat(stats.completed));
    console.log("\u672A\u5B8C\u6210: ".concat(stats.incomplete));
    // 删除一个 TODO
    console.log("\n🗑️ 删除 TODO:");
    todoApp.deleteTodo(4);
    // 显示最终列表
    todoApp.displayTodos();
    // 尝试获取不存在的 TODO
    console.log("\n🔍 查找 TODO:");
    var foundTodo = todoApp.getTodoById(999);
    if (!foundTodo) {
        console.log("❌ TODO 不存在");
    }
}
// 运行演示
main();
