import { Button, Checkbox, List, message } from 'antd';
import { CheckOutlined, PictureOutlined, TableOutlined } from '@ant-design/icons';
import { WritingPhase, type FrameworkNode } from '@qiuai/shared';
import { useFrameworkStore } from '../../../stores/useFrameworkStore';
import { usePhaseStore } from '../../../stores/usePhaseStore';
import { useProjectStore } from '../../../stores/useProjectStore';

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
  const setPhase = usePhaseStore((state) => state.setPhase);
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);

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
    message.success('槽位设置已确认，进入文本生成阶段');
  };

  const imageCount = allNodes.filter((node) => node.needsImage).length;
  const tableCount = allNodes.filter((node) => node.needsTable).length;

  return (
    <div style={{ padding: '12px 8px' }}>
      <h3 style={{ marginBottom: 8, fontSize: 14 }}>槽位设置</h3>
      <p style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
        为每个章节选择是否需要预留图片和表格位置。图片: {imageCount} | 表格: {tableCount}
      </p>

      <List
        size="small"
        dataSource={allNodes}
        style={{ maxHeight: 400, overflow: 'auto', marginBottom: 12 }}
        renderItem={(node) => (
          <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                {node.level === 1 ? 'H1' : node.level === 2 ? 'H2' : 'H3'} {node.title}
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <Checkbox
                  checked={node.needsImage}
                  onChange={(event) => handleToggleImage(node.id, event.target.checked)}
                >
                  <PictureOutlined /> 图片位
                </Checkbox>
                <Checkbox
                  checked={node.needsTable}
                  onChange={(event) => handleToggleTable(node.id, event.target.checked)}
                >
                  <TableOutlined /> 表格位
                </Checkbox>
              </div>
            </div>
          </List.Item>
        )}
      />

      <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirm} block size="large">
        确认槽位，开始文本生成
      </Button>
    </div>
  );
}
