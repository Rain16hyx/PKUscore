# PKUscore

本地运行的北京大学绩点换算网页。Python 负责树洞 HTML 解析、输入校验和 GPA 计算，HTML/CSS/JavaScript 负责展示与交互；不需要安装任何第三方依赖。

## 运行

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
- 百分制课程按 `G = 4 - 3 × (100 - S)² / 1600` 换算；低于 60 分的绩点为 0。合格制课程保留学分与 P/F 结果，但不计入 GPA。

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
