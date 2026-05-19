/**
 * RibbonToolbar — Word 2019-style Quick Access Toolbar + Tabbed Ribbon.
 * Layout: [QAT: New,Open,Save,Undo,Redo] [Tabs: 开始,插入,AI工具,审阅,视图] [Ribbon Panel]
 */

import { useState, useRef, type ReactNode } from 'react';
import { Button, Tooltip, Select, ColorPicker, Dropdown, message } from 'antd';
import {
  BoldOutlined, ItalicOutlined, UnderlineOutlined, StrikethroughOutlined,
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  OrderedListOutlined, UnorderedListOutlined,
  PictureOutlined, TableOutlined, LineOutlined,
  RobotOutlined, ThunderboltOutlined, EyeOutlined, EyeInvisibleOutlined,
  SaveOutlined, ExportOutlined, UndoOutlined, RedoOutlined,
  FolderOpenOutlined, SettingOutlined, FontSizeOutlined,
  MinusOutlined, PlusOutlined, CopyOutlined, ScissorOutlined, SnippetsOutlined,
  FileTextOutlined, FormatPainterOutlined, ClearOutlined,
  FileAddOutlined, FileOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { IPC_CHANNELS, type IPCResponse, WritingPhase } from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import { formatPainter } from '../../services/formatPainter';
import { ExportDialog } from '../dialogs/ExportDialog';
import { DraftManagerDialog } from '../dialogs/DraftManagerDialog';
import { AISettingsDialog } from '../dialogs/AISettingsDialog';
import { TocDialog } from '../dialogs/TocDialog';
import { PageSetupDialog } from '../dialogs/PageSetupDialog';
import { SymbolPanel } from '../dialogs/SymbolPanel';
import { WatermarkDialog } from '../dialogs/WatermarkDialog';
import { ColumnsDialog } from '../dialogs/ColumnsDialog';
import { PrintPreview } from '../dialogs/PrintPreview';
import { DocumentPropertiesDialog } from '../dialogs/DocumentPropertiesDialog';
import { PageBorderDialog } from '../dialogs/PageBorderDialog';
import { TemplateDialog } from '../dialogs/TemplateDialog';

// ── Constants ──────────────────────────────────
const FONT_FAMILIES = [
  { v: 'FangSong, 仿宋, serif', l: '仿宋' },
  { v: 'SimSun, 宋体, serif', l: '宋体' },
  { v: 'SimHei, 黑体, sans-serif', l: '黑体' },
  { v: 'KaiTi, 楷体, serif', l: '楷体' },
  { v: 'Microsoft YaHei, 微软雅黑, sans-serif', l: '微软雅黑' },
];
const FONT_SIZES = [
  { v: '42', l: '初号' },{ v: '36', l: '小初' },{ v: '26', l: '一号' },{ v: '24', l: '小一' },
  { v: '22', l: '二号' },{ v: '18', l: '小二' },{ v: '16', l: '三号' },{ v: '15', l: '小三' },
  { v: '14', l: '四号' },{ v: '12', l: '小四' },{ v: '10.5', l: '五号' },{ v: '9', l: '小五' },
];
const LINE_SPACINGS = [
  { v: '1.0', l: '1.0' },{ v: '1.15', l: '1.15' },{ v: '1.5', l: '1.5' },
  { v: '2.0', l: '2.0' },{ v: '2.5', l: '2.5' },{ v: '3.0', l: '3.0' },{ v: '28pt', l: '固定28pt' },
];
const FONT_SIZE_SEQ = [9, 10.5, 12, 14, 15, 16, 18, 22, 24, 26, 36, 42];
const STYLES = [
  { v: 'Normal', l: '正文' },{ v: 'Heading1', l: '标题 1' },
  { v: 'Heading2', l: '标题 2' },{ v: 'Heading3', l: '标题 3' },
];

type RibbonTab = 'home' | 'insert' | 'ai' | 'review' | 'view';

// ── Sub-components ────────────────────────────
function RibbonGroup({ title, children, style }: { title?: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      borderRight: '1px solid #e0e0e0', padding: '2px 6px', minHeight: 72,
      gap: 2, ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {children}
      </div>
      {title && <span style={{ fontSize: 10, color: '#888', marginTop: 'auto', paddingBottom: 1 }}>{title}</span>}
    </div>
  );
}

function RIcon({ icon, title, onClick, active, children }: {
  icon?: ReactNode; title: string; onClick?: () => void; active?: boolean; children?: ReactNode;
}) {
  return (
    <Tooltip title={title} placement="bottom" mouseEnterDelay={0.5}>
      <button
        onClick={onClick}
        style={{
          display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minWidth: 36, height: 44, padding: '2px 4px', border: '1px solid transparent',
          borderRadius: 3, background: active ? '#d3e3fd' : 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: '#333',
          outline: 'none', lineHeight: 1.2,
        }}
        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = '#e8e8e8'; }}
        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {icon && <span style={{ fontSize: 16, marginBottom: children ? 1 : 0 }}>{icon}</span>}
        {children && <span style={{ fontSize: 10 }}>{children}</span>}
      </button>
    </Tooltip>
  );
}

// ── Main Component ────────────────────────────
export function RibbonToolbar() {
  const editor = useEditorStore((s) => s.editor);
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [exportOpen, setExportOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [watermarkOpen, setWatermarkOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [pageBorderOpen, setPageBorderOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [painterActive, setPainterActive] = useState(false);
  const painterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wire format painter callback
  useState(() => { formatPainter.onChangeCallback(() => { setPainterActive(formatPainter.isActive); }); });

  // ── Editor helpers ─────────────────────
  const e = editor;
  const bold = () => e?.chain().focus().toggleBold().run();
  const italic = () => e?.chain().focus().toggleItalic().run();
  const underline = () => e?.chain().focus().toggleUnderline().run();
  const strike = () => e?.chain().focus().toggleStrike().run();
  const superscript = () => e?.chain().focus().toggleSuperscript().run();
  const subscript = () => e?.chain().focus().toggleSubscript().run();
  const highlightColor = (c: string) => e?.chain().focus().toggleHighlight({ color: c }).run();
  const undo = () => e?.chain().focus().undo().run();
  const redo = () => e?.chain().focus().redo().run();
  const alignL = () => e?.chain().focus().setTextAlign('left').run();
  const alignC = () => e?.chain().focus().setTextAlign('center').run();
  const alignR = () => e?.chain().focus().setTextAlign('right').run();
  const alignJ = () => e?.chain().focus().setTextAlign('justify').run();
  const bullet = () => e?.chain().focus().toggleBulletList().run();
  const numbered = () => e?.chain().focus().toggleOrderedList().run();
  const setFont = (v: string) => e?.chain().focus().setMark('textStyle', { fontFamily: v }).run();
  const setSize = (v: string) => e?.chain().focus().setMark('textStyle', { fontSize: v + 'pt' }).run();
  const setColor = (c: string) => e?.chain().focus().setMark('textStyle', { color: c }).run();
  const setLineH = (v: string) => e?.chain().focus().setParagraphAttrs({ lineHeight: v }).run();
  const setSpaceBefore = (v: string) => e?.chain().focus().setParagraphAttrs({ spaceBefore: v }).run();
  const setSpaceAfter = (v: string) => e?.chain().focus().setParagraphAttrs({ spaceAfter: v }).run();
  const addLink = () => {
    const url = prompt('输入链接地址 (https://...)');
    if (url) e?.chain().focus().setLink({ href: url }).run();
  };
  const removeLink = () => { e?.chain().focus().unsetLink().run(); };
  const handleNewDoc = () => {
    useProjectStore.getState().reset();
    useFrameworkStore.getState().reset();
    e?.commands.setContent('');
    message.success('已创建新文档');
  };
  const handleCopy = async () => {
    const text = e?.state.doc.textBetween(e.state.selection.from, e.state.selection.to);
    if (text) { await navigator.clipboard.writeText(text); message.success('已复制'); }
  };
  const handlePaste = async () => {
    try { const t = await navigator.clipboard.readText(); e?.commands.insertContent(t); } catch { /* no clipboard access */ }
  };
  const handleAIImageGen = () => { import('../../stores/usePhaseStore').then(m => m.usePhaseStore.getState().setPhase(WritingPhase.IMAGES)); };
  const handleAIPolish = () => {
    const text = e?.state.doc.textBetween(e.state.selection.from, e.state.selection.to);
    if (!text) { message.warning('请先选中需要润色的文本'); return; }
    import('../../services/aiClient').then(ai => {
      const config = (window as any).__getAIConfig?.() || { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7, maxTokens: 4096 };
      ai.polishText({ originalText: text, style: 'formal', aiConfig: config }).then(result => {
        e?.commands.insertContent(result);
        message.success('润色完成');
      });
    });
  };
  const handleDataReview = () => { message.info('数据审查：请在状态栏点击「数据审查」按钮查看标记数据'); };
  const handlePreview = () => { setPrintOpen(true); };
  const handleCSVImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv';
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const data = reader.result as string;
          const lines = data.trim().split('\n');
          let html = '<table class="three-line-placeholder-table"><tbody>';
          lines.forEach((line, i) => {
            html += '<tr>';
            line.split(',').forEach(cell => { html += i === 0 ? `<th>${cell.trim()}</th>` : `<td>${cell.trim()}</td>`; });
            html += '</tr>';
          });
          html += '</tbody></table>';
          e?.commands.insertContent(html);
          message.success('CSV 表格已导入');
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };
  const handleInsertTable = () => { e?.commands.insertTable({ rows: 3, cols: 4, withHeaderRow: true }); };
  const toggleDropCap = () => { e?.chain().focus().updateAttributes('paragraph', { class: e.isActive('paragraph') && (e.getAttributes('paragraph') as any).class === 'drop-cap' ? null : 'drop-cap' }).run(); };
  const toggleSpellcheck = () => { const v = e?.view.dom.getAttribute('spellcheck') === 'true'; e?.view.dom.setAttribute('spellcheck', String(!v)); message.success(v?'拼写检查已关闭':'拼写检查已开启'); };
  const insertEquation = () => { e?.commands.insertContent('<span class="math-inline">x = {-b \\pm \\sqrt{b^2-4ac} \\over 2a}</span>'); message.success('公式已插入，双击编辑'); };
  const insertImageCaption = () => { const n = (window as any).__imageCounter = ((window as any).__imageCounter || 0) + 1; e?.commands.insertContent(`<p class="image-text" style="text-align:center;font-size:10.5pt">图1.${n} 图片标题（双击编辑）</p>`); };
  const insertTableCaption = () => { const n = (window as any).__tableCounter = ((window as any).__tableCounter || 0) + 1; e?.commands.insertContent(`<p class="table-text" style="text-align:center;font-size:10.5pt">表1.${n} 表格标题（双击编辑）</p>`); };
  const setPageColor = (c: string) => { document.documentElement.style.setProperty('--page-bg-color', c); message.success('页面颜色已设置'); };
  const showShortcuts = () => {
    const shortcuts = [
      'Ctrl+S 保存','Ctrl+B 加粗','Ctrl+I 斜体','Ctrl+U 下划线',
      'Ctrl+Z 撤销','Ctrl+Y 重做','Ctrl+F 查找','Ctrl+H 替换',
      'Ctrl+Space 清除格式','Ctrl+Shift+C 复制格式','Ctrl+Shift+V 粘贴格式',
      'Ctrl+Shift+8 项目符号','Ctrl+Shift+7 编号','Tab/Shift+Tab 缩进',
      'F11 全屏','ESC 退出格式刷',
    ];
    message.info(shortcuts.join('  |  '), 8);
  };
  const changeCase = (type: 'upper' | 'lower' | 'title') => {
    if (!e) return;
    const { from, to } = e.state.selection;
    let text = e.state.doc.textBetween(from, to);
    if (!text) { message.warning('请先选中文本'); return; }
    if (type === 'upper') text = text.toUpperCase();
    else if (type === 'lower') text = text.toLowerCase();
    else text = text.replace(/\b\w/g, c => c.toUpperCase());
    e.chain().focus().deleteSelection().insertContent(text).run();
  };
  const insertDate = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;
    e?.commands.insertContent(dateStr);
  };
  const insertTime = () => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    e?.commands.insertContent(timeStr);
  };
  const insertPageNum = () => {
    e?.commands.insertContent('<span class="page-number-field">[页码]</span>');
  };
  const mergeCells = () => { e?.commands.mergeCells(); };
  const splitCell = () => { e?.commands.splitCell(); };
  const setStyle = (v: string) => e?.chain().focus().command(({ commands }) => (commands as any).applyStyle?.(v)).run();
  const clearFmt = () => { e?.chain().focus().unsetAllMarks().run(); e?.chain().focus().setParagraphAttrs({ lineHeight: null, textIndent: '2em', marginLeft: null, marginRight: null, spaceBefore: null, spaceAfter: '8px', textAlign: null }).run(); };
  const incSize = () => { const s = e?.getAttributes('textStyle').fontSize; const n = parseInt(s)||16; const i = FONT_SIZE_SEQ.findIndex(x=>x>=n); const next = i>=0&&i<FONT_SIZE_SEQ.length-1?FONT_SIZE_SEQ[i+1]:n+1; e?.chain().focus().setMark('textStyle',{fontSize:next+'pt'}).run(); };
  const decSize = () => { const s = e?.getAttributes('textStyle').fontSize; const n = parseInt(s)||16; let idx=-1; for(let i=FONT_SIZE_SEQ.length-1;i>=0;i--){if(FONT_SIZE_SEQ[i]<=n){idx=i;break;}} const p = idx>0?FONT_SIZE_SEQ[idx-1]:Math.max(1,n-1); e?.chain().focus().setMark('textStyle',{fontSize:p+'pt'}).run(); };

  // Format painter
  const painterClick = () => {
    if (painterActive) { formatPainter.clear(); return; }
    if (painterTimer.current) { clearTimeout(painterTimer.current); painterTimer.current = null; formatPainter.activate(true); }
    else { painterTimer.current = setTimeout(() => { painterTimer.current = null; if(!formatPainter.isActive) formatPainter.activate(false); }, 300); }
  };

  // Save
  const save = async () => {
    try {
      const d = useProjectStore.getState().doc;
      const ed = useEditorStore.getState().editor;
      const res = await ipcClient.invoke<IPCResponse>(IPC_CHANNELS.FILE_SAVE_DRAFT, { ...d, editorContent: ed?.getJSON()||d.editorContent, updatedAt: new Date().toISOString() });
      if (res.success) { useEditorStore.getState().setDirty(false); message.success('已保存'); } else message.error(res.error||'保存失败');
    } catch { message.error('保存失败'); }
  };

  const showFind = () => (window as any).__editorShowFind?.();
  const showReplace = () => (window as any).__editorShowReplace?.();

  // ── Render ──────────────────────────────
  const tabs: Array<{ key: RibbonTab; label: string }> = [
    { key: 'home', label: '开始' }, { key: 'insert', label: '插入' },
    { key: 'ai', label: 'AI工具' }, { key: 'review', label: '审阅' }, { key: 'view', label: '视图' },
  ];

  const renderPanel = () => {
    switch (activeTab) {
      case 'home': return (
        <div style={{ display: 'flex', alignItems: 'stretch', height: 80, padding: '2px 4px', gap: 0 }}>
          <RibbonGroup title="剪贴板">
            <RIcon icon={<SnippetsOutlined />} title="粘贴 Ctrl+V" onClick={handlePaste}><span style={{fontSize:10}}>粘贴</span></RIcon>
            <RIcon icon={<ScissorOutlined />} title="剪切 Ctrl+X" onClick={handleCopy} />
            <RIcon icon={<CopyOutlined />} title="复制 Ctrl+C" onClick={handleCopy} />
            <RIcon icon={<FormatPainterOutlined />} title="格式刷 Ctrl+Shift+C" onClick={painterClick} active={painterActive} />
          </RibbonGroup>
          <RibbonGroup title="字体">
            <div style={{display:'flex',gap:2,alignItems:'center',flexWrap:'wrap',justifyContent:'center'}}>
              <Select size="small" defaultValue={FONT_FAMILIES[0].v} style={{width:88}} options={FONT_FAMILIES.map(f=>({value:f.v,label:<span style={{fontFamily:f.v}}>{f.l}</span>}))} onChange={setFont} />
              <Select size="small" defaultValue="16" style={{width:62}} options={FONT_SIZES.map(s=>({value:s.v,label:s.l}))} onChange={setSize} />
              <RIcon icon={<PlusOutlined />} title="增大字号" onClick={incSize} />
              <RIcon icon={<MinusOutlined />} title="减小字号" onClick={decSize} />
              <div style={{width:1,height:20,background:'#ddd',margin:'0 2px'}} />
              <RIcon icon={<BoldOutlined />} title="加粗 Ctrl+B" onClick={bold} active={e?.isActive('bold')} />
              <RIcon icon={<ItalicOutlined />} title="斜体 Ctrl+I" onClick={italic} active={e?.isActive('italic')} />
              <RIcon icon={<UnderlineOutlined />} title="下划线 Ctrl+U" onClick={underline} active={e?.isActive('underline')} />
              <RIcon icon={<StrikethroughOutlined />} title="删除线" onClick={strike} active={e?.isActive('strike')} />
              <div style={{width:1,height:20,background:'#ddd',margin:'0 2px'}} />
              <RIcon title="上标 X²" onClick={superscript} active={e?.isActive('superscript')}><span style={{fontSize:12}}>X²</span></RIcon>
              <RIcon title="下标 X₂" onClick={subscript} active={e?.isActive('subscript')}><span style={{fontSize:12}}>X₂</span></RIcon>
              <div style={{width:1,height:20,background:'#ddd',margin:'0 2px'}} />
              <ColorPicker size="small" onChange={(c)=>setColor(c.toHexString())}>
                <RIcon icon={<FontSizeOutlined />} title="字体颜色" />
              </ColorPicker>
              <ColorPicker size="small" onChange={(c)=>highlightColor(c.toHexString())} defaultValue="#ffff00">
                <RIcon title="文字高亮" active={e?.isActive('highlight')}><span style={{fontSize:14,borderBottom:'3px solid #ffff00'}}>A</span></RIcon>
              </ColorPicker>
              <RIcon icon={<ClearOutlined />} title="清除格式 Ctrl+Space" onClick={clearFmt} />
              <div style={{width:1,height:20,background:'#ddd',margin:'0 2px'}} />
              <RIcon title="大写" onClick={()=>changeCase('upper')}><span style={{fontSize:10}}>Aa</span></RIcon>
              <RIcon title="小写" onClick={()=>changeCase('lower')}><span style={{fontSize:10}}>aa</span></RIcon>
            </div>
          </RibbonGroup>
          <RibbonGroup title="段落">
            <div style={{display:'flex',gap:2,alignItems:'center',flexWrap:'wrap',justifyContent:'center'}}>
              <RIcon icon={<AlignLeftOutlined />} title="左对齐" onClick={alignL} active={e?.isActive({textAlign:'left'})} />
              <RIcon icon={<AlignCenterOutlined />} title="居中" onClick={alignC} active={e?.isActive({textAlign:'center'})} />
              <RIcon icon={<AlignRightOutlined />} title="右对齐" onClick={alignR} active={e?.isActive({textAlign:'right'})} />
              <RIcon title="两端对齐" onClick={alignJ} active={e?.isActive({textAlign:'justify'})}><span style={{fontSize:12}}>≡≡</span></RIcon>
              <div style={{width:1,height:20,background:'#ddd',margin:'0 2px'}} />
              <RIcon icon={<UnorderedListOutlined />} title="项目符号" onClick={bullet} active={e?.isActive('bulletList')} />
              <RIcon icon={<OrderedListOutlined />} title="编号" onClick={numbered} active={e?.isActive('orderedList')} />
              <div style={{width:1,height:20,background:'#ddd',margin:'0 2px'}} />
              <Select size="small" defaultValue="1.5" style={{width:66}} options={LINE_SPACINGS} onChange={setLineH} />
              <Select size="small" defaultValue="0pt" style={{width:66}} options={[{v:'0pt',l:'段前0'},{v:'6pt',l:'段前6'},{v:'12pt',l:'段前12'},{v:'18pt',l:'段前18'}]} onChange={setSpaceBefore} />
              <Select size="small" defaultValue="8px" style={{width:66}} options={[{v:'8px',l:'段后8'},{v:'0pt',l:'段后0'},{v:'6pt',l:'段后6'},{v:'12pt',l:'段后12'}]} onChange={setSpaceAfter} />
            </div>
          </RibbonGroup>
          <RibbonGroup title="样式">
            <Select size="small" defaultValue="Normal" style={{width:80}} options={STYLES} onChange={setStyle} />
          </RibbonGroup>
          <RibbonGroup title="编辑">
            <RIcon icon={<SearchOutlined />} title="查找 Ctrl+F" onClick={showFind} />
            <RIcon title="替换 Ctrl+H" onClick={showReplace}><span style={{fontSize:10}}>替换</span></RIcon>
          </RibbonGroup>
        </div>
      );
      case 'insert': return (
        <div style={{ display: 'flex', alignItems: 'stretch', height: 80, padding: '2px 4px', gap: 0 }}>
          <RibbonGroup title="图片">
            <RIcon icon={<PictureOutlined />} title="本地图片" onClick={()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=ev=>{const f=(ev.target as HTMLInputElement).files?.[0];if(f){const r=new FileReader();r.onload=()=>e?.commands.insertContent(`<img src="${r.result}"/>`);r.readAsDataURL(f);}};i.click();}} />
            <RIcon icon={<RobotOutlined />} title="AI生成图片" onClick={handleAIImageGen} />
          </RibbonGroup>
          <RibbonGroup title="表格">
            <RIcon icon={<TableOutlined />} title="插入表格" onClick={handleInsertTable} />
            <RIcon icon={<FileTextOutlined />} title="CSV导入" onClick={handleCSVImport} />
            <div style={{width:1,height:20,background:'#ddd',margin:'0 2px'}} />
            <RIcon title="合并单元格" onClick={mergeCells} />
            <RIcon title="拆分单元格" onClick={splitCell} />
          </RibbonGroup>
          <RibbonGroup title="引用">
            <RIcon icon={<FileTextOutlined />} title="插入目录" onClick={()=>setTocOpen(true)} />
            <RIcon title="插入脚注" onClick={()=>{e?.commands.insertContent('<sup><span class="footnote-mark">[脚注]</span></sup>');}} />
            <RIcon title="插入符号" onClick={()=>setSymbolOpen(true)}><span style={{fontSize:10}}>Ω</span></RIcon>
            <RIcon title="插入公式" onClick={insertEquation}><span style={{fontSize:10}}>𝑓</span></RIcon>
            <RIcon title="图片题注" onClick={insertImageCaption}><span style={{fontSize:10}}>图注</span></RIcon>
            <RIcon title="表格题注" onClick={insertTableCaption}><span style={{fontSize:10}}>表注</span></RIcon>
          </RibbonGroup>
          <RibbonGroup title="链接">
            <RIcon icon={<LineOutlined />} title="插入超链接" onClick={addLink} />
            <RIcon icon={<ClearOutlined />} title="移除超链接" onClick={removeLink} />
          </RibbonGroup>
          <RibbonGroup title="页眉页脚">
            <RIcon title="插入日期" onClick={insertDate}><span style={{fontSize:10}}>日期</span></RIcon>
            <RIcon title="插入时间" onClick={insertTime}><span style={{fontSize:10}}>时间</span></RIcon>
            <RIcon title="插入页码" onClick={insertPageNum}><span style={{fontSize:10}}>页码</span></RIcon>
          </RibbonGroup>
          <RibbonGroup title="分隔符">
            <RIcon icon={<LineOutlined />} title="分页符" onClick={()=>{e?.commands.insertContent('<p style="page-break-after:always">&nbsp;</p>');}} />
          </RibbonGroup>
        </div>
      );
      case 'ai': return (
        <div style={{ display: 'flex', alignItems: 'stretch', height: 80, padding: '2px 4px', gap: 0 }}>
          <RibbonGroup title="文本AI">
            <RIcon icon={<ThunderboltOutlined />} title="AI文本生成" onClick={()=>{import('../../stores/usePhaseStore').then(m=>m.usePhaseStore.getState().setPhase(WritingPhase.TEXT_GEN));}} />
            <RIcon icon={<ThunderboltOutlined />} title="AI文本润色" onClick={handleAIPolish} />
          </RibbonGroup>
          <RibbonGroup title="图片AI">
            <RIcon icon={<PictureOutlined />} title="AI图片生成" onClick={()=>{import('../../stores/usePhaseStore').then(m=>m.usePhaseStore.getState().setPhase(WritingPhase.IMAGES));}} />
          </RibbonGroup>
          <RibbonGroup title="表格AI">
            <RIcon icon={<TableOutlined />} title="AI表格处理" onClick={()=>{import('../../stores/usePhaseStore').then(m=>m.usePhaseStore.getState().setPhase(WritingPhase.TABLES));}} />
          </RibbonGroup>
        </div>
      );
      case 'review': return (
        <div style={{ display: 'flex', alignItems: 'stretch', height: 80, padding: '2px 4px', gap: 0 }}>
          <RibbonGroup title="审查">
            <RIcon icon={<EyeOutlined />} title="数据审查" onClick={handleDataReview} />
          </RibbonGroup>
          <RibbonGroup title="预览">
            <RIcon icon={<EyeOutlined />} title="预览模式" onClick={handlePreview} />
          </RibbonGroup>
        </div>
      );
      case 'view': return (
        <div style={{ display: 'flex', alignItems: 'stretch', height: 80, padding: '2px 4px', gap: 0 }}>
          <RibbonGroup title="视图">
            <RIcon icon={<EyeOutlined />} title="打印预览" onClick={()=>setPrintOpen(true)}>预览</RIcon>
            <RIcon title="阅读模式" onClick={()=>(window as any).__toggleReadingMode?.()}><span style={{fontSize:10}}>阅读</span></RIcon>
          </RibbonGroup>
          <RibbonGroup title="显示">
            <RIcon icon={<EyeOutlined />} title="显示/隐藏大纲" onClick={()=>(window as any).__toggleOutline?.()} />
            <RIcon icon={<EyeInvisibleOutlined />} title="显示/隐藏大纲" onClick={()=>(window as any).__toggleOutline?.()} />
            <RIcon title="行号" onClick={()=>{document.documentElement.style.setProperty('--show-line-numbers','block');message.success('行号已显示');}}><span style={{fontSize:10}}>行号</span></RIcon>
          </RibbonGroup>
          <RibbonGroup title="页面">
            <RIcon title="页面设置" onClick={()=>setPageSetupOpen(true)}><span style={{fontSize:10}}>页边距</span></RIcon>
            <RIcon title="分栏" onClick={()=>setColumnsOpen(true)}><span style={{fontSize:10}}>分栏</span></RIcon>
            <RIcon title="水印" onClick={()=>setWatermarkOpen(true)}><span style={{fontSize:10}}>水印</span></RIcon>
            <RIcon title="页面边框" onClick={()=>setPageBorderOpen(true)}><span style={{fontSize:10}}>边框</span></RIcon>
          </RibbonGroup>
          <RibbonGroup title="文档">
            <RIcon title="文档属性" onClick={()=>setPropsOpen(true)}><span style={{fontSize:10}}>属性</span></RIcon>
            <RIcon title="模板" onClick={()=>setTemplateOpen(true)}><span style={{fontSize:10}}>模板</span></RIcon>
            <RIcon title="页面颜色" onClick={()=>{ const colors=['#fff','#f5f0e8','#e8f4e8']; const cur=document.documentElement.style.getPropertyValue('--page-bg-color')||'#fff'; const idx=colors.indexOf(cur); setPageColor(colors[(idx+1)%colors.length]); }}><span style={{fontSize:10}}>配色</span></RIcon>
            <RIcon title="首字下沉" onClick={toggleDropCap}><span style={{fontSize:10}}>下沉</span></RIcon>
          </RibbonGroup>
          <RibbonGroup title="工具">
            <RIcon title="拼写检查" onClick={toggleSpellcheck}><span style={{fontSize:10}}>拼写</span></RIcon>
            <RIcon title="快捷键帮助" onClick={showShortcuts}><span style={{fontSize:10}}>?</span></RIcon>
          </RibbonGroup>
        </div>
      );
      default: return null;
    }
  };

  return (<>
    <div style={{ background: '#fafafa', borderBottom: '1px solid #d0d0d0', userSelect: 'none', flexShrink: 0 }}>
      {/* ── Title bar row: QAT + App title ── */}
      <div style={{ display: 'flex', alignItems: 'center', height: 28, paddingLeft: 4, background: '#fafafa' }}>
        {/* Quick Access Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, paddingRight: 12 }}>
          <Tooltip title="新建文档" placement="bottom"><Button type="text" size="small" icon={<FileAddOutlined />} onClick={handleNewDoc} style={{ height: 24, width: 28, fontSize: 14 }} /></Tooltip>
          <Tooltip title="打开草稿" placement="bottom"><Button type="text" size="small" icon={<FolderOpenOutlined />} onClick={() => setDraftOpen(true)} style={{ height: 24, width: 28, fontSize: 14 }} /></Tooltip>
          <Tooltip title="保存 Ctrl+S" placement="bottom"><Button type="text" size="small" icon={<SaveOutlined />} onClick={save} style={{ height: 24, width: 28, fontSize: 14 }} /></Tooltip>
          <div style={{ width: 8 }} />
          <Tooltip title="撤销 Ctrl+Z" placement="bottom"><Button type="text" size="small" icon={<UndoOutlined />} onClick={undo} style={{ height: 24, width: 28, fontSize: 14 }} /></Tooltip>
          <Tooltip title="重做 Ctrl+Y" placement="bottom"><Button type="text" size="small" icon={<RedoOutlined />} onClick={redo} style={{ height: 24, width: 28, fontSize: 14 }} /></Tooltip>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#666', pointerEvents: 'none' }}>
          秋AI编辑器 — 科研申报书AI辅助写作
        </div>
        <div style={{ paddingRight: 8, display: 'flex', gap: 4 }}>
          <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => setAiSettingsOpen(true)} style={{ height: 24, fontSize: 12 }}>AI设置</Button>
          <Button type="primary" size="small" icon={<ExportOutlined />} onClick={() => setExportOpen(true)} style={{ height: 24, fontSize: 12 }}>导出</Button>
        </div>
      </div>

      {/* ── Tab row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', height: 24, paddingLeft: 4, background: '#f0f0f0', borderBottom: '1px solid #d0d0d0' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            border: 'none', background: activeTab === tab.key ? '#fafafa' : 'transparent',
            padding: '3px 16px', cursor: 'pointer', fontSize: 12,
            fontWeight: activeTab === tab.key ? 600 : 400,
            color: activeTab === tab.key ? '#1677ff' : '#444',
            borderBottom: activeTab === tab.key ? '2px solid #1677ff' : '2px solid transparent',
            outline: 'none', transition: 'all 0.1s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Ribbon panel ── */}
      <div style={{ background: '#fafafa', minHeight: 80 }}>
        {renderPanel()}
      </div>
    </div>

    <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    <DraftManagerDialog open={draftOpen} onClose={() => setDraftOpen(false)} />
    <AISettingsDialog open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} />
    <TocDialog open={tocOpen} onClose={() => setTocOpen(false)} />
    <PageSetupDialog open={pageSetupOpen} onClose={() => setPageSetupOpen(false)} />
    <SymbolPanel open={symbolOpen} onClose={() => setSymbolOpen(false)} />
    <WatermarkDialog open={watermarkOpen} onClose={() => setWatermarkOpen(false)} />
    <ColumnsDialog open={columnsOpen} onClose={() => setColumnsOpen(false)} />
    <PrintPreview open={printOpen} onClose={() => setPrintOpen(false)} />
    <DocumentPropertiesDialog open={propsOpen} onClose={() => setPropsOpen(false)} />
    <PageBorderDialog open={pageBorderOpen} onClose={() => setPageBorderOpen(false)} />
    <TemplateDialog open={templateOpen} onClose={() => setTemplateOpen(false)} />
  </>);
}
