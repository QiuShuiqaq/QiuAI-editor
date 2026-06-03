import { Alert, Button, Divider, Empty, Input, InputNumber, Select, Space, Tag, message } from 'antd';
import type { PaperSpineCitationSupport, PaperSpineRationaleEntry } from '@qiuai/shared';
import { executeDocumentCommand } from '../../services/documentEngineCommands';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { DISPLAY_ALIGN_LABELS, normalizeStyleLabel } from '../../utils/displayText';
import { supportsDocumentCommands } from '../../utils/documentEngineCapabilities';

function SectionCard({
  title,
  children,
  extra,
}: {
  title: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 700,
          color: '#1f1f1f',
        }}
      >
        <span>{title}</span>
        {extra}
      </div>
      {children}
    </section>
  );
}

function ValueCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        border: '1px solid #dbe3ef',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
      }}
    >
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

function InsightList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: '#8c8c8c' }}>{emptyText}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, index) => (
        <div
          key={`${item}-${index}`}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#ffffff',
            fontSize: 12,
            lineHeight: 1.6,
            color: '#262626',
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function SupportTags({ items }: { items: PaperSpineCitationSupport[] }) {
  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: '#8c8c8c' }}>暂无材料支撑</div>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((item, index) => (
        <Tag key={`${item.chunkId}-${index}`} color={item.relevance === 'primary' ? 'blue' : 'default'}>
          {item.chunkId}
        </Tag>
      ))}
    </div>
  );
}

function RationaleCard({ entry }: { entry: PaperSpineRationaleEntry }) {
  const purposeLabelMap: Record<PaperSpineRationaleEntry['purpose'], string> = {
    background: '背景',
    problem: '问题',
    method: '方法',
    evidence: '证据',
    impact: '价值',
  };

  return (
    <div
      style={{
        marginBottom: 8,
        padding: 10,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <Tag color="gold">{purposeLabelMap[entry.purpose]}</Tag>
        <span style={{ fontSize: 12, color: '#262626', lineHeight: 1.5 }}>{entry.claim}</span>
      </div>
      <SupportTags items={entry.support} />
    </div>
  );
}

const FONT_OPTIONS = [
  { value: 'SimSun, serif', label: '宋体' },
  { value: 'SimHei, sans-serif', label: '黑体' },
  { value: 'FangSong, serif', label: '仿宋' },
  { value: 'KaiTi, serif', label: '楷体' },
  { value: 'Microsoft YaHei, sans-serif', label: '微软雅黑' },
];

const STYLE_OPTIONS = [
  { value: 'Normal', label: '正文', sample: '项目报告正文内容', fontSize: 13, fontWeight: 400, align: 'left' as const },
  { value: 'Heading1', label: '标题 1', sample: '一、项目概述', fontSize: 16, fontWeight: 700, align: 'center' as const },
  { value: 'Heading2', label: '标题 2', sample: '（一）建设目标', fontSize: 14, fontWeight: 700, align: 'left' as const },
  { value: 'Heading3', label: '标题 3', sample: '1. 关键任务', fontSize: 13, fontWeight: 700, align: 'left' as const },
  { value: 'Caption', label: '图注', sample: '图 1 系统结构图', fontSize: 11, fontWeight: 400, align: 'center' as const },
  { value: 'TableCaption', label: '表注', sample: '表 1 项目进度表', fontSize: 11, fontWeight: 400, align: 'center' as const },
  { value: 'Quote', label: '引用', sample: '关键引文或说明文字', fontSize: 12, fontWeight: 400, align: 'left' as const },
];

const LINE_HEIGHT_OPTIONS = [
  { value: '1.0', label: '1.0' },
  { value: '1.15', label: '1.15' },
  { value: '1.5', label: '1.5' },
  { value: '1.75', label: '1.75' },
  { value: '2.0', label: '2.0' },
  { value: '28pt', label: '固定值 28pt' },
];

const SPACE_OPTIONS = [
  { value: '0pt', label: '0pt' },
  { value: '6pt', label: '6pt' },
  { value: '8px', label: '8px' },
  { value: '12pt', label: '12pt' },
  { value: '18pt', label: '18pt' },
];

const INDENT_OPTIONS = [
  { value: '0em', label: '无缩进' },
  { value: '2em', label: '首行缩进 2 字符' },
  { value: '4em', label: '首行缩进 4 字符' },
];

function resolveStyleValue(styleLabel: string): string {
  const normalized = normalizeStyleLabel(styleLabel);
  if (normalized === '标题 1') return 'Heading1';
  if (normalized === '标题 2') return 'Heading2';
  if (normalized === '标题 3') return 'Heading3';
  if (normalized === '图注') return 'Caption';
  if (normalized === '表注') return 'TableCaption';
  if (normalized === '引用') return 'Quote';
  return 'Normal';
}

async function runParagraphCommands(attrs: Record<string, string | null>) {
  const commandMap: Record<string, string> = {
    lineHeight: 'set-line-height',
    spaceBefore: 'set-space-before',
    spaceAfter: 'set-space-after',
    textIndent: 'set-text-indent',
    marginLeft: 'set-margin-left',
    marginRight: 'set-margin-right',
  };

  const results = await Promise.all(
    Object.entries(attrs)
      .filter(([key]) => Boolean(commandMap[key]))
      .map(([key, value]) => executeDocumentCommand(commandMap[key], { value }))
  );

  return results.every(Boolean);
}

export function PropertiesPanel() {
  const editor = useEditorStore((state) => state.editor);
  const formatting = useEditorStore((state) => state.formatting);
  const activeSectionTitle = useEditorStore((state) => state.activeSectionTitle);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const canRunFormattingCommands = supportsDocumentCommands(documentEngineAdapter) || Boolean(editor);
  const isImageSelected =
    formatting.activeObject === 'image' ||
    editor?.isActive('image') ||
    editor?.state.selection.$from.node()?.type.name === 'image';
  const imageAttrs = isImageSelected ? editor?.getAttributes('image') : null;
  const currentStyle = resolveStyleValue(formatting.styleLabel);

  if (!editor && !documentEngineAdapter) {
    return (
      <div style={{ padding: 16 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="编辑器尚未完成加载。打开文档后，这里会显示当前段落与对象的格式状态。"
        />
      </div>
    );
  }

  const applyStyle = async (styleName: string) => {
    const success = await executeDocumentCommand('apply-style', { value: styleName });
    if (!success) {
      message.warning('当前区域暂时无法应用这个样式。');
    }
  };

  const setParagraphAttrs = async (attrs: Record<string, string | null>) => {
    const success = await runParagraphCommands(attrs);
    if (!success) {
      message.warning('部分段落设置未能成功应用。');
    }
  };

  const clearFormatting = async () => {
    const success = await executeDocumentCommand('clear-formatting');
    if (!success) {
      message.warning('当前区域暂时无法清除格式。');
    }
  };

  if (!editor && documentEngineAdapter && isImageSelected) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="info"
          showIcon
          message="当前已选中图片"
          description="可以继续调整图片的基础属性。更完整的图片版式控制会在后续版本继续补齐。"
        />
      </div>
    );
  }

  if (editor && isImageSelected && imageAttrs) {
    return (
      <div style={{ padding: 16 }}>
        <SectionCard title="图片属性">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>宽度</label>
              <InputNumber
                size="small"
                style={{ width: '100%' }}
                min={10}
                max={800}
                value={Number.parseInt(imageAttrs.width as string, 10) || undefined}
                onChange={(value) =>
                  editor.chain().focus().updateAttributes('image', { width: value ? `${value}px` : null }).run()
                }
                placeholder="自动"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>高度</label>
              <InputNumber
                size="small"
                style={{ width: '100%' }}
                min={10}
                max={800}
                value={Number.parseInt(imageAttrs.height as string, 10) || undefined}
                onChange={(value) =>
                  editor.chain().focus().updateAttributes('image', { height: value ? `${value}px` : null }).run()
                }
                placeholder="自动"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>对齐</label>
              <Space size={6}>
                <Button
                  size="small"
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes('image', { style: 'display:block;margin:0 auto' })
                      .run()
                  }
                >
                  居中
                </Button>
                <Button
                  size="small"
                  onClick={() => editor.chain().focus().updateAttributes('image', { style: null }).run()}
                >
                  默认
                </Button>
              </Space>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>替代文本</label>
              <Input
                size="small"
                value={(imageAttrs.alt as string) || ''}
                onChange={(event) => editor.chain().focus().updateAttributes('image', { alt: event.target.value }).run()}
                placeholder="用于说明图片内容"
              />
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <SectionCard title="当前段落" extra={<Tag color="blue">{activeSectionTitle || '正文编辑中'}</Tag>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <ValueCard label="当前样式" value={normalizeStyleLabel(formatting.styleLabel)} />
          <ValueCard label="对齐方式" value={DISPLAY_ALIGN_LABELS[formatting.textAlign]} />
          <ValueCard label="行距" value={formatting.lineHeight} />
          <ValueCard label="首行缩进" value={formatting.textIndent} />
          <ValueCard label="段前" value={formatting.spaceBefore} />
          <ValueCard label="段后" value={formatting.spaceAfter} />
          <ValueCard label="左缩进" value={formatting.marginLeft} />
          <ValueCard label="右缩进" value={formatting.marginRight} />
        </div>
      </SectionCard>

      {!canRunFormattingCommands ? (
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message="当前先显示状态信息"
          description="部分排版命令会根据编辑区域逐步开放，但当前格式状态会持续和正文同步。"
        />
      ) : null}

      <SectionCard title="样式库">
        <div style={{ display: 'grid', gap: 8 }}>
          {STYLE_OPTIONS.map((style) => {
            const active = currentStyle === style.value;

            return (
              <button
                key={style.value}
                type="button"
                onClick={() => {
                  void applyStyle(style.value);
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: active ? '1px solid #93c5fd' : '1px solid #e5e7eb',
                  background: active ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  boxShadow: active ? '0 6px 18px rgba(59,130,246,0.12)' : 'none',
                }}
              >
                <div style={{ fontSize: 11, color: active ? '#1d4ed8' : '#6b7280', marginBottom: 6 }}>
                  {style.label}
                </div>
                <div
                  style={{
                    fontSize: style.fontSize,
                    fontWeight: style.fontWeight,
                    textAlign: style.align,
                    color: '#111827',
                    lineHeight: 1.5,
                  }}
                >
                  {style.sample}
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="字体与字号">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>字体</label>
            <Select
              size="small"
              style={{ width: '100%' }}
              value={(editor?.getAttributes('textStyle').fontFamily as string) || formatting.fontFamily || 'FangSong, serif'}
              disabled={!canRunFormattingCommands}
              onChange={(value) => {
                void executeDocumentCommand('set-font-family', { value });
              }}
              options={FONT_OPTIONS}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>字号</label>
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              min={6}
              max={72}
              value={Number.parseFloat(formatting.fontSize) || 16}
              disabled={!canRunFormattingCommands}
              onChange={(value) => {
                void executeDocumentCommand('set-font-size', { value: `${value || 16}pt` });
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>文字颜色</label>
            <Input
              size="small"
              type="color"
              value={formatting.color || '#000000'}
              disabled={!canRunFormattingCommands}
              onChange={(event) => {
                void executeDocumentCommand('set-text-color', { value: event.target.value });
              }}
              style={{ width: '100%', height: 28, padding: 2 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button
              size="small"
              disabled={!canRunFormattingCommands}
              type={formatting.isBold ? 'primary' : 'default'}
              onClick={() => void executeDocumentCommand('toggle-bold')}
            >
              加粗
            </Button>
            <Button
              size="small"
              disabled={!canRunFormattingCommands}
              type={formatting.isItalic ? 'primary' : 'default'}
              onClick={() => void executeDocumentCommand('toggle-italic')}
            >
              斜体
            </Button>
            <Button
              size="small"
              disabled={!canRunFormattingCommands}
              type={formatting.isUnderline ? 'primary' : 'default'}
              onClick={() => void executeDocumentCommand('toggle-underline')}
            >
              下划线
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="段落">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>对齐方式</label>
            <Space size={6} wrap>
              <Button
                size="small"
                disabled={!canRunFormattingCommands}
                type={formatting.textAlign === 'left' ? 'primary' : 'default'}
                onClick={() => void executeDocumentCommand('set-align', { value: 'left' })}
              >
                左对齐
              </Button>
              <Button
                size="small"
                disabled={!canRunFormattingCommands}
                type={formatting.textAlign === 'center' ? 'primary' : 'default'}
                onClick={() => void executeDocumentCommand('set-align', { value: 'center' })}
              >
                居中
              </Button>
              <Button
                size="small"
                disabled={!canRunFormattingCommands}
                type={formatting.textAlign === 'right' ? 'primary' : 'default'}
                onClick={() => void executeDocumentCommand('set-align', { value: 'right' })}
              >
                右对齐
              </Button>
              <Button
                size="small"
                disabled={!canRunFormattingCommands}
                type={formatting.textAlign === 'justify' ? 'primary' : 'default'}
                onClick={() => void executeDocumentCommand('set-align', { value: 'justify' })}
              >
                两端对齐
              </Button>
            </Space>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>行距</label>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={formatting.lineHeight}
                options={LINE_HEIGHT_OPTIONS}
                disabled={!canRunFormattingCommands}
                onChange={(value) => {
                  void setParagraphAttrs({ lineHeight: value });
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>首行缩进</label>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={formatting.textIndent === '0pt' ? '0em' : formatting.textIndent}
                options={INDENT_OPTIONS}
                disabled={!canRunFormattingCommands}
                onChange={(value) => {
                  void setParagraphAttrs({ textIndent: value === '0em' ? null : value });
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>段前</label>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={formatting.spaceBefore}
                options={SPACE_OPTIONS}
                disabled={!canRunFormattingCommands}
                onChange={(value) => {
                  void setParagraphAttrs({ spaceBefore: value });
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>段后</label>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={formatting.spaceAfter}
                options={SPACE_OPTIONS}
                disabled={!canRunFormattingCommands}
                onChange={(value) => {
                  void setParagraphAttrs({ spaceAfter: value });
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>左缩进</label>
              <Input
                size="small"
                value={formatting.marginLeft}
                disabled={!canRunFormattingCommands}
                onChange={(event) => {
                  void setParagraphAttrs({ marginLeft: event.target.value || null });
                }}
                placeholder="0pt"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>右缩进</label>
              <Input
                size="small"
                value={formatting.marginRight}
                disabled={!canRunFormattingCommands}
                onChange={(event) => {
                  void setParagraphAttrs({ marginRight: event.target.value || null });
                }}
                placeholder="0pt"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <Divider style={{ margin: '12px 0' }} />

      <SectionCard title="快速操作">
        <Space size={6} wrap>
          <Button size="small" disabled={!canRunFormattingCommands} onClick={() => void applyStyle('Normal')}>
            恢复正文
          </Button>
          <Button
            size="small"
            disabled={!canRunFormattingCommands}
            onClick={() => {
              void setParagraphAttrs({
                lineHeight: null,
                textIndent: '2em',
                marginLeft: null,
                marginRight: null,
                spaceBefore: null,
                spaceAfter: '8px',
              });
              void executeDocumentCommand('set-align', { value: 'left' });
            }}
          >
            恢复正文段落
          </Button>
          <Button size="small" disabled={!canRunFormattingCommands} danger onClick={() => void clearFormatting()}>
            清除格式
          </Button>
        </Space>
      </SectionCard>
    </div>
  );
}

export function WritingStrategyPanel() {
  const activeSectionId = useEditorStore((state) => state.activeSectionId);
  const activeSectionTitle = useEditorStore((state) => state.activeSectionTitle);
  const doc = useProjectStore((state) => state.doc);

  const strategy = doc.documentState.paperSpineMemories.find((item) => item.sectionId === activeSectionId);

  if (!strategy) {
    return (
      <div style={{ padding: 16 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            activeSectionTitle
              ? `“${activeSectionTitle}”还没有生成写作策略。`
              : '把光标放到某个章节里，这里会显示当前章节的写作策略、论证结构和材料支撑。'
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <SectionCard title="章节记忆">
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#ffffff',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1f1f1f' }}>{strategy.sectionTitle}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
            最近生成：{new Date(strategy.generatedAt).toLocaleString('zh-CN')}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="写作目标">
        <InsightList
          items={[strategy.enhancement.blueprint.rhetoricalGoal].filter(Boolean)}
          emptyText="暂无写作目标"
        />
      </SectionCard>

      <SectionCard title="必须覆盖的论点">
        <InsightList items={strategy.enhancement.blueprint.requiredClaims} emptyText="暂无论点要求" />
      </SectionCard>

      <SectionCard title="材料支撑计划">
        <InsightList items={strategy.enhancement.blueprint.evidencePlan} emptyText="暂无材料计划" />
      </SectionCard>

      <SectionCard title="上下文衔接">
        <InsightList items={strategy.enhancement.blueprint.continuityNotes} emptyText="暂无衔接说明" />
      </SectionCard>

      <SectionCard title="风险提醒">
        <InsightList items={strategy.enhancement.blueprint.cautionNotes} emptyText="暂无风险提醒" />
      </SectionCard>

      <SectionCard title="论证结构">
        {strategy.enhancement.rationaleMatrix.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>暂无论证结构</div>
        ) : (
          strategy.enhancement.rationaleMatrix.map((entry, index) => (
            <RationaleCard key={`${entry.claim}-${index}`} entry={entry} />
          ))
        )}
      </SectionCard>

      <SectionCard title="材料支撑">
        {strategy.enhancement.citationSupportBank.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>暂无材料支撑</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {strategy.enhancement.citationSupportBank.map((item, index) => (
              <div
                key={`${item.chunkId}-${index}`}
                style={{
                  padding: 10,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <Tag color={item.relevance === 'primary' ? 'blue' : 'default'}>
                    {item.relevance === 'primary' ? '核心' : '补充'}
                  </Tag>
                  <Tag>{item.chunkId}</Tag>
                </div>
                <div style={{ fontSize: 12, color: '#262626', lineHeight: 1.6 }}>{item.excerpt}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
