/** RightPanel — Properties panel (removed chat, now standalone) */
import { Input, Select, Space, Tooltip, Divider, Button, InputNumber } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useEditorStore } from '../../stores/useEditorStore';

export function RightPanel() {
  const editor = useEditorStore((s) => s.editor);
  const selectedText = useEditorStore((s) => s.selectedText);
  const isImageSelected = editor?.isActive('image') || editor?.state.selection.$from.node()?.type.name === 'image';
  const imageAttrs = isImageSelected ? editor?.getAttributes('image') : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fafafa', borderLeft: '1px solid #e0e0e0', overflow: 'hidden' }}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #e0e0e0', fontSize: 12, fontWeight: 600 }}>
        <SettingOutlined /> 属性
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
        {!editor || (!selectedText && !isImageSelected) ? (
          <div style={{ textAlign: 'center', color: '#999', fontSize: 12, padding: 16 }}>
            <p>未选中对象</p>
            <p style={{ fontSize: 11 }}>选中文本或图片后显示属性</p>
          </div>
        ) : isImageSelected && imageAttrs ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>图片格式</div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 11, color: '#666' }}>宽度</label>
              <InputNumber size="small" style={{ width: '100%' }} min={10} max={800} value={parseInt(imageAttrs.width) || undefined} onChange={(v) => editor.chain().focus().updateAttributes('image', { width: v ? `${v}px` : null }).run()} placeholder="自动" /></div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 11, color: '#666' }}>高度</label>
              <InputNumber size="small" style={{ width: '100%' }} min={10} max={800} value={parseInt(imageAttrs.height) || undefined} onChange={(v) => editor.chain().focus().updateAttributes('image', { height: v ? `${v}px` : null }).run()} placeholder="自动" /></div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 11, color: '#666' }}>对齐</label>
              <Space size={4}><Button size="small" onClick={() => editor.chain().focus().updateAttributes('image', { style: 'display:block;margin:0 auto' }).run()}>居中</Button><Button size="small" onClick={() => editor.chain().focus().updateAttributes('image', { style: null }).run()}>默认</Button></Space></div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 11, color: '#666' }}>边框</label>
              <Button size="small" block onClick={() => editor.chain().focus().updateAttributes('image', { style: 'border:2px solid #000' }).run()}>添加边框</Button></div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 11, color: '#666' }}>替代文本</label>
              <Input size="small" value={imageAttrs.alt || ''} onChange={(e) => editor.chain().focus().updateAttributes('image', { alt: e.target.value }).run()} placeholder="图片说明..." /></div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>文本属性</div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 11, color: '#666', display: 'block' }}>字体</label>
              <Select size="small" style={{ width: '100%' }} value={editor.getAttributes('textStyle').fontFamily || 'FangSong'} onChange={(v) => editor.chain().focus().setMark('textStyle', { fontFamily: v }).run()}
                options={[{ v: 'SimSun, 宋体, serif', l: '宋体' }, { v: 'SimHei, 黑体, sans-serif', l: '黑体' }, { v: 'FangSong, 仿宋, serif', l: '仿宋' }, { v: 'KaiTi, 楷体, serif', l: '楷体' }, { v: 'Microsoft YaHei, 微软雅黑, sans-serif', l: '微软雅黑' }].map(f => ({ value: f.v, label: f.l }))} /></div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 11, color: '#666', display: 'block' }}>字号</label>
              <InputNumber size="small" style={{ width: '100%' }} min={6} max={72} value={parseInt(editor.getAttributes('textStyle').fontSize) || 16} onChange={(v) => editor.chain().focus().setMark('textStyle', { fontSize: (v || 16) + 'pt' }).run()} /></div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 11, color: '#666', display: 'block' }}>颜色</label>
              <Input size="small" type="color" value={editor.getAttributes('textStyle').color || '#000000'} onChange={(e) => editor.chain().focus().setMark('textStyle', { color: e.target.value }).run()} style={{ width: '100%', height: 24, padding: 1 }} /></div>
            <Divider style={{ margin: '6px 0' }} />
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>样式</div>
            <Space size={4} wrap>
              <Button size="small" type={editor.isActive('bold') ? 'primary' : 'default'} onClick={() => editor.chain().focus().toggleBold().run()}>B</Button>
              <Button size="small" type={editor.isActive('italic') ? 'primary' : 'default'} onClick={() => editor.chain().focus().toggleItalic().run()}>I</Button>
              <Button size="small" type={editor.isActive('underline') ? 'primary' : 'default'} onClick={() => editor.chain().focus().toggleUnderline().run()}>U</Button>
            </Space>
            <Divider style={{ margin: '6px 0' }} />
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>段落</div>
            <Space size={4} wrap>
              <Button size="small" onClick={() => editor.chain().focus().setTextAlign('left').run()}>左</Button>
              <Button size="small" onClick={() => editor.chain().focus().setTextAlign('center').run()}>中</Button>
              <Button size="small" onClick={() => editor.chain().focus().setTextAlign('right').run()}>右</Button>
            </Space>
          </>
        )}
      </div>
    </div>
  );
}
