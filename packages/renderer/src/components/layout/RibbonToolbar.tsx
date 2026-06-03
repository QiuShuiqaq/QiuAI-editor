import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BgColorsOutlined,
  BoldOutlined,
  ClearOutlined,
  ExportOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  FontColorsOutlined,
  FormatPainterOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  PictureOutlined,
  RedoOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  SnippetsOutlined,
  TableOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Button, ColorPicker, Select, Tooltip, Upload, message } from 'antd';
import type { Color } from 'antd/es/color-picker';
import {
  IPC_CHANNELS,
  WritingPhase,
  syncDocumentWithState,
  type IPCResponse,
  type ReviewIssue,
} from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import {
  executeDocumentCommand,
  insertDocumentAuxiliaryBlock,
  insertDocumentDateTime,
  insertDocumentEquationBlock,
  insertDocumentImagePlaceholder,
  insertDocumentPageBreak,
  insertDocumentPageNumberField,
  insertDocumentTable,
  insertDocumentTablePlaceholder,
  replaceDocumentContent,
  saveCurrentDocument,
} from '../../services/documentEngineCommands';
import { formatPainter } from '../../services/formatPainter';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import {
  DEFAULT_SELECTION_FORMATTING,
  useEditorStore,
  type SelectionFormattingState,
} from '../../stores/useEditorStore';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { usePageViewStore } from '../../stores/usePageViewStore';
import { usePhaseStore } from '../../stores/usePhaseStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { DISPLAY_ACTIVE_OBJECT_LABELS, normalizeStyleLabel } from '../../utils/displayText';
import { supportsDocumentCommands } from '../../utils/documentEngineCapabilities';
import { AISettingsDialog } from '../dialogs/AISettingsDialog';
import { ColumnsDialog } from '../dialogs/ColumnsDialog';
import { CrossReferenceDialog } from '../dialogs/CrossReferenceDialog';
import { DocumentPropertiesDialog } from '../dialogs/DocumentPropertiesDialog';
import { DraftManagerDialog } from '../dialogs/DraftManagerDialog';
import { ExportDialog } from '../dialogs/ExportDialog';
import { HelpDialog } from '../dialogs/HelpDialog';
import { PageBorderDialog } from '../dialogs/PageBorderDialog';
import { PageSetupDialog } from '../dialogs/PageSetupDialog';
import { PrintPreview } from '../dialogs/PrintPreview';
import { SymbolPanel } from '../dialogs/SymbolPanel';
import { TemplateDialog } from '../dialogs/TemplateDialog';
import { TocDialog } from '../dialogs/TocDialog';
import { WatermarkDialog } from '../dialogs/WatermarkDialog';

type RibbonTab = 'home' | 'insert' | 'layout' | 'references' | 'view' | 'ai' | 'help';
type HomeStyle = 'Normal' | 'Heading1' | 'Heading2' | 'Heading3' | 'Caption' | 'TableCaption' | 'Quote';
type TaskPaneTarget = 'properties' | 'strategy' | 'assistant' | 'review' | 'references';

const FONT_FAMILIES = [
  { value: 'FangSong, serif', label: '仿宋' },
  { value: 'SimSun, serif', label: '宋体' },
  { value: 'SimHei, sans-serif', label: '黑体' },
  { value: 'KaiTi, serif', label: '楷体' },
  { value: 'Microsoft YaHei, sans-serif', label: '微软雅黑' },
];

const FONT_SIZES = [
  { value: '42pt', label: '初号' },
  { value: '36pt', label: '小初' },
  { value: '26pt', label: '一号' },
  { value: '24pt', label: '小一' },
  { value: '22pt', label: '二号' },
  { value: '18pt', label: '小二' },
  { value: '16pt', label: '三号' },
  { value: '15pt', label: '小三' },
  { value: '14pt', label: '四号' },
  { value: '12pt', label: '小四' },
  { value: '10.5pt', label: '五号' },
  { value: '9pt', label: '小五' },
];

const STYLE_OPTIONS: Array<{ value: HomeStyle; label: string }> = [
  { value: 'Normal', label: '正文' },
  { value: 'Heading1', label: '标题 1' },
  { value: 'Heading2', label: '标题 2' },
  { value: 'Heading3', label: '标题 3' },
  { value: 'Caption', label: '图注' },
  { value: 'TableCaption', label: '表注' },
  { value: 'Quote', label: '引用' },
];

const TAB_DEFINITIONS: Array<{ key: RibbonTab; label: string }> = [
  { key: 'home', label: '开始' },
  { key: 'insert', label: '插入' },
  { key: 'layout', label: '页面布局' },
  { key: 'references', label: '引用' },
  { key: 'view', label: '视图' },
  { key: 'ai', label: 'AI 工具' },
  { key: 'help', label: '帮助' },
];

const ribbonRootStyle: CSSProperties = {
  background: '#f4f6f8',
  borderBottom: '1px solid #d7deea',
  flexShrink: 0,
};

const groupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 10,
  padding: '10px 12px 8px',
  borderRight: '1px solid #e5e7eb',
  minHeight: 104,
};

const iconButtonStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function RibbonGroup({
  title,
  children,
  minWidth,
}: {
  title: string;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div style={{ ...groupStyle, minWidth }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>{title}</div>
      </div>
    </div>
  );
}

function RibbonIconButton({
  icon,
  title,
  active,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip title={title}>
      <Button
        type={active ? 'primary' : 'default'}
        size="small"
        icon={icon}
        onClick={onClick}
        style={iconButtonStyle}
      />
    </Tooltip>
  );
}

function normalizeHomeStyle(styleLabel: string): HomeStyle {
  const normalized = normalizeStyleLabel(styleLabel);
  if (normalized === '标题 1') return 'Heading1';
  if (normalized === '标题 2') return 'Heading2';
  if (normalized === '标题 3') return 'Heading3';
  if (normalized === '图注') return 'Caption';
  if (normalized === '表注') return 'TableCaption';
  if (normalized === '引用') return 'Quote';
  return 'Normal';
}

function normalizeFontFamilySelectValue(fontFamily: string): string {
  const currentPrimary = fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  const matched = FONT_FAMILIES.find((option) => {
    const optionPrimary = option.value.split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase();
    return optionPrimary === currentPrimary;
  });

  return matched?.value || fontFamily;
}

function focusEditorCommand(callback: () => boolean): boolean {
  try {
    return callback();
  } catch {
    return false;
  }
}

export function RibbonToolbar() {
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [draftOpen, setDraftOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [watermarkOpen, setWatermarkOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [pageBorderOpen, setPageBorderOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [crossReferenceOpen, setCrossReferenceOpen] = useState(false);
  const [painterActive, setPainterActive] = useState(false);
  const [painterContinuous, setPainterContinuous] = useState(false);

  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const formatting = useEditorStore((state) => state.formatting);
  const editor = useEditorStore((state) => state.editor);
  const setDirty = useEditorStore((state) => state.setDirty);
  const selectedText = useEditorStore((state) => state.selectedText);
  const activeSectionId = useEditorStore((state) => state.activeSectionId);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const pageEditMode = usePageViewStore((state) => state.editMode);
  const setPageEditMode = usePageViewStore((state) => state.setEditMode);
  const setActiveVariant = usePageViewStore((state) => state.setActiveVariant);
  const setPhase = usePhaseStore((state) => state.setPhase);

  useEffect(() => {
    formatPainter.onChangeCallback(() => {
      setPainterActive(formatPainter.isActive);
      setPainterContinuous(formatPainter.isContinuous);
    });

    return () => {
      formatPainter.onChangeCallback(() => undefined);
    };
  }, []);

  useEffect(() => {
    setPainterActive(formatPainter.isActive);
    setPainterContinuous(formatPainter.isContinuous);
  }, [editor]);

  const effectiveFormatting: SelectionFormattingState = formatting || DEFAULT_SELECTION_FORMATTING;
  const currentStyle = useMemo(
    () => normalizeHomeStyle(effectiveFormatting.styleLabel),
    [effectiveFormatting.styleLabel]
  );

  const runCommand = async (command: string, payload: Record<string, unknown> = {}) => {
    const success = await executeDocumentCommand(command, payload);
    if (success) {
      setDirty(true);
    }
    return success;
  };

  const runLocalEditor = (callback: () => boolean) => {
    const success = focusEditorCommand(callback);
    if (success) {
      setDirty(true);
    }
    return success;
  };

  const saveDocument = async () => {
    try {
      await saveCurrentDocument();
      message.success('已保存文档。');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败。');
    }
  };

  const createBlankDocument = async () => {
    useProjectStore.getState().reset();
    useFrameworkStore.getState().reset();

    const resetDoc = useProjectStore.getState().doc;
    setDoc({
      ...resetDoc,
      title: '未命名文档',
      updatedAt: new Date().toISOString(),
    });

    setPhase(WritingPhase.FRAMEWORK);
    setPageEditMode('none');
    setActiveVariant('default');
    await replaceDocumentContent('');
    setDirty(false);
    setActiveTab('home');

    try {
      const freshDoc = syncDocumentWithState(useProjectStore.getState().doc);
      await ipcClient.invoke<IPCResponse>(IPC_CHANNELS.FILE_SAVE_DRAFT, freshDoc);
      message.success('已新建文档，并加入草稿列表。');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新建文档后保存草稿失败。');
    }
  };

  const undo = async () => {
    if (supportsDocumentCommands(documentEngineAdapter) && (await runCommand('undo'))) {
      return;
    }

    if (!runLocalEditor(() => editor?.chain().focus().undo().run() ?? false)) {
      message.info('当前区域暂时无法撤销。');
    }
  };

  const redo = async () => {
    if (supportsDocumentCommands(documentEngineAdapter) && (await runCommand('redo'))) {
      return;
    }

    if (!runLocalEditor(() => editor?.chain().focus().redo().run() ?? false)) {
      message.info('当前区域暂时无法重做。');
    }
  };

  const copySelection = async () => {
    const text = selectedText.trim();
    if (!text) {
      message.info('请先选中文本。');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制到剪贴板。');
    } catch {
      message.warning('复制失败，请检查剪贴板权限。');
    }
  };

  const cutSelection = async () => {
    const text = selectedText.trim();
    if (!text) {
      message.info('请先选中文本。');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      message.warning('复制失败，请检查剪贴板权限。');
      return;
    }

    if (!runLocalEditor(() => editor?.chain().focus().deleteSelection().run() ?? false)) {
      message.warning('当前区域暂时无法剪切。');
      return;
    }

    message.success('已剪切文本。');
  };

  const pasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        message.info('剪贴板为空。');
        return;
      }
      if (!(await runCommand('insert-text', { text }))) {
        message.warning('当前区域暂时无法粘贴文本。');
      }
    } catch {
      message.warning('读取剪贴板失败，请检查权限。');
    }
  };

  const applyStyle = async (value: HomeStyle) => {
    if (!(await runCommand('apply-style', { value }))) {
      message.warning('当前区域暂时无法切换样式。');
    }
  };

  const toggleFormatPainter = () => {
    if (painterActive) {
      formatPainter.clear();
      return;
    }
    formatPainter.copyFormat();
    formatPainter.activate(false);
  };

  const applyTextColor = async (value: string) => {
    if (!(await runCommand('set-text-color', { value }))) {
      runLocalEditor(() => editor?.chain().focus().setMark('textStyle', { color: value }).run() ?? false);
    }
  };

  const applyHighlight = async (value: string) => {
    if (!runLocalEditor(() => editor?.chain().focus().toggleHighlight({ color: value }).run() ?? false)) {
      message.info('当前区域暂时无法设置高亮。');
    }
  };

  const insertPageBreak = async () => {
    const success = await insertDocumentPageBreak();
    if (!success) {
      message.warning('当前文档无法插入分页符。');
      return;
    }
    setDirty(true);
    message.success('已插入分页符。');
  };

  const insertPageNumberField = async () => {
    const success = await insertDocumentPageNumberField();
    if (!success) {
      message.warning('当前文档无法插入页码字段。');
      return;
    }
    setDirty(true);
    message.success('已插入页码。');
  };

  const insertSimpleTable = async () => {
    const success = await insertDocumentTable();
    if (!success) {
      message.warning('当前文档无法插入表格。');
      return;
    }
    setDirty(true);
    message.success('已插入表格。');
  };

  const insertImagePlaceholderOnly = async () => {
    const success = await insertDocumentImagePlaceholder({
      caption: '图片待补充',
    });
    if (!success) {
      message.warning('当前文档无法插入图片预留位。');
      return;
    }
    setDirty(true);
    message.success('已插入图片预留位。');
  };

  const insertTablePlaceholderOnly = async () => {
    const success = await insertDocumentTablePlaceholder({
      caption: '表格待补充',
    });
    if (!success) {
      message.warning('当前文档无法插入表格预留位。');
      return;
    }
    setDirty(true);
    message.success('已插入表格预留位。');
  };

  const insertBulletList = async () => {
    if (!(await runCommand('toggle-bullet-list'))) {
      message.warning('当前区域暂时无法使用项目符号。');
    }
  };

  const insertOrderedList = async () => {
    if (!(await runCommand('toggle-ordered-list'))) {
      message.warning('当前区域暂时无法使用编号列表。');
    }
  };

  const insertImageFromUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        message.error('图片读取失败。');
        return;
      }

      const success = await insertDocumentImagePlaceholder({
        caption: file.name.replace(/\.[^.]+$/, ''),
        imageData: result,
      });
      if (!success) {
        message.warning('当前文档无法插入图片。');
        return;
      }

      setDirty(true);
      message.success('已插入图片。');
    };
    reader.onerror = () => message.error('图片读取失败。');
    reader.readAsDataURL(file);
    return false;
  };

  const insertHyperlink = async () => {
    const text = selectedText.trim() || '超链接';
    const href = window.prompt('请输入链接地址', 'https://');
    if (!href) return;

    const success = await runCommand('set-link', { href, value: href, text });
    if (!success) {
      message.warning('当前区域暂时无法插入链接。');
      return;
    }

    message.success('已插入链接。');
  };

  const insertCurrentDateTime = async () => {
    const text = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const success = await insertDocumentDateTime(text);
    if (!success) {
      message.warning('当前文档无法插入日期时间。');
      return;
    }

    setDirty(true);
    message.success('已插入日期时间。');
  };

  const insertReviewComment = () => {
    const content = selectedText.trim();
    if (!content) {
      message.warning('请先选中需要添加批注的文本。');
      return;
    }

    const issue: ReviewIssue = {
      id: crypto.randomUUID(),
      message: `批注：${content.slice(0, 120)}${content.length > 120 ? '...' : ''}`,
      severity: 'info',
      sectionId: activeSectionId || undefined,
    };

    setDoc(
      syncDocumentWithState({
        ...doc,
        updatedAt: new Date().toISOString(),
        documentState: {
          ...doc.documentState,
          reviewIssues: [issue, ...doc.documentState.reviewIssues],
        },
      })
    );

    openTaskPane('review');
    message.success('已加入批注，可在审阅面板继续编辑。');
  };

  const insertEquationPlaceholder = async () => {
    const success = await insertDocumentEquationBlock('公式：');
    if (!success) {
      message.warning('当前文档无法插入公式占位。');
      return;
    }
    setDirty(true);
    message.success('已插入公式占位。');
  };

  const insertAuxiliaryBlock = async (kind: 'textBox' | 'shape' | 'chart') => {
    const title = kind === 'shape' ? '形状' : kind === 'chart' ? '图表' : '文本框';
    const body =
      kind === 'shape'
        ? '用于放置流程箭头、标识或说明形状。'
        : kind === 'chart'
          ? '用于放置柱状图、折线图或统计图表。'
          : '用于放置补充说明、重点提示或侧边内容。';

    const success = await insertDocumentAuxiliaryBlock({ kind, title, body });
    if (!success) {
      message.warning(`当前文档无法插入${title}。`);
      return;
    }
    setDirty(true);
    message.success(`已插入${title}。`);
  };

  const openTaskPane = (tab: TaskPaneTarget) => {
    (window as { __openTaskPane?: (tab?: TaskPaneTarget) => void }).__openTaskPane?.(tab);
  };

  const renderHomePanel = () => (
    <div style={{ display: 'flex', minHeight: 112, background: '#fbfbfc' }}>
      <RibbonGroup title="剪贴板" minWidth={210}>
        <Button size="small" onClick={() => void cutSelection()}>
          剪切
        </Button>
        <Button size="small" onClick={() => void copySelection()}>
          复制
        </Button>
        <Button size="small" onClick={() => void pasteClipboard()}>
          粘贴
        </Button>
        <RibbonIconButton
          icon={<FormatPainterOutlined />}
          title={painterContinuous ? '格式刷（连续）' : painterActive ? '取消格式刷' : '格式刷'}
          active={painterActive}
          onClick={toggleFormatPainter}
        />
        <Button size="small" icon={<ClearOutlined />} onClick={() => void runCommand('clear-formatting')}>
          清除格式
        </Button>
      </RibbonGroup>

      <RibbonGroup title="字体" minWidth={360}>
        <Select
          size="small"
          value={normalizeFontFamilySelectValue(effectiveFormatting.fontFamily)}
          style={{ width: 140 }}
          options={FONT_FAMILIES}
          onChange={(value) => void runCommand('set-font-family', { value })}
        />
        <Select
          size="small"
          value={effectiveFormatting.fontSize}
          style={{ width: 92 }}
          options={FONT_SIZES}
          onChange={(value) => void runCommand('set-font-size', { value })}
        />
        <RibbonIconButton
          icon={<BoldOutlined />}
          title="加粗"
          active={effectiveFormatting.isBold}
          onClick={() => void runCommand('toggle-bold')}
        />
        <RibbonIconButton
          icon={<ItalicOutlined />}
          title="斜体"
          active={effectiveFormatting.isItalic}
          onClick={() => void runCommand('toggle-italic')}
        />
        <RibbonIconButton
          icon={<UnderlineOutlined />}
          title="下划线"
          active={effectiveFormatting.isUnderline}
          onClick={() => void runCommand('toggle-underline')}
        />
        <ColorPicker value={effectiveFormatting.color} onChange={(value: Color) => void applyTextColor(value.toHexString())}>
          <Button size="small" icon={<FontColorsOutlined />}>
            字体颜色
          </Button>
        </ColorPicker>
        <ColorPicker
          value={effectiveFormatting.highlightColor ?? '#fff59d'}
          onChange={(value: Color) => void applyHighlight(value.toHexString())}
        >
          <Button size="small" icon={<BgColorsOutlined />}>
            高亮
          </Button>
        </ColorPicker>
      </RibbonGroup>

      <RibbonGroup title="段落" minWidth={320}>
        <RibbonIconButton
          icon={<AlignLeftOutlined />}
          title="左对齐"
          active={effectiveFormatting.textAlign === 'left'}
          onClick={() => void runCommand('set-align', { value: 'left' })}
        />
        <RibbonIconButton
          icon={<AlignCenterOutlined />}
          title="居中"
          active={effectiveFormatting.textAlign === 'center'}
          onClick={() => void runCommand('set-align', { value: 'center' })}
        />
        <RibbonIconButton
          icon={<AlignRightOutlined />}
          title="右对齐"
          active={effectiveFormatting.textAlign === 'right'}
          onClick={() => void runCommand('set-align', { value: 'right' })}
        />
        <Button
          size="small"
          type={effectiveFormatting.textAlign === 'justify' ? 'primary' : 'default'}
          onClick={() => void runCommand('set-align', { value: 'justify' })}
        >
          两端对齐
        </Button>
        <RibbonIconButton
          icon={<UnorderedListOutlined />}
          title="项目符号"
          active={effectiveFormatting.isBulletList}
          onClick={() => void insertBulletList()}
        />
        <RibbonIconButton
          icon={<OrderedListOutlined />}
          title="编号"
          active={effectiveFormatting.isOrderedList}
          onClick={() => void insertOrderedList()}
        />
      </RibbonGroup>

      <RibbonGroup title="样式" minWidth={220}>
        <Select
          size="small"
          value={currentStyle}
          style={{ width: 150 }}
          options={STYLE_OPTIONS}
          onChange={(value) => void applyStyle(value)}
        />
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, maxWidth: 180 }}>
          光标移动时会同步显示当前样式和对齐状态，保持接近 Word 的状态可见性。
        </div>
      </RibbonGroup>

      <RibbonGroup title="编辑" minWidth={180}>
        <Button size="small" icon={<SearchOutlined />} onClick={() => (window as { __editorShowFind?: () => void }).__editorShowFind?.()}>
          查找
        </Button>
        <Button size="small" onClick={() => (window as { __editorShowReplace?: () => void }).__editorShowReplace?.()}>
          替换
        </Button>
      </RibbonGroup>
    </div>
  );

  const renderInsertPanel = () => (
    <div style={{ display: 'flex', minHeight: 112, background: '#fbfbfc' }}>
      <RibbonGroup title="文本框与图形" minWidth={260}>
        <Button size="small" onClick={() => void insertAuxiliaryBlock('textBox')}>
          文本框
        </Button>
        <Button size="small" onClick={() => void insertAuxiliaryBlock('shape')}>
          形状
        </Button>
        <Button size="small" onClick={() => void insertAuxiliaryBlock('chart')}>
          图表
        </Button>
      </RibbonGroup>

      <RibbonGroup title="插图" minWidth={220}>
        <Upload beforeUpload={(file) => insertImageFromUpload(file as File)} showUploadList={false} accept="image/*">
          <Button size="small" icon={<PictureOutlined />}>
            图片
          </Button>
        </Upload>
        <Button size="small" onClick={() => void insertImagePlaceholderOnly()}>
          图片预留位
        </Button>
        <Button size="small" icon={<SnippetsOutlined />} onClick={() => setTemplateOpen(true)}>
          模板
        </Button>
      </RibbonGroup>

      <RibbonGroup title="表格与对象" minWidth={240}>
        <Button size="small" icon={<TableOutlined />} onClick={() => void insertSimpleTable()}>
          表格
        </Button>
        <Button size="small" onClick={() => void insertTablePlaceholderOnly()}>
          表格预留位
        </Button>
        <Button size="small" onClick={() => setSymbolOpen(true)}>
          符号
        </Button>
        <Button size="small" onClick={() => void insertEquationPlaceholder()}>
          公式
        </Button>
      </RibbonGroup>

      <RibbonGroup title="文档部件" minWidth={280}>
        <Button size="small" onClick={() => setTocOpen(true)}>
          目录
        </Button>
        <Button size="small" onClick={() => void insertPageNumberField()}>
          页码
        </Button>
        <Button size="small" onClick={() => void insertPageBreak()}>
          分页符
        </Button>
        <Button size="small" onClick={() => void insertCurrentDateTime()}>
          日期时间
        </Button>
        <Button size="small" onClick={() => setCrossReferenceOpen(true)}>
          交叉引用
        </Button>
      </RibbonGroup>

      <RibbonGroup title="链接与批注" minWidth={220}>
        <Button size="small" onClick={() => void insertHyperlink()}>
          超链接
        </Button>
        <Button size="small" onClick={() => insertReviewComment()}>
          批注与审阅
        </Button>
      </RibbonGroup>
    </div>
  );

  const renderLayoutPanel = () => (
    <div style={{ display: 'flex', minHeight: 112, background: '#fbfbfc' }}>
      <RibbonGroup title="页面设置" minWidth={220}>
        <Button size="small" onClick={() => setPageSetupOpen(true)}>
          页边距与纸张
        </Button>
        <Button size="small" onClick={() => setColumnsOpen(true)}>
          分栏
        </Button>
        <Button size="small" onClick={() => setPropsOpen(true)}>
          文档属性
        </Button>
      </RibbonGroup>

      <RibbonGroup title="页面背景" minWidth={220}>
        <Button size="small" onClick={() => setWatermarkOpen(true)}>
          水印
        </Button>
        <Button size="small" onClick={() => setPageBorderOpen(true)}>
          页面边框
        </Button>
      </RibbonGroup>

      <RibbonGroup title="页眉页脚" minWidth={280}>
        <Button size="small" type={pageEditMode === 'header' ? 'primary' : 'default'} onClick={() => setPageEditMode('header')}>
          编辑页眉
        </Button>
        <Button size="small" type={pageEditMode === 'footer' ? 'primary' : 'default'} onClick={() => setPageEditMode('footer')}>
          编辑页脚
        </Button>
        <Button size="small" onClick={() => setPageEditMode('none')}>
          关闭页眉页脚
        </Button>
      </RibbonGroup>
    </div>
  );

  const renderReferencesPanel = () => (
    <div style={{ display: 'flex', minHeight: 112, background: '#fbfbfc' }}>
      <RibbonGroup title="目录与引用" minWidth={220}>
        <Button size="small" onClick={() => setTocOpen(true)}>
          自动目录
        </Button>
        <Button size="small" onClick={() => setCrossReferenceOpen(true)}>
          交叉引用
        </Button>
      </RibbonGroup>

      <RibbonGroup title="参考资料" minWidth={240}>
        <Button size="small" onClick={() => openTaskPane('references')}>
          参考资料面板
        </Button>
        <Button size="small" onClick={() => openTaskPane('review')}>
          审阅问题
        </Button>
      </RibbonGroup>

      <RibbonGroup title="写作规范" minWidth={300}>
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7, maxWidth: 260 }}>
          当前可直接使用目录、交叉引用和参考资料面板来整理正式文档中的引用关系与材料来源。
        </div>
      </RibbonGroup>
    </div>
  );

  const renderViewPanel = () => (
    <div style={{ display: 'flex', minHeight: 112, background: '#fbfbfc' }}>
      <RibbonGroup title="文档视图" minWidth={220}>
        <Button size="small" onClick={() => (window as { __toggleReadingMode?: () => void }).__toggleReadingMode?.()}>
          阅读模式
        </Button>
        <Button size="small" onClick={() => setPrintOpen(true)}>
          打印预览
        </Button>
      </RibbonGroup>

      <RibbonGroup title="窗格" minWidth={300}>
        <Button size="small" onClick={() => (window as { __toggleOutline?: () => void }).__toggleOutline?.()}>
          导航窗格
        </Button>
        <Button size="small" onClick={() => openTaskPane('properties')}>
          属性
        </Button>
        <Button size="small" onClick={() => openTaskPane('strategy')}>
          写作策略
        </Button>
        <Button size="small" onClick={() => openTaskPane('assistant')}>
          AI 助手
        </Button>
      </RibbonGroup>

      <RibbonGroup title="当前状态" minWidth={280}>
        <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.7, maxWidth: 240 }}>
          当前对象：{DISPLAY_ACTIVE_OBJECT_LABELS[effectiveFormatting.activeObject]}
          <br />
          页眉页脚：
          {pageEditMode === 'none' ? '未编辑' : pageEditMode === 'header' ? '正在编辑页眉' : '正在编辑页脚'}
        </div>
      </RibbonGroup>
    </div>
  );

  const renderAiPanel = () => (
    <div style={{ display: 'flex', minHeight: 112, background: '#fbfbfc' }}>
      <RibbonGroup title="AI 助手" minWidth={220}>
        <Button size="small" onClick={() => openTaskPane('assistant')}>
          打开助手
        </Button>
        <Button size="small" onClick={() => setAiSettingsOpen(true)}>
          模型配置
        </Button>
      </RibbonGroup>

      <RibbonGroup title="写作策略" minWidth={220}>
        <Button size="small" onClick={() => openTaskPane('strategy')}>
          打开写作策略
        </Button>
        <Button size="small" onClick={() => openTaskPane('review')}>
          风险提醒
        </Button>
      </RibbonGroup>

      <RibbonGroup title="AI 原则" minWidth={340}>
        <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.7, maxWidth: 300 }}>
          AI 是增强层，不会默认覆盖正文。写作任务默认使用 DeepSeek，其他任务模型可在模型配置中单独设置。
        </div>
      </RibbonGroup>
    </div>
  );

  const renderHelpPanel = () => (
    <div style={{ display: 'flex', minHeight: 112, background: '#fbfbfc' }}>
      <RibbonGroup title="项目帮助" minWidth={220}>
        <Button size="small" onClick={() => setHelpOpen(true)}>
          使用说明
        </Button>
      </RibbonGroup>

      <RibbonGroup title="快速理解" minWidth={380}>
        <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.7, maxWidth: 340 }}>
          QiuAI-editor 的默认感知应是像 Word 一样写正式文档，AI 入口集中在 AI 工具、任务窗格和选中文本后的增强操作中。
        </div>
      </RibbonGroup>
    </div>
  );

  const renderPanel = () => {
    switch (activeTab) {
      case 'home':
        return renderHomePanel();
      case 'insert':
        return renderInsertPanel();
      case 'layout':
        return renderLayoutPanel();
      case 'references':
        return renderReferencesPanel();
      case 'view':
        return renderViewPanel();
      case 'ai':
        return renderAiPanel();
      case 'help':
        return renderHelpPanel();
      default:
        return null;
    }
  };

  return (
    <>
      <div style={ribbonRootStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 38,
            padding: '0 10px',
            borderBottom: '1px solid #d7deea',
            background: '#f7f8fa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tooltip title="新建文档">
              <Button type="text" size="small" icon={<FileAddOutlined />} onClick={() => void createBlankDocument()} />
            </Tooltip>
            <Tooltip title="打开草稿">
              <Button type="text" size="small" icon={<FolderOpenOutlined />} onClick={() => setDraftOpen(true)} />
            </Tooltip>
            <Tooltip title="保存">
              <Button type="text" size="small" icon={<SaveOutlined />} onClick={() => void saveDocument()} />
            </Tooltip>
            <Tooltip title="撤销">
              <Button type="text" size="small" icon={<UndoOutlined />} onClick={() => void undo()} />
            </Tooltip>
            <Tooltip title="重做">
              <Button type="text" size="small" icon={<RedoOutlined />} onClick={() => void redo()} />
            </Tooltip>
          </div>

          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#111827' }}>
            QiuAI-editor
            <span style={{ marginLeft: 8, fontWeight: 400, color: '#6b7280' }}>{doc.title || '未命名文档'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: '#fff',
                border: '1px solid #d9d9d9',
                fontSize: 12,
                color: '#4b5563',
              }}
            >
              当前样式：{normalizeStyleLabel(effectiveFormatting.styleLabel)}
            </div>
            <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => setAiSettingsOpen(true)}>
              AI 设置
            </Button>
            <Button type="primary" size="small" icon={<ExportOutlined />} onClick={() => setExportOpen(true)}>
              导出
            </Button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            padding: '0 8px',
            height: 42,
            borderBottom: '1px solid #d7deea',
            background: '#eef2f6',
          }}
        >
          {TAB_DEFINITIONS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                border: '1px solid transparent',
                borderBottom: activeTab === tab.key ? '2px solid #1677ff' : '2px solid transparent',
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                background: activeTab === tab.key ? '#fbfbfc' : 'transparent',
                color: activeTab === tab.key ? '#0958d9' : '#4b5563',
                padding: '10px 18px 9px',
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div>{renderPanel()}</div>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <DraftManagerDialog open={draftOpen} onClose={() => setDraftOpen(false)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AISettingsDialog open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} />
      <TocDialog open={tocOpen} onClose={() => setTocOpen(false)} />
      <PageSetupDialog open={pageSetupOpen} onClose={() => setPageSetupOpen(false)} />
      <ColumnsDialog open={columnsOpen} onClose={() => setColumnsOpen(false)} />
      <SymbolPanel open={symbolOpen} onClose={() => setSymbolOpen(false)} />
      <WatermarkDialog open={watermarkOpen} onClose={() => setWatermarkOpen(false)} />
      <PrintPreview open={printOpen} onClose={() => setPrintOpen(false)} />
      <DocumentPropertiesDialog open={propsOpen} onClose={() => setPropsOpen(false)} />
      <PageBorderDialog open={pageBorderOpen} onClose={() => setPageBorderOpen(false)} />
      <TemplateDialog open={templateOpen} onClose={() => setTemplateOpen(false)} />
      <CrossReferenceDialog open={crossReferenceOpen} onClose={() => setCrossReferenceOpen(false)} />
    </>
  );
}
