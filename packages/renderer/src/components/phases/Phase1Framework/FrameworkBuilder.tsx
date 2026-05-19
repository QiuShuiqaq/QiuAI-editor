import { useState } from 'react';
import { Button, Input, Tree, Space, Popconfirm, message, Tag, Checkbox, Row, Col, Collapse } from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  PictureOutlined, TableOutlined, CheckOutlined, CloseOutlined,
  UpOutlined, DownOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import { useFrameworkStore } from '../../../stores/useFrameworkStore';
import type { FrameworkNode } from '@qiuai/shared';
import type { DataNode } from 'antd/es/tree';

function toTreeData(nodes: FrameworkNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: (
      <span>
        {node.title}
        {node.needsImage && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>图</Tag>}
        {node.needsTable && <Tag color="green" style={{ marginLeft: 2, fontSize: 10 }}>表</Tag>}
      </span>
    ),
    children: node.children.length > 0 ? toTreeData(node.children) : undefined,
  }));
}

// ── Text Import Parser ────────────────────────
// Detect heading level from numbering prefix
function detectLevel(line: string): { level: 1|2|3; title: string; order: number } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Level 1: 一、二、三、… 十、
  const chineseNum = /^([一二三四五六七八九十]+)、(.+)/.exec(trimmed);
  if (chineseNum) {
    const map: Record<string,number> = {一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
    const num = map[chineseNum[1]] ?? 1;
    return { level: 1, title: chineseNum[2].trim(), order: num };
  }

  // Level 2: （一）（二）（三）
  const parenNum = /^（([一二三四五六七八九十]+)）(.+)/.exec(trimmed);
  if (parenNum) {
    const map: Record<string,number> = {一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
    const num = map[parenNum[1]] ?? 1;
    return { level: 2, title: parenNum[2].trim(), order: num };
  }

  // Level 2 or 3: X.Y pattern (e.g., 1.1, 2.3)
  const dotNum = /^(\d+)\.(\d+)\s*(.+)/.exec(trimmed);
  if (dotNum) {
    return { level: 3, title: dotNum[3].trim(), order: parseInt(dotNum[2]) };
  }

  // Level 2: N. pattern (e.g., 1., 2., 3.)
  const dotSingle = /^(\d+)\.\s+(.+)/.exec(trimmed);
  if (dotSingle) {
    return { level: 2, title: dotSingle[2].trim(), order: parseInt(dotSingle[1]) };
  }

  // Level 3: (1) (2) (3)
  const parenDigit = /^\((\d+)\)\s*(.+)/.exec(trimmed);
  if (parenDigit) {
    return { level: 3, title: parenDigit[2].trim(), order: parseInt(parenDigit[1]) };
  }

  // Level 3: ① ② ③ (Unicode circled numbers U+2460-U+2469)
  const cc = trimmed.charCodeAt(0);
  if (cc >= 0x2460 && cc <= 0x2469) {
    return { level: 3, title: trimmed.slice(1).trim(), order: cc - 0x2460 + 1 };
  }

  // Level 3: a. b. c.
  const alphaNum = /^([a-z])\.\s+(.+)/i.exec(trimmed);
  if (alphaNum) {
    return { level: 3, title: alphaNum[2].trim(), order: alphaNum[1].charCodeAt(0) - 96 };
  }

  // No prefix detected — treat as unexpected but still add as level 1
  return { level: 1, title: trimmed, order: 99 };
}

/** Parse raw text into FrameworkNode tree */
export function parseOutlineText(text: string): FrameworkNode[] {
  const lines = text.split(/[\n\r]+/).filter(l => l.trim());
  const root: FrameworkNode[] = [];
  const stack: FrameworkNode[] = []; // parent stack

  for (const line of lines) {
    const parsed = detectLevel(line);
    if (!parsed) continue;

    const node: FrameworkNode = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
      title: parsed.title,
      level: parsed.level,
      order: parsed.order,
      children: [],
      needsImage: false,
      needsTable: false,
      dataKeywords: [],
    };

    // Pop stack until we find a parent with level < current
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    // Push current node as potential parent for next lines
    stack.push(node);
    // Ensure stack depth doesn't exceed 3
    if (stack.length > 3) stack.shift();
  }

  return root;
}

// ── Component ─────────────────────────────────
interface Props { compact?: boolean; }

export function FrameworkBuilder({ compact = false }: Props) {
  const { nodes, addNode, removeNode, updateNode, moveNode, changeLevel, setNodes } = useFrameworkStore();
  const [newTitle, setNewTitle] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const selectedNodeId = selectedKeys[0] || null;
  const selectedNode = selectedNodeId ? findNode(selectedNodeId, nodes) : null;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addNode(selectedNodeId, newTitle.trim());
    setNewTitle('');
  };

  const handleDelete = () => {
    if (selectedNodeId) { removeNode(selectedNodeId); setSelectedKeys([]); }
  };

  const handleRename = () => {
    if (editingNode && editTitle.trim()) updateNode(editingNode, { title: editTitle.trim() });
    setEditingNode(null);
  };

  const handleImport = () => {
    if (!importText.trim()) { message.warning('请粘贴提纲文本'); return; }
    const parsed = parseOutlineText(importText);
    if (parsed.length === 0) { message.warning('未能识别标题格式，请检查文本格式'); return; }
    setNodes(parsed);
    setImportText('');
    setImportOpen(false);
    message.success(`已导入 ${countNodes(parsed)} 个标题`);
  };

  const treeData = toTreeData(nodes);

  return (
    <div style={{ padding: compact ? '8px 4px' : '16px' }}>
      {/* ── Batch Import ── */}
      <Collapse ghost size="small" activeKey={importOpen ? ['import'] : []}
        onChange={(keys) => setImportOpen(keys.includes('import'))}
        items={[{
          key: 'import',
          label: <span style={{ fontSize: 12, fontWeight: 500, color: '#1677ff' }}>
            <ImportOutlined /> 批量导入提纲（粘贴文本自动解析）
          </span>,
          children: (
            <div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>
                支持格式：一、标题 / （一）子标题 / 1. 子标题 / 1.1 细标题 / (1) 细标题 / ① 细标题
              </div>
              <Input.TextArea
                rows={8}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`粘贴提纲文本，例如：\n一、项目背景与意义\n（一）国内外研究现状\n1. 国外研究进展\n2. 国内研究进展\n（二）发展趋势\n二、研究目标与内容\n（一）总体目标\n1.1 具体目标一\n1.2 具体目标二`}
                style={{ fontSize: 12, marginBottom: 8 }}
              />
              <Space>
                <Button type="primary" size="small" icon={<ImportOutlined />} onClick={handleImport}>解析并导入</Button>
                <Button size="small" onClick={() => { setImportText(''); setImportOpen(false); }}>取消</Button>
              </Space>
            </div>
          ),
        }]}
      />

      {/* ── Manual Add ── */}
      <Space.Compact style={{ width: '100%', marginBottom: 8, marginTop: 8 }}>
        <Input size="small" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          onPressEnter={handleAdd} placeholder="手动添加标题..." />
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd} />
      </Space.Compact>

      {/* ── Tree ── */}
      <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 4,
        minHeight: 120, maxHeight: compact ? 250 : 400, overflow: 'auto', marginBottom: 8 }}>
        {treeData.length > 0 ? (
          <Tree treeData={treeData} selectedKeys={selectedKeys}
            onSelect={(keys) => setSelectedKeys(keys as string[])} defaultExpandAll showLine />
        ) : (
          <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 32 }}>
            暂无节点，使用上方「批量导入」或手动添加
          </div>
        )}
      </div>

      {/* ── Selected Node Actions ── */}
      {selectedNode && (
        <div style={{ background: '#f5f5f5', borderRadius: 4, padding: 8, marginBottom: 8 }}>
          {editingNode === selectedNode.id ? (
            <Space.Compact style={{ width: '100%' }}>
              <Input size="small" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onPressEnter={handleRename} />
              <Button size="small" icon={<CheckOutlined />} onClick={handleRename} type="primary" />
              <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingNode(null)} />
            </Space.Compact>
          ) : (
            <>
              <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>
                {selectedNode.title}
                <Tag style={{ marginLeft: 8, fontSize: 10 }}>层级 {selectedNode.level}</Tag>
                <Tag style={{ fontSize: 10 }}>序号 {selectedNode.order}</Tag>
              </div>
              <Space size={2} style={{ marginBottom: 4 }}>
                <Button size="small" icon={<UpOutlined />} onClick={() => moveNode(selectedNode.id, 'up')} title="上移" />
                <Button size="small" icon={<DownOutlined />} onClick={() => moveNode(selectedNode.id, 'down')} title="下移" />
                <div style={{ width: 1, height: 20, background: '#d9d9d9', margin: '0 4px' }} />
                <Button size="small" icon={<VerticalAlignTopOutlined />} onClick={() => changeLevel(selectedNode.id, 1)} disabled={selectedNode.level >= 3} title="升级" />
                <Button size="small" icon={<VerticalAlignBottomOutlined />} onClick={() => changeLevel(selectedNode.id, -1)} disabled={selectedNode.level <= 1} title="降级" />
              </Space>
              <div style={{ marginTop: 4 }}>
                <Space size={2}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingNode(selectedNode.id); setEditTitle(selectedNode.title); }}>重命名</Button>
                  <Popconfirm title="确定删除此节点及其子节点？" onConfirm={handleDelete}>
                    <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              </div>
              <div style={{ marginTop: 6 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Checkbox checked={selectedNode.needsImage}
                      onChange={(e) => updateNode(selectedNode.id, { needsImage: e.target.checked })}>
                      <PictureOutlined /> 预留图片位
                    </Checkbox>
                  </Col>
                  <Col span={12}>
                    <Checkbox checked={selectedNode.needsTable}
                      onChange={(e) => updateNode(selectedNode.id, { needsTable: e.target.checked })}>
                      <TableOutlined /> 预留表格位
                    </Checkbox>
                  </Col>
                </Row>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──
function findNode(id: string, nodes: FrameworkNode[]): FrameworkNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(id, node.children);
    if (found) return found;
  }
  return null;
}

function countNodes(nodes: FrameworkNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}
