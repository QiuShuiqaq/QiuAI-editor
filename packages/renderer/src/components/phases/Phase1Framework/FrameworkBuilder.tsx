import { useState } from 'react';
import { Button, Checkbox, Col, Collapse, Input, Popconfirm, Row, Space, Tag, Tree, message } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  ImportOutlined,
  PictureOutlined,
  PlusOutlined,
  TableOutlined,
  UpOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { parseOutlineText, syncDocumentWithState, type FrameworkNode } from '@qiuai/shared';
import { executeDocumentCommand } from '../../../services/documentEngineCommands';
import { useFrameworkStore } from '../../../stores/useFrameworkStore';
import { useProjectStore } from '../../../stores/useProjectStore';

function toTreeData(nodes: FrameworkNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: (
      <span>
        {node.title}
        {node.needsImage ? (
          <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>
            图
          </Tag>
        ) : null}
        {node.needsTable ? (
          <Tag color="green" style={{ marginLeft: 2, fontSize: 10 }}>
            表
          </Tag>
        ) : null}
      </span>
    ),
    children: node.children.length > 0 ? toTreeData(node.children) : undefined,
  }));
}

interface Props {
  compact?: boolean;
}

export function FrameworkBuilder({ compact = false }: Props) {
  const { nodes, addNode, removeNode, updateNode, moveNode, changeLevel, setNodes } = useFrameworkStore();
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const [newTitle, setNewTitle] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importGenerating, setImportGenerating] = useState(false);

  const selectedNodeId = selectedKeys[0] || null;
  const selectedNode = selectedNodeId ? findNode(selectedNodeId, nodes) : null;

  const handleAdd = () => {
    const nextTitle = newTitle.trim();
    if (!nextTitle) {
      return;
    }
    addNode(selectedNodeId, nextTitle);
    setNewTitle('');
  };

  const handleDelete = () => {
    if (!selectedNodeId) {
      return;
    }
    removeNode(selectedNodeId);
    setSelectedKeys([]);
  };

  const handleRename = () => {
    const nextTitle = editTitle.trim();
    if (editingNode && nextTitle) {
      updateNode(editingNode, { title: nextTitle });
    }
    setEditingNode(null);
  };

  const parseImportOutline = (): FrameworkNode[] | null => {
    if (!importText.trim()) {
      message.warning('请先粘贴文档大纲。');
      return null;
    }

    const parsed = parseOutlineText(importText);
    if (parsed.length === 0) {
      message.warning('未能识别大纲结构，请检查编号格式。');
      return null;
    }

    return parsed;
  };

  const handleImport = () => {
    const parsed = parseImportOutline();
    if (!parsed) {
      return;
    }

    setNodes(parsed);
    setDoc(
      syncDocumentWithState({
        ...doc,
        framework: parsed,
        editorContent: {},
        updatedAt: new Date().toISOString(),
      })
    );
    setImportText('');
    setImportOpen(false);
    message.success(`已导入 ${countNodes(parsed)} 个标题节点。`);
  };

  const handleImportAndGenerate = async () => {
    const parsed = parseImportOutline();
    if (!parsed) {
      return;
    }

    setImportGenerating(true);
    try {
      setNodes(parsed);
      setDoc(
        syncDocumentWithState({
          ...doc,
          framework: parsed,
          editorContent: {},
          updatedAt: new Date().toISOString(),
        })
      );
      setImportText('');
      setImportOpen(false);

      const generated = await executeDocumentCommand('generate-full-paper');
      if (!generated) {
        throw new Error('提纲已导入，但未能开始生成全文。');
      }

      message.success(`已导入 ${countNodes(parsed)} 个标题节点，并开始生成全文。`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导入后生成全文失败');
    } finally {
      setImportGenerating(false);
    }
  };

  return (
    <div style={{ padding: compact ? '8px 4px' : '16px' }}>
      <Collapse
        ghost
        size="small"
        activeKey={importOpen ? ['import'] : []}
        onChange={(keys) => setImportOpen(keys.includes('import'))}
        items={[
          {
            key: 'import',
            label: (
              <span style={{ fontSize: 12, fontWeight: 500, color: '#1677ff' }}>
                <ImportOutlined /> 批量导入提纲
              </span>
            ),
            children: (
              <div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>
                  支持格式：一、标题 / （一）子标题 / 1. 子标题 / 1.1 细标题 / （1）细标题 / ① 细标题
                </div>
                <Input.TextArea
                  rows={8}
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder={`粘贴提纲文本，例如：
一、项目背景与意义
（一）国内外研究现状
1. 国外研究进展
2. 国内研究进展
（二）发展趋势
二、研究目标与内容
（一）总体目标
1.1 具体目标一
（1）支撑任务`}
                  style={{ fontSize: 12, marginBottom: 8 }}
                />
                <Space>
                  <Button type="primary" size="small" icon={<ImportOutlined />} onClick={handleImport}>
                    解析并导入
                  </Button>
                  <Button size="small" loading={importGenerating} onClick={() => void handleImportAndGenerate()}>
                    导入并生成全文
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setImportText('');
                      setImportOpen(false);
                    }}
                  >
                    取消
                  </Button>
                </Space>
              </div>
            ),
          },
        ]}
      />

      <Space.Compact style={{ width: '100%', marginBottom: 8, marginTop: 8 }}>
        <Input
          size="small"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          onPressEnter={handleAdd}
          placeholder="手动添加标题..."
        />
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd} />
      </Space.Compact>

      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          padding: 4,
          minHeight: 120,
          maxHeight: compact ? 250 : 400,
          overflow: 'auto',
          marginBottom: 8,
        }}
      >
        {nodes.length > 0 ? (
          <Tree
            treeData={toTreeData(nodes)}
            selectedKeys={selectedKeys}
            onSelect={(keys) => setSelectedKeys(keys as string[])}
            defaultExpandAll
            showLine
          />
        ) : (
          <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 32 }}>
            暂无大纲，可使用上方“批量导入”或手动添加。
          </div>
        )}
      </div>

      {selectedNode ? (
        <div style={{ background: '#f5f5f5', borderRadius: 4, padding: 8, marginBottom: 8 }}>
          {editingNode === selectedNode.id ? (
            <Space.Compact style={{ width: '100%' }}>
              <Input size="small" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} onPressEnter={handleRename} />
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
                <Button
                  size="small"
                  icon={<VerticalAlignTopOutlined />}
                  onClick={() => changeLevel(selectedNode.id, 1)}
                  disabled={selectedNode.level >= 3}
                  title="升级"
                />
                <Button
                  size="small"
                  icon={<VerticalAlignBottomOutlined />}
                  onClick={() => changeLevel(selectedNode.id, -1)}
                  disabled={selectedNode.level <= 1}
                  title="降级"
                />
              </Space>
              <div style={{ marginTop: 4 }}>
                <Space size={2}>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditingNode(selectedNode.id);
                      setEditTitle(selectedNode.title);
                    }}
                  >
                    重命名
                  </Button>
                  <Popconfirm title="确定删除此节点及其子节点吗？" onConfirm={handleDelete}>
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
              <div style={{ marginTop: 6 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Checkbox
                      checked={selectedNode.needsImage}
                      onChange={(event) => updateNode(selectedNode.id, { needsImage: event.target.checked })}
                    >
                      <PictureOutlined /> 预留图片位
                    </Checkbox>
                  </Col>
                  <Col span={12}>
                    <Checkbox
                      checked={selectedNode.needsTable}
                      onChange={(event) => updateNode(selectedNode.id, { needsTable: event.target.checked })}
                    >
                      <TableOutlined /> 预留表格位
                    </Checkbox>
                  </Col>
                </Row>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function findNode(id: string, nodes: FrameworkNode[]): FrameworkNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const found = findNode(id, node.children);
    if (found) {
      return found;
    }
  }
  return null;
}

function countNodes(nodes: FrameworkNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}
