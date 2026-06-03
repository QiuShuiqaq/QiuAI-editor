import { useEffect, useMemo, useState } from 'react';
import { Alert, Collapse, Tree, message } from 'antd';
import { EditOutlined, FileTextOutlined, PictureOutlined, TableOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import type { FrameworkNode } from '@qiuai/shared';
import { executeDocumentCommand } from '../../services/documentEngineCommands';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { supportsStructuralNavigation } from '../../utils/documentEngineCapabilities';
import { FrameworkBuilder } from '../phases/Phase1Framework/FrameworkBuilder';

function flattenNodes(nodes: FrameworkNode[]): FrameworkNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function countChildren(node: FrameworkNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countChildren(child), 0);
}

function findNodeTitle(id: string, nodes: FrameworkNode[]): string | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node.title;
    }

    const found = findNodeTitle(id, node.children);
    if (found) {
      return found;
    }
  }

  return null;
}

function toTreeData(nodes: FrameworkNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
        <span>{node.title}</span>
        {node.needsImage ? <PictureOutlined style={{ color: '#1677ff', fontSize: 11 }} /> : null}
        {node.needsTable ? <TableOutlined style={{ color: '#52c41a', fontSize: 11 }} /> : null}
      </span>
    ),
    children: node.children.length > 0 ? toTreeData(node.children) : undefined,
    selectable: true,
  }));
}

export function OutlineSidebar() {
  const nodes = useFrameworkStore((state) => state.nodes);
  const editor = useEditorStore((state) => state.editor);
  const activeSectionTitle = useEditorStore((state) => state.activeSectionTitle);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);

  const flatNodes = useMemo(() => flattenNodes(nodes), [nodes]);
  const canNavigateByStructure = supportsStructuralNavigation(documentEngineAdapter);

  useEffect(() => {
    setExpandedKeys(flatNodes.map((node) => node.id));
  }, [flatNodes]);

  const selectedKeys = useMemo(() => {
    if (!activeSectionTitle) {
      return [];
    }

    const matchedNode = flatNodes.find((node) => node.title.trim() === activeSectionTitle.trim());
    return matchedNode ? [matchedNode.id] : [];
  }, [activeSectionTitle, flatNodes]);

  const handleSelect = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      return;
    }

    const nodeId = String(keys[0]);
    const title = findNodeTitle(nodeId, nodes);
    if (!title) {
      return;
    }

    if (documentEngineAdapter && canNavigateByStructure) {
      const success = await executeDocumentCommand('scroll-to-heading', { value: title });
      if (!success) {
        message.warning('当前没有定位到该标题，请确认正文里已经生成对应章节。');
      }
      return;
    }

    if (!editor) {
      return;
    }

    let pos = 0;
    editor.state.doc.descendants((node, currentPos) => {
      if (node.type.name === 'heading' && node.textContent.includes(title) && pos === 0) {
        pos = currentPos;
      }
    });

    if (pos > 0) {
      editor.commands.setTextSelection(pos);
      editor.commands.scrollIntoView();
      return;
    }

    message.warning('当前没有定位到该标题，请确认正文里已经生成对应章节。');
  };

  const totalNodes = nodes.reduce((sum, node) => sum + 1 + countChildren(node), 0);

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        background: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e8e8e8',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          <FileTextOutlined /> 文档大纲
        </span>
        <span style={{ fontSize: 11, color: '#999' }}>{totalNodes} 项</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 4px' }}>
        {documentEngineAdapter && !canNavigateByStructure ? (
          <Alert
            style={{ margin: '0 8px 8px' }}
            type="info"
            showIcon
            message="当前大纲可用于查看章节结构"
            description="章节已经按正式文档层级组织；如当前区域暂不支持跳转，可先在正文中定位后继续编辑。"
          />
        ) : null}

        {nodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#999', fontSize: 12 }}>
            <FileTextOutlined style={{ fontSize: 24, marginBottom: 8 }} />
            <p>暂无大纲</p>
            <p style={{ fontSize: 11 }}>点击下方“编辑大纲”开始搭建章节结构。</p>
          </div>
        ) : (
          <Tree
            treeData={toTreeData(nodes)}
            showLine={false}
            showIcon={false}
            selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            onSelect={(keys) => {
              void handleSelect(keys);
            }}
            style={{ fontSize: 12, background: 'transparent' }}
            blockNode
          />
        )}
      </div>

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
                  <EditOutlined /> 编辑大纲 {editing ? '' : '(点击展开)'}
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
