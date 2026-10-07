# 前端代码规范

规范来源：[Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)。以下是本项目采用的具体约定。

- JavaScript 和 CSS 每级缩进使用 2 个空格。
- 变量和函数使用 `lowerCamelCase`，类使用 `UpperCamelCase`。
- 优先使用 `const`，需要重新赋值时使用 `let`，不使用 `var`。
- 使用单引号和语句分号。
- DOM 事件通过 `addEventListener` 绑定。
- 请求和界面逻辑分开，统一管理后端地址。
- 异步请求使用 `async` / `await`，处理 HTTP 失败、网络异常和加载状态。
- 显示用户输入或接口文本时使用 `textContent`，避免拼接进 `innerHTML`。
- 使用语义化 HTML，为输入提供标签，为按钮提供明确含义。
- 前端不执行数学表达式，不使用 `eval` 或 `Function` 计算结果。
