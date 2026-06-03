# Spec: QiuAI-editor Citation And Paper Safety

## Objective

为 `QiuAI-editor` 增加一套面向专业报告、学生论文与正式材料写作的：

- 引用与参考文献系统
- 来源追踪系统
- 论文安全与写作过程证明系统

目标不是“绕过 AI 检测”，而是让用户能够：

1. 更规范地管理文献与引用
2. 更可靠地为事实、数据、定义、图表绑定来源
3. 更清楚地展示 AI 参与边界
4. 在需要时导出可解释、可追溯、可复核的写作证据

产品定位：

- `Citation-first`：正式写作时，引用系统是基础能力，不是附属插件
- `Source-visible`：用户随时知道一句话、一个图表、一个结论的来源在哪里
- `Safety-by-design`：论文安全依赖来源扎实、过程可证、AI 可披露，而不是承诺“通过检测”
- `Word-first`：引用能力嵌入现有 Word-like 编辑流程，而不是独立学术工具界面

## Product Principles

### 1. Formal Writing First

- 支持项目报告、课程论文、毕业论文、研究综述、技术白皮书
- 默认用语应偏正式、学术、可提交

### 2. Citation As Infrastructure

- 文中引用、脚注、尾注、参考文献、图表来源、交叉引用属于基础设施
- 不能只做“插入一个括号引用”的浅层体验

### 3. Traceability Over Guessing

- 系统优先记录“用户如何写出来”
- 系统优先展示“内容依据什么资料”
- 系统不把 AI 检测分数当成最终真相

### 4. AI Transparency

- AI 的角色是辅助写作
- AI 参与应可记录、可回看、可导出说明
- 不鼓励伪装为“纯人工完全未辅助”

### 5. Safety Reporting, Not Bypass

- 产品可以输出风险提示
- 产品不应宣传“降 AIGC 率”“过检测”“规避学校系统”

## Scope

本规范覆盖：

- 引用源管理
- DOI / 标题 / 作者检索导入
- 文中引用与参考文献联动
- 句子级来源绑定
- 图题/表题来源绑定
- 写作过程记录
- AI 使用记录
- 论文安全报告

本规范暂不覆盖：

- 第三方商业查重系统深度集成
- DOI 注册与写回
- 学校教务平台对接
- 自动生成整篇论文格式模板库

## External Sources And Configuration

### Crossref

用途：

- 论文、期刊、会议论文元数据检索
- DOI 元数据补全

默认接入方式：

- 公开 REST API
- 第一版通常不需要额外账号或 API Key

建议配置：

- `CROSSREF_CONTACT_EMAIL`
- 规范 `User-Agent`

可选后续能力：

- 高调用量时接入 Crossref Plus

### DataCite

用途：

- 数据集 DOI 元数据
- 部分研究对象、研究产出记录

默认接入方式：

- 公开 API 查询
- 第一版通常不需要额外账号

后续需要认证的情况：

- 创建或修改 DOI 元数据

### citeproc-js

用途：

- 根据 CSL 样式渲染文中引用
- 根据 CSL 样式渲染参考文献

接入方式：

- 本地 npm 依赖
- 不需要外部账号

额外资源：

- CSL 样式文件
- locale 文件

### First Release Recommendation

第一版推荐：

1. 先接 `Crossref`
2. 同时接 `citeproc-js`
3. `DataCite` 作为补充源
4. 暂不做需要账号写权限的元数据写回

## User Stories

### 专业报告用户

- 作为项目经理，我希望快速插入规范的引用和参考文献，保证正式报告可信
- 作为咨询顾问，我希望能给图表、数据结论和事实表绑定来源
- 作为技术作者，我希望切换引用样式时全篇自动更新

### 学生用户

- 作为学生，我希望记录论文写作过程，减少被误判的风险
- 作为学生，我希望知道哪些段落缺来源、哪些句子证据不足
- 作为学生，我希望导出一份“写作过程与引用证明”

### 审阅者 / 指导教师视角

- 作为导师，我希望能看到一篇文档的来源扎实程度
- 作为审阅者，我希望知道 AI 参与范围，而不是只看模糊检测分数

## Functional Requirements

### A. Reference Library

系统必须支持：

1. 新建文献条目
2. 手动录入文献
3. 通过 DOI 导入
4. 通过标题/作者检索导入
5. 导入网页来源
6. 导入 PDF 并附加为本地资料
7. 编辑与去重
8. 按类型管理

文献类型至少包括：

- journal-article
- conference-paper
- thesis
- book
- book-chapter
- report
- webpage
- dataset
- standard
- patent
- legislation

### B. Citation In Document

系统必须支持：

1. 在光标处插入引用
2. 为一个引用绑定一个或多个文献
3. 插入页码、前缀、后缀
4. 文中引用与参考文献自动联动
5. 删除正文中的引用后，参考文献自动刷新
6. 切换引用样式后，全篇自动重排

支持形式：

- author-date
- numeric
- footnote

### C. Bibliography

系统必须支持：

1. 自动生成参考文献区块
2. 自动排序
3. 自动去重
4. 未在正文引用的文献提醒
5. 正文引用缺失文献信息提醒

第一版必须支持的样式：

- GB/T 7714
- APA
- IEEE

### D. Claim-To-Source Binding

系统必须支持：

1. 将句子或段落绑定到一个或多个来源
2. 区分绑定类型：
   - fact
   - data
   - definition
   - quote
   - image-source
   - table-source
3. 显示来源强度：
   - primary
   - secondary
4. 从绑定关系反查原文位置

### E. Figure / Table Source Binding

系统必须支持：

1. 图题绑定来源
2. 表题绑定来源
3. 图表说明文字绑定来源
4. 导出时附带图表来源信息

### F. Paper Safety Mode

系统必须支持一个“论文安全”视图，输出以下风险提示：

1. 缺引用断言
2. 数据句无来源
3. 图表无来源
4. 文献条目缺作者/年份/标题
5. 正文未引用但文末出现
6. 正文引用但文献库信息不完整
7. 术语前后不一致
8. 多段内容证据支撑不足

### G. Writing Provenance

系统必须记录：

1. 文档快照时间线
2. 章节级修改历史
3. AI 生成、AI 润色、人工输入的操作痕迹
4. 粘贴大段文本事件
5. 引用插入与来源绑定时间点

### H. AI Disclosure

系统必须支持：

1. 对段落记录 AI 参与类型
2. 标明模型、时间、任务类型
3. 区分：
   - human-written
   - ai-generated
   - ai-polished
   - ai-drafted-human-revised
4. 导出 AI 使用说明摘要

## Non-Goals

以下不作为第一阶段目标：

1. 承诺“通过学校 AI 检测”
2. 提供“规避检测”写作模式
3. 自动伪装文本来源
4. 直接对接学校处罚或申诉流程

## Data Model

这里的“数据模型”指：

- 在本地存储、状态管理、文档结构、导出结构中
- 如何定义引用、来源、AI 使用记录和安全报告对象

### 1. ReferenceSource

表示一条来源记录。

建议字段：

- `id`
- `type`
- `title`
- `subtitle`
- `authors`
- `editors`
- `year`
- `issuedDate`
- `publisher`
- `containerTitle`
- `volume`
- `issue`
- `pages`
- `doi`
- `url`
- `isbn`
- `issn`
- `language`
- `abstract`
- `keywords`
- `sourceProvider`
- `sourceRaw`
- `localAttachmentIds`
- `createdAt`
- `updatedAt`

### 2. ReferenceAuthor

表示作者或编辑者。

建议字段：

- `family`
- `given`
- `literal`
- `orcid`
- `affiliation`

### 3. CitationOccurrence

表示一处正文中的引用。

建议字段：

- `id`
- `documentAnchorId`
- `from`
- `to`
- `sourceIds`
- `styleMode`
- `prefix`
- `suffix`
- `locator`
- `noteNumber`
- `createdAt`
- `updatedAt`

### 4. CitationStyleProfile

表示当前文档引用样式配置。

建议字段：

- `styleId`
- `styleLabel`
- `locale`
- `citationMode`
- `sortMode`
- `bibliographyTitle`

### 5. ClaimEvidenceLink

表示一句话或一段话与来源的绑定关系。

建议字段：

- `id`
- `from`
- `to`
- `claimType`
- `sourceLinks`
- `confidence`
- `notes`
- `createdAt`
- `updatedAt`

### 6. ClaimEvidenceSourceLink

表示 Claim 与某个来源之间的具体连接。

建议字段：

- `sourceId`
- `relevance`
- `locator`
- `excerpt`

### 7. FigureTableSourceLink

表示图/表来源绑定。

建议字段：

- `id`
- `targetType`
- `targetAnchorId`
- `sourceIds`
- `captionText`
- `notes`

### 8. AiAuthorshipRecord

表示 AI 参与记录。

建议字段：

- `id`
- `from`
- `to`
- `actionType`
- `provider`
- `model`
- `promptDigest`
- `acceptedMode`
- `createdAt`

### 9. WritingSnapshot

表示文档演化快照。

建议字段：

- `id`
- `createdAt`
- `wordCount`
- `pageCount`
- `sectionSummaries`
- `editorContentDigest`
- `eventType`

### 10. PaperSafetyIssue

表示一条风险项。

建议字段：

- `id`
- `severity`
- `category`
- `message`
- `from`
- `to`
- `relatedSourceIds`
- `suggestion`

### 11. PaperSafetyReport

表示一份整稿安全报告。

建议字段：

- `generatedAt`
- `overallRisk`
- `citationCoverage`
- `uncitedClaimCount`
- `dataWithoutSourceCount`
- `figureWithoutSourceCount`
- `tableWithoutSourceCount`
- `aiAssistedParagraphCount`
- `issues`

## Suggested Shared Types

建议在 `@qiuai/shared` 中新增以下类型：

- `ReferenceSource`
- `ReferenceAuthor`
- `CitationOccurrence`
- `CitationStyleProfile`
- `ClaimEvidenceLink`
- `FigureTableSourceLink`
- `AiAuthorshipRecord`
- `WritingSnapshot`
- `PaperSafetyIssue`
- `PaperSafetyReport`

并将这些内容挂到文档状态中。

## Document State Extension

建议扩展 `documentState`：

- `referenceSources: ReferenceSource[]`
- `citationOccurrences: CitationOccurrence[]`
- `citationStyle: CitationStyleProfile`
- `claimEvidenceLinks: ClaimEvidenceLink[]`
- `figureTableSourceLinks: FigureTableSourceLink[]`
- `aiAuthorshipRecords: AiAuthorshipRecord[]`
- `writingSnapshots: WritingSnapshot[]`
- `paperSafetyReport: PaperSafetyReport | null`

## Architecture Recommendation

### Module 1: Reference Engine

职责：

- Crossref / DataCite 查询
- 文献库管理
- 去重
- 引文插入

### Module 2: Citation Formatting Engine

职责：

- citeproc-js 接入
- 文中引用渲染
- 参考文献生成
- 样式切换

### Module 3: Source Trace Engine

职责：

- Claim 到 Source 的绑定
- 图表来源绑定
- 来源可视化

### Module 4: Provenance Engine

职责：

- 写作快照
- AI 参与记录
- 编辑事件时间线

### Module 5: Paper Safety Engine

职责：

- 风险规则扫描
- 安全报告生成
- 导出证据包

## UI Placement

### Ribbon

建议新增或增强：

- `引用`
  - 插入引用
  - 管理来源
  - 切换引文样式
  - 插入参考文献
  - 插入脚注 / 尾注
- `审阅`
  - 论文安全
  - AI 使用说明
  - 引用缺失检查

### Right Task Pane

建议新增或增强：

- `参考资料`
  - 文献库
  - DOI 检索
  - 当前段落来源
- `审阅`
  - 论文安全报告
  - 引用覆盖率
  - 风险问题列表

### Context Menu / Inline

选中文本时建议出现：

- 绑定来源
- 插入引用
- 标记为事实
- 标记为定义
- 标记为数据句

## Acceptance Criteria

做到以下几点，用户才会觉得这套能力是“能用于正式写作”的：

1. 用户可通过 DOI 或标题检索导入文献
2. 插入文中引用后，参考文献自动更新
3. 切换样式后，文中引用和参考文献都重排
4. 一句话可绑定到具体来源
5. 图题、表题可绑定来源
6. 系统能提示缺引用断言和数据无来源问题
7. 系统能记录 AI 参与段落
8. 系统可导出一份论文安全报告或证据摘要

## Verification Checklist

手动验收步骤：

1. 导入一条 DOI 文献，检查元数据是否正确写入文献库
2. 在正文插入引用，检查参考文献是否自动出现
3. 切换引用样式，检查全篇是否同步变化
4. 对一句事实绑定来源，检查右侧面板是否可追踪
5. 给图题和表题绑定来源，检查是否可展示和导出
6. 生成论文安全报告，检查是否能识别无来源段落
7. 执行一次 AI 润色，检查是否生成 AI 使用记录
8. 导出证据摘要，检查是否包含引用、来源、AI 使用与风险信息

## Implementation Priority

### P0

- 文献库基础结构
- Crossref 检索与 DOI 导入
- citeproc-js 接入
- 文中引用 / 参考文献联动
- 基础样式切换

### P1

- DataCite 补充接入
- 句子级来源绑定
- 图题表题来源绑定
- 引用缺失与元数据完整性检查

### P2

- 写作快照与过程记录
- AI 使用记录
- 论文安全报告
- 导出证据摘要

### P3

- 可选第三方检测接入
- 更高级来源质量评分
- 机构模板 / 学校规范预设

## Boundaries

### Always

- 把引用系统做成正式写作基础设施
- 把“论文安全”定义为来源扎实、过程可证、AI 可披露
- 所有提示都应可解释、可追踪

### Ask First

- 接入付费元数据服务
- 接入第三方商业 AI 检测服务
- 引入会改变现有文档结构的块级引用节点

### Never

- 不宣传“绕过 AI 检测”
- 不承诺“必过学校系统”
- 不伪造写作过程记录
- 不把检测分数当成唯一结论
