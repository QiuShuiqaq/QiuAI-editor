# QiuAI-editor

QiuAI-editor 是一个面向论文、科研申报书、研究报告等正式文稿场景的纯桌面 AI 写作编辑器。它不是单纯的聊天壳，而是以“像 Word 一样稳定编辑”为前提，再叠加 agent 写作、改写、全文生成和 Word 导出能力。

当前稳定版本：`v1.0.2`

## v1.0.2 版本重点

- 修复 AI 生成正文后导出 Word 丢正文的问题
- 修复导出标题样式异常，避免大标题、小标题在 Word 中自动变蓝、变小
- AI 助手的“润色 / 精简 / 扩写”改为只处理当前选区，并直接替换原文
- 统一用户编辑、Agent 编辑、工具调用的核心写入边界，提升稳定性
- 修复字体、字号切换与多项常用编辑功能不生效的问题
- 默认不添加页眉页脚
- 任务窗口默认将“AI助手”置前，作为主入口
- 增加更清晰的进度提示与错误提示

## 产品定位

QiuAI-editor 采用 `Word-first + AI Agent` 的桌面写作路线：

- 默认编辑体验优先接近正式文稿编辑器
- 用户可以直接写，Agent 也可以直接改
- AI 能参与局部改写，也能基于大纲生成整篇草稿
- 最终目标是稳定落地到可导出、可交付的 `.docx` 文档

## 当前能力

### 1. 正式文稿编辑

- Ribbon 风格顶部工具栏
- 页面化编辑区
- 字体、字号、粗体、斜体、下划线、对齐、列表等基础排版
- 页边距、分页、页眉页脚、水印、边框等页面设置
- 查找替换、目录、任务窗口、右侧属性面板

### 2. AI 助手与 Agent 编辑

- 支持对话式写作协助
- 支持基于当前文档、当前章节、当前选区进行修改
- 支持润色、精简、扩写、重写
- 支持 agent 执行文档命令，而不只是返回文本
- 支持整篇论文生成进度反馈

### 3. 论文全文生成

- 支持导入多级大纲
- 支持直接把大纲粘贴给 AI 生成全文
- 支持结合章节结构逐段生成
- 支持参考资料上传与辅助生成
- 支持图表、目录等论文常见结构预留

### 4. 导出与交付

- 支持导出 Word
- 支持导出打印 HTML / PDF 过渡文件
- 导出时保留正文主体内容
- 导出标题样式按论文文稿预期显式控制

## 技术架构

这是一个 `pnpm workspace` 管理的 Electron 桌面项目：

- `packages/main`
  Electron 主进程、文件系统、导出、IPC、AI 调用
- `packages/renderer`
  React + TipTap 编辑器界面、AI 助手、Ribbon、任务面板
- `packages/shared`
  共享类型、文档模型、公共工具

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

### 开发启动

```bash
pnpm dev
```

或：

```bash
pnpm dev:desktop
```

### 启动已构建应用

```bash
pnpm start
```

### 构建

```bash
pnpm build
```

### 打包安装程序

```bash
pnpm package
```

### 质量检查

```bash
pnpm lint
pnpm test
```

## AI 配置

项目采用 API 配置方式接入模型，当前已验证过 DeepSeek 写作链路，但整体架构不限制只接入单一模型。

可参考 `.env.example` 与本地 `.env.local`：

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
  用于正文写作、润色、扩写等 AI 任务
- `ONLYOFFICE_*`
  预留给文档服务集成能力

## 数据目录

运行数据位于仓库内的 `DATA/`：

- `DATA/drafts`
  草稿与本地文档数据
- `DATA/document-engine-workspaces`
  文档引擎工作区

仓库中仅保留必要占位文件，运行期数据默认不提交。

## 文档

项目规格与架构说明位于 `docs/`：

- `docs/spec-qiuai-editor-word-first-experience.md`
- `docs/spec-document-engine-full-adaptation.md`
- `docs/spec-word-editor-core-migration.md`
- `docs/spec-citation-and-paper-safety.md`
- `docs/spec-qiuai-editor-desktop-architecture.md`

## 发布记录

### v1.0.2

- 完成一轮以“稳定落地”为核心的编辑链路修复
- 修复 AI 改写与导出 Word 的核心问题
- 优化论文写作场景下的默认交互与可用性

### v1.0.1

- 完成首轮稳定版发布整理

### v1.0.0

- 初始正式版本

## License

当前仓库暂未单独声明开源许可证。
