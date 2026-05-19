import { Progress, List, Tag, Button, Space } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { FrameworkNode } from '@qiuai/shared';

export interface SectionProgress {
  nodeId: string;
  title: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  progress?: number;
  error?: string;
}

interface GenerationProgressProps {
  sections: SectionProgress[];
  onGenerateAll: () => void;
  onGenerateSection: (nodeId: string) => void;
  isGenerating: boolean;
}

function flattenNodes(nodes: FrameworkNode[]): FrameworkNode[] {
  const result: FrameworkNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenNodes(node.children));
  }
  return result;
}

export function buildProgressFromFramework(nodes: FrameworkNode[]): SectionProgress[] {
  return flattenNodes(nodes).map((n) => ({
    nodeId: n.id,
    title: n.title,
    status: 'pending' as const,
  }));
}

export function GenerationProgress({
  sections,
  onGenerateAll,
  onGenerateSection,
  isGenerating,
}: GenerationProgressProps) {
  const total = sections.length;
  const done = sections.filter((s) => s.status === 'done').length;
  const inProgress = sections.filter((s) => s.status === 'generating').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>生成进度</span>
        <span style={{ fontSize: 11, color: '#666' }}>
          {done}/{total} 完成
        </span>
      </div>

      <Progress
        percent={percent}
        status={inProgress > 0 ? 'active' : percent === 100 ? 'success' : 'normal'}
        size="small"
        style={{ marginBottom: 8 }}
      />

      <Button
        type="primary"
        size="small"
        block
        onClick={onGenerateAll}
        loading={isGenerating}
        disabled={isGenerating}
        style={{ marginBottom: 8 }}
      >
        {isGenerating ? '生成中...' : '全部生成'}
      </Button>

      <List
        size="small"
        dataSource={sections}
        style={{ maxHeight: 250, overflow: 'auto' }}
        renderItem={(item) => (
          <List.Item
            style={{ padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}
            actions={[
              item.status === 'pending' && !isGenerating ? (
                <Button
                  key="gen"
                  type="link"
                  size="small"
                  onClick={() => onGenerateSection(item.nodeId)}
                >
                  生成
                </Button>
              ) : null,
            ]}
          >
            <Space size={4}>
              {item.status === 'done' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
              {item.status === 'generating' && <LoadingOutlined style={{ color: '#1677ff' }} />}
              {item.status === 'pending' && <ClockCircleOutlined style={{ color: '#d9d9d9' }} />}
              {item.status === 'error' && <Tag color="red">错误</Tag>}
              <span style={{ fontSize: 12 }}>{item.title}</span>
            </Space>
          </List.Item>
        )}
      />
    </div>
  );
}
