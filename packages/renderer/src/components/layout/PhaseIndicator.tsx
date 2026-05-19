import { Steps } from 'antd';
import { usePhaseStore } from '../../stores/usePhaseStore';
import { WritingPhase } from '@qiuai/shared';

export function PhaseIndicator() {
  const currentPhase = usePhaseStore((s) => s.currentPhase);
  const setPhase = usePhaseStore((s) => s.setPhase);

  return (
    <div style={{ padding: '8px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
      <Steps
        size="small"
        current={currentPhase - 1}
        onChange={(step) => setPhase((step + 1) as WritingPhase)}
        items={[
          { title: '定框架', description: '大纲结构' },
          { title: '定板块', description: '图片/表格预留' },
          { title: '文本生成', description: 'AI撰写' },
          { title: '图片处理', description: '导入/生成' },
          { title: '表格处理', description: '数据填充' },
        ]}
      />
    </div>
  );
}
