/**
 * BookmarkPanel — Insert and navigate bookmarks in the document.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button, List, Input, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, AimOutlined } from '@ant-design/icons';
import { useEditorStore } from '../../stores/useEditorStore';

interface Bookmark {
  id: string;
  name: string;
  pos: number;
}

export function BookmarkPanel() {
  const editor = useEditorStore((s) => s.editor);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [newName, setNewName] = useState('');

  // Scan document for bookmark marks
  const scanBookmarks = useCallback(() => {
    if (!editor) return;
    const found: Bookmark[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'text' && node.marks) {
        for (const mark of node.marks) {
          if (mark.type.name === 'bookmark') {
            found.push({ id: mark.attrs.id || String(pos), name: mark.attrs.name || '未命名', pos });
          }
        }
      }
    });
    setBookmarks(found);
  }, [editor]);

  useEffect(() => { scanBookmarks(); }, [editor, scanBookmarks]);

  const add = () => {
    if (!editor || !newName.trim()) return;
    const id = Date.now().toString(36);
    editor.chain().focus().setMark('textStyle', { bookmarkId: id, bookmarkName: newName.trim() }).run();
    setNewName('');
    scanBookmarks();
    message.success(`书签"${newName.trim()}"已添加`);
  };

  const goTo = (pos: number) => {
    if (!editor) return;
    editor.commands.setTextSelection(pos);
    editor.commands.scrollIntoView();
  };

  const remove = (id: string) => {
    if (!editor) return;
    // Remove bookmark mark
    editor.state.doc.descendants((node, pos) => {
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type.name === 'textStyle' && mark.attrs.bookmarkId === id) {
            editor.chain().setTextSelection({ from: pos, to: pos + (node.text?.length || 0) }).unsetMark('textStyle').run();
          }
        }
      }
    });
    scanBookmarks();
  };

  return (
    <div style={{ padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>书签</div>
      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
        <Input size="small" value={newName} onChange={(e) => setNewName(e.target.value)} onPressEnter={add} placeholder="书签名称" />
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={add} />
      </Space.Compact>
      <List size="small" dataSource={bookmarks} style={{ maxHeight: 200, overflow: 'auto' }}
        renderItem={(b) => (
          <List.Item style={{ padding: '2px 0' }}
            actions={[
              <Button key="go" type="link" size="small" icon={<AimOutlined />} onClick={() => goTo(b.pos)} />,
              <Popconfirm key="del" title="删除此书签？" onConfirm={() => remove(b.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}>
            {b.name}
          </List.Item>
        )} />
    </div>
  );
}
