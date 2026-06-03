# QiuAI-editor

QiuAI-editor 是一个面向科研人员、学生和项目工作者的桌面文档编辑器。

它的目标不是做一个“聊天工具外壳”，而是做一个 **高度仿 Word 的正式文档写作环境**，并在这个环境之上叠加 AI 写作、审阅、引用和全文生成能力。

当前版本：`v1.0.0`

## 项目定位

QiuAI-editor 采用 `Word-first + AI agent` 的产品方向：

- 默认体验应该像在用 Word 写正式文档
- AI 是增强层，不抢占主编辑流程
- 支持导入提纲后生成全文，再由用户继续编辑、审阅、导出
- 重点服务于论文、项目申报书、研究报告、总结材料等正式文档

## 当前能力

### 1. 正式文档编辑

- Word 风格 Ribbon 顶部操作区
- 页面化文档编辑体验
- 样式、段落、对齐、字号、字体等基础格式控制
- 页眉页脚、页边距、页面边框、水印、分栏等页面设置
- 查找替换、状态栏、导航区、任务窗格

### 2. AI 写作与代理能力

- AI 助手支持正常对话
- AI 助手支持执行编辑命令，而不只是聊天
- 支持润色、精简、扩写、重写
- 支持“根据当前提纲生成全文”
- 全文生成支持可见进度与流式写入体验

### 3. 提纲驱动全文生成

- 导入多级提纲
- 结合当前章节、相邻章节和全文规划生成正文
- 内置正式论文/报告写作规范
- 支持图表预留位自动插入
- 支持写作策略增强，不直接暴露底层技术名

### 4. 引用与论文安全方向

- Crossref / DOI 元数据接入基础
- 参考资料面板
- 交叉引用与目录相关能力骨架
- 审阅问题、事实核查、材料支撑方向的能力预留

## 技术架构

这是一个 `pnpm workspace` 管理的 Electron 桌面项目：

- `packages/main`
  Electron 主进程、文件系统、导出、AI 调用、桌面集成
- `packages/renderer`
  React + TipTap 编辑器界面、文档页面、AI 面板、Ribbon 与任务窗格
- `packages/shared`
  共享类型、文档数据模型、公共工具

## 本地开发

### 环境要求

- Node.js 20+
- pnpm
- Windows 桌面环境

### 安装依赖

```bash
corepack enable
pnpm install
```

### 启动桌面应用

```bash
pnpm dev
```

等价命令：

```bash
pnpm dev:desktop
```

### 单独启动前端开发服务

```bash
pnpm dev:server
```

### 构建

```bash
pnpm build
```

### 打包安装程序

```bash
pnpm package
```

## AI 配置

项目默认写作模型方向是 DeepSeek，但架构上不限制只有一种模型。

可参考 `.env.example`：

```env
DEEPSEEK_API_KEY=
QIUAI_DOCUMENT_HOST_PORT=3001
ONLYOFFICE_DOCUMENT_SERVER=
ONLYOFFICE_HOST_PAGE_URL=
ONLYOFFICE_DOCUMENT_URL_BASE=
ONLYOFFICE_CALLBACK_URL=
```

说明：

- `DEEPSEEK_API_KEY`
  用于正文写作、润色、扩写等任务
- `ONLYOFFICE_*`
  用于 ONLYOFFICE 文档服务集成，当前可选

建议本地创建：

```env
.env.local
```

## 数据目录

项目运行数据已经迁移到仓库内的 `DATA/` 目录管理，避免默认散落在系统盘临时路径中。

当前约定：

- `DATA/drafts`
  草稿与本地文档数据
- `DATA/document-engine-workspaces`
  文档编辑引擎工作区

仓库中只保留 `DATA/.gitkeep`，运行时数据不会提交。

## 项目文档

仓库内已有多份规格文档，位于 `docs/`：

- `docs/spec-qiuai-editor-word-first-experience.md`
- `docs/spec-document-engine-full-adaptation.md`
- `docs/spec-word-editor-core-migration.md`
- `docs/spec-citation-and-paper-safety.md`
- `docs/spec-qiuai-editor-desktop-architecture.md`

这些文档记录了当前产品方向、编辑内核改造、引用系统与论文安全方案。

## 当前版本说明

`v1.0.0` 是 QiuAI-editor 的第一个正式主版本，重点完成了：

- Word-first 的整体产品方向落地
- 桌面编辑器基础可用
- AI 助手与全文生成主链路打通
- 文档页面内核、任务窗格、Ribbon、帮助说明等主交互建立
- 本地数据目录、导出、引用方向与后续扩展基础搭好

## 后续路线

下一阶段将继续完善：

- 更稳定的 Word 级页面排版
- 更完整的表格、图片、图题、表题与交叉引用
- 修订模式与审阅闭环
- 更成熟的参考文献格式化
- 更强的 AI agent 控制能力
- ONLYOFFICE 深度集成能力

## License

当前仓库暂未单独声明开源许可证。

