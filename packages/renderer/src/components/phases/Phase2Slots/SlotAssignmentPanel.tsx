import { Button, Checkbox, List, message, Tag } from 'antd';
import {
  PictureOutlined,
  TableOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useFrameworkStore } from '../../../stores/useFrameworkStore';
import { usePhaseStore } from '../../../stores/usePhaseStore';
import { useProjectStore } from '../../../stores/useProjectStore';
import { WritingPhase, type FrameworkNode } from '@qiuai/shared';

function flattenNodes(nodes: FrameworkNode[]): FrameworkNode[] {
  const result: FrameworkNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenNodes(node.children));
  }
  return result;
}

export function SlotAssignmentPanel() {
  const { nodes, updateNode } = useFrameworkStore();
  const setPhase = usePhaseStore((s) => s.setPhase);
  const doc = useProjectStore((s) => s.doc);
  const setDoc = useProjectStore((s) => s.setDoc);

  const allNodes = flattenNodes(nodes);

  const handleToggleImage = (id: string, checked: boolean) => {
    updateNode(id, { needsImage: checked });
  };

  const handleToggleTable = (id: string, checked: boolean) => {
    updateNode(id, { needsTable: checked });
  };

  const handleConfirm = () => {
    setDoc({
      ...doc,
      framework: nodes,
      currentPhase: WritingPhase.TEXT_GEN,
      updatedAt: new Date().toISOString(),
    });
    setPhase(WritingPhase.TEXT_GEN);
    message.success('板块设置已确认，进入文本生成阶段');
  };

  const imageCount = allNodes.filter(n => n.needsImage).length;
  const tableCount = allNodes.filter(n => n.needsTable).length;

  return (
    <div style={{ padding: '12px 8px' }}>
      <h3 style={{ marginBottom: 8, fontSize: 14 }}>板块设置</h3>
      <p style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
        为每个章节选择是否需要预留图片和表格位置。
        图片: {imageCount} | 表格: {tableCount}
      </p>

      <List
        size="small"
        dataSource={allNodes}
        style={{ maxHeight: 400, overflow: 'auto', marginBottom: 12 }}
        renderItem={(node) => (
          <List.Item
            style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}
          >
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                {node.level === 1 ? '📁' : node.level === 2 ? '📄' : '📎'}{' '}
                {node.title}
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <Checkbox
                  checked={node.needsImage}
                  onChange={(e) => handleToggleImage(node.id, e.target.checked)}
                >
                  <PictureOutlined /> 图片位
                </Checkbox>
                <Checkbox
                  checked={node.needsTable}
                  onChange={(e) => handleToggleTable(node.id, e.target.checked)}
                >
                  <TableOutlined /> 表格位
                </Checkbox>
              </div>
            </div>
          </List.Item>
        )}
      />

      <Button
        type="primary"
        icon={<CheckOutlined />}
        onClick={handleConfirm}
        block
        size="large"
      >
        确认板块，开始文本生成
      </Button>
    </div>
  );
}
