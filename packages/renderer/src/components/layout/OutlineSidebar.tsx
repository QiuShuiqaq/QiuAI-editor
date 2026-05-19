import { useState, useEffect, useCallback } from 'react';
import { Tree, Button, Collapse, Badge } from 'antd';
import {
  FileTextOutlined, EditOutlined, CaretRightOutlined,
} from '@ant-design/icons';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { useEditorStore } from '../../stores/useEditorStore';
import type { FrameworkNode } from '@qiuai/shared';
import { FrameworkBuilder } from '../phases/Phase1Framework/FrameworkBuilder';
import type { DataNode } from 'antd/es/tree';

function toTreeData(nodes: FrameworkNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: (
      <span style={{ fontSize: 12 }}>
        <span style={{ color: '#999', marginRight: 4 }}>{node.order}.</span>
        {node.title}
        {node.needsImage && <span style={{ marginLeft: 4, color: '#1677ff', fontSize: 10 }}>🖼</span>}
        {node.needsTable && <span style={{ marginLeft: 2, color: '#52c41a', fontSize: 10 }}>📊</span>}
      </span>
    ),
    children: node.children.length > 0 ? toTreeData(node.children) : undefined,
    selectable: true,
  }));
}

export function OutlineSidebar() {
  const nodes = useFrameworkStore((s) => s.nodes);
  const editor = useEditorStore((s) => s.editor);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);

  // Auto-expand all
  useEffect(() => {
    const allKeys: string[] = [];
    function walk(ns: FrameworkNode[]) {
      for (const n of ns) { allKeys.push(n.id); walk(n.children); }
    }
    walk(nodes);
    setExpandedKeys(allKeys);
  }, [nodes]);

  const handleSelect = (keys: React.Key[]) => {
    if (keys.length === 0 || !editor) return;
    const nodeId = keys[0] as string;
    const findTitle = (ns: FrameworkNode[]): string | null => {
      for (const n of ns) {
        if (n.id === nodeId) return n.title;
        const found = findTitle(n.children);
        if (found) return found;
      }
      return null;
    };
    const title = findTitle(nodes);
    if (title) {
      let pos = 0;
      editor.state.doc.descendants((node, p) => {
        if (node.type.name === 'heading' && node.textContent.includes(title) && pos === 0) {
          pos = p;
        }
      });
      if (pos > 0) {
        editor.commands.setTextSelection(pos);
        editor.commands.scrollIntoView();
      }
    }
  };

  const treeData = toTreeData(nodes);
  const totalNodes = nodes.reduce((sum, n) => sum + 1 + countChildren(n), 0);

  function countChildren(n: FrameworkNode): number {
    return n.children.reduce((s, c) => s + 1 + countChildren(c), 0);
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px', borderBottom: '1px solid #e8e8e8',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          <FileTextOutlined /> 文档大纲
        </span>
        <span style={{ fontSize: 11, color: '#999' }}>{totalNodes} 项</span>
      </div>

      {/* Outline Tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 4px' }}>
        {nodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#999', fontSize: 12 }}>
            <FileTextOutlined style={{ fontSize: 24, marginBottom: 8 }} />
            <p>暂无大纲</p>
            <p style={{ fontSize: 11 }}>点击下方「编辑框架」开始构建</p>
          </div>
        ) : (
          <Tree
            treeData={treeData}
            showLine={false}
            showIcon={false}
            selectedKeys={[]}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            onSelect={handleSelect}
            style={{ fontSize: 12, background: 'transparent' }}
            blockNode
          />
        )}
      </div>

      {/* Framework Editor Panel */}
      <div style={{ borderTop: '1px solid #e8e8e8', flexShrink: 0 }}>
        <Collapse
          ghost
          size="small"
          activeKey={editing ? ['editor'] : []}
          onChange={(keys) => setEditing(keys.includes('editor'))}
          items={[
            {
              key: 'editor',
              label: (
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  <EditOutlined /> 编辑框架 {editing ? '' : '(点击展开)'}
                </span>
              ),
              children: <FrameworkBuilder compact />,
            },
          ]}
        />
      </div>
    </div>
  );
}
