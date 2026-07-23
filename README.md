# PKUscore

本地运行的北京大学绩点换算网页。Python 负责树洞 HTML 解析、输入校验和 GPA 计算，HTML/CSS/JavaScript 负责展示与交互；不需要安装任何第三方依赖。

## 运行

### macOS 一键运行

直接双击项目根目录中的 `PKUscore.app`，程序会自动启动本地服务并打开浏览器，不需要使用终端。运行期间请保留 PKUscore 应用开启；从程序坞退出 PKUscore 后，本地服务也会停止。

如果 macOS 首次打开时显示安全提示，请在 Finder 中右键点击 `PKUscore.app`，选择“打开”，再确认一次。应用必须保留在项目根目录中，不能单独移动。

### Windows 一键运行

直接双击项目根目录中的 `PKUscore-Windows.cmd`。启动器会自动寻找 Python、选择可用端口并打开默认浏览器，不需要输入命令。运行期间请保留弹出的 PKUscore 窗口；关闭窗口或按 `Ctrl+C` 即可停止本地服务。

需要提前安装 Python 3.10 或更高版本。使用 Python 官方安装程序时，请勾选 **Add Python to PATH**。启动文件必须保留在项目根目录中，不能单独移动。

### 命令行运行

需要 Python 3.10 或更高版本：

```bash
python3 app.py
```

然后在浏览器打开 <http://127.0.0.1:8000>。如果 8000 端口已占用，可以运行：

```bash
python3 app.py --port 8080
```

按 `Ctrl+C` 停止服务。课程记录保存在当前浏览器的 `localStorage` 中，清理站点数据或更换浏览器会让记录消失。

## 使用

- 点击「添加学期」后可修改学期名称，再逐门添加课程。
- 点击课程卡片可编辑或删除课程。
- 点击「导入树洞源码」可查看分步骤复制教程，并直接解析成绩页的完整 `<body>` HTML。
- 顶部按钮可以切换明暗主题；首次打开时默认跟随系统主题。
- 百分制课程按 `G = 4 - 3 × (100 - S)² / 1600` 换算；低于 60 分的绩点为 0。合格制课程保留 P/F 结果，尚未结课的课程显示 IP，两者均不计入 GPA。

## 测试

```bash
python3 -m unittest discover -s tests -v
```

项目结构：

```text
app.py                 本地 HTTP 服务与 API
pkuscore/core.py        数据校验和 GPA 计算
pkuscore/parser.py      树洞成绩页 HTML 解析
static/                网页界面
tests/                 自动化测试
```
