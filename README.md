# 简算前端

一个简洁的网页计算器。支持键盘和按钮输入、运算结果、错误提示、计算历史分页、复用算式和单条删除。手机窄屏自动改为单列布局。

前端只负责交互和接口请求；计算与历史存储由独立 Python 后端完成。

在线访问：[在线计算器](http://117.50.199.166/chriskslna/)。2026-10-07 已完成公网页面、计算、历史和删除接口验收。

## 技术与环境

- HTML、CSS、原生 JavaScript，无 npm 依赖和构建步骤。
- 现代 Chrome、Edge、Firefox 等浏览器；建议使用当前稳定版。
- 本地启动辅助工具使用 Python 3.10 及以上。
- 后端项目：https://github.com/ChrisKslna/calculator-backend

## 本地启动

先按后端 README 启动 127.0.0.1:5000 的计算服务，再在前端仓库根目录运行：

```powershell
python serve.py
```

打开 http://127.0.0.1:8000/ 。不要直接双击 index.html，因为页面需要通过 HTTP 请求后端。

可调整本地端口：

```powershell
python serve.py --port 8000 --backend-port 5000
```

serve.py 只负责提供静态页面及转发 /api/ 请求，不执行数学计算。生产使用 Nginx 替代此本地辅助服务。

## 功能

- 四则运算、括号、小数、正负号输入。
- Enter 计算，Esc 清空，Backspace 退格。
- 结果和后端错误提示。
- 历史自动刷新、每页 5 条、手动刷新、按日期时间展示。
- 点击历史算式填回输入框，按 Enter 后重新向后端请求计算。
- 删除前确认，删除成功后重新查询后端数据库。
- 输入与请求期间状态提示，防止重复点击。
- 网络异常时显示错误，不在浏览器中计算备用结果。

## 接口和部署配置

src/app.js 根据当前页面目录生成 API 地址：根目录访问时使用 /api，部署在 /chriskslna/ 时使用 /chriskslna/api。独立后端提供：

- POST /api/calculate
- GET /api/history
- DELETE /api/history/{id}
- GET /api/health

本地由 serve.py 转发到后端；公网部署由 Nginx 配置 proxy_pass。无需把服务器地址写进 JavaScript。数据库由后端自动初始化，本仓库不保存数据库和历史缓存。

生产部署把 src/ 内文件放入独立 Nginx 静态目录，再代理 /api/。共享服务器可以使用独立端口，也可以为本项目增加独立路径，由 Nginx 去掉路径前缀后转发到本站。路径不带末尾斜线时应重定向到带斜线的地址。原首页和其他项目接口保持原有路由，详细说明见交付包 deploy/README.md。

## 目录

- src/index.html：语义化页面、计算器按键、历史列表和确认弹窗。
- src/styles.css：页面样式与响应式布局。
- src/app.js：交互、HTTP 请求和状态管理。
- src/favicon.svg：站点图标。
- serve.py：本地静态服务与 API 代理。
- codestyle.md：前端代码规范。

## 验收

依次测试 12+8、8-3、6*7、9/4、0.1+0.2、1+2*3、(1+2)*3、3*-2。再输入 1/0 和 1+ 检查错误提示。刷新页面后历史应保留，删除记录后再刷新应仍被删除。最后停止后端，确认网页不能独立产生新结果。

源码使用 textContent 显示外部文本，不使用 eval、Function 或 innerHTML 计算/拼接用户内容。
