import { Alert, Divider, Modal, Typography } from 'antd';

const { Paragraph, Text, Title } = Typography;

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Modal
      title="帮助"
      open={open}
      onCancel={onClose}
      onOk={onClose}
      okText="知道了"
      cancelButtonProps={{ style: { display: 'none' } }}
      width={920}
    >
      <Alert
        type="info"
        showIcon
        message="QiuAI-editor 的定位"
        description="它首先是一款高度贴近 Word 的正式文档编辑器，AI 是建立在主编辑流程之上的增强层。你可以先像使用 Word 一样排版、分页、保存和导出，再按需要打开 AI 辅助。"
        style={{ marginBottom: 16 }}
      />

      <Title level={5}>1. 基本使用</Title>
      <Paragraph>
        <Text strong>新建文档：</Text>
        点击左上角“新建文档”后，系统会立即创建一份本地草稿，并同步出现在“打开草稿”列表中。
      </Paragraph>
      <Paragraph>
        <Text strong>打开草稿：</Text>
        点击左上角文件夹按钮，可以继续编辑之前保存过的文档。
      </Paragraph>
      <Paragraph>
        <Text strong>保存状态：</Text>
        底部状态栏会显示页码、字数、当前样式、对齐状态和保存状态，方便随时确认当前位置。
      </Paragraph>
      <Paragraph>
        <Text strong>分页编辑：</Text>
        主编辑区按 A4 文档页面连续排版，正文应始终在白色页面范围内编辑，灰色区域只是文档外部背景。
      </Paragraph>

      <Divider />

      <Title level={5}>2. Word 主流程 + AI 增强</Title>
      <Paragraph>
        <Text strong>开始：</Text>
        处理字体、字号、加粗、对齐、列表、查找替换，这些都是主写作流程里的高频动作。
      </Paragraph>
      <Paragraph>
        <Text strong>插入：</Text>
        可插入图片、表格、公式、页码、分页符、交叉引用，以及项目特有的文本框、形状、图表块。
      </Paragraph>
      <Paragraph>
        <Text strong>页面布局：</Text>
        用于调整页边距、分栏、水印、页面边框和页眉页脚。
      </Paragraph>
      <Paragraph>
        <Text strong>AI 工具：</Text>
        用于润色、精简、扩写、续写和章节级辅助生成。导入大纲后，还可以直接生成整篇论文初稿。AI 默认不会直接覆盖原文，除非你明确触发“生成全文”这类整稿动作。
      </Paragraph>

      <Divider />

      <Title level={5}>3. 推荐工作流</Title>
      <Paragraph>先导入大纲或手动搭建章节结构，再决定是直接生成整篇论文初稿，还是逐章补正文、调样式、做分页。</Paragraph>
      <Paragraph>需要一键起稿时，可在“批量导入提纲”里选择“导入并生成全文”，也可以在右侧 AI 助手里点击“生成全文”。</Paragraph>
      <Paragraph>需要精细修改时，再打开右侧“AI 助手”或“写作策略”，让 AI 基于当前段落、章节和文档上下文给出建议。</Paragraph>
      <Paragraph>准备交付前，再统一检查目录、交叉引用、参考资料、页眉页脚和导出结果。</Paragraph>

      <Divider />

      <Title level={5}>4. 右侧任务窗格</Title>
      <Paragraph>
        <Text strong>属性：</Text>
        查看和调整当前段落、页面和对象属性。
      </Paragraph>
      <Paragraph>
        <Text strong>AI 助手：</Text>
        适合对话、追问、解释、重写、即时写作协助，以及直接代你执行“生成全文”等编辑动作。
      </Paragraph>
      <Paragraph>
        <Text strong>写作策略：</Text>
        面向章节级组织、论证结构、材料支撑和上下文衔接。
      </Paragraph>
      <Paragraph>
        <Text strong>审阅：</Text>
        汇总待核查项、一致性问题和修订建议。
      </Paragraph>
      <Paragraph>
        <Text strong>参考资料：</Text>
        管理文献、材料和引用来源，适合科研报告、论文和项目申报场景。
      </Paragraph>

      <Divider />

      <Title level={5}>5. 和 Word 的区别</Title>
      <Paragraph>
        QiuAI-editor 的目标不是替代 Word 的基础编辑体验，而是在 Word 式交互基础上增加“导入大纲后生成正文”“章节级 AI 辅助”“材料支撑与引用管理”“论文安全与审阅提醒”等能力。
      </Paragraph>
    </Modal>
  );
}
