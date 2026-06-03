import { useState } from 'react';
import { Button, Card, Modal, Space, message } from 'antd';
import { ExperimentOutlined, FileTextOutlined, FundOutlined, RocketOutlined } from '@ant-design/icons';
import { syncDocumentWithState, type FrameworkNode } from '@qiuai/shared';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { useProjectStore } from '../../stores/useProjectStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

type TemplateItem = {
  name: string;
  icon: React.ReactNode;
  desc: string;
  nodes: FrameworkNode[];
};

const TEMPLATES: Record<string, TemplateItem> = {
  tech: {
    name: '科技项目申报书',
    icon: <RocketOutlined />,
    desc: '适合科技局、产业项目、技术攻关类正式申报文档。',
    nodes: [
      {
        id: '1',
        title: '一、项目概述',
        level: 1,
        order: 1,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [
          {
            id: '1-1',
            title: '（一）项目背景与意义',
            level: 2,
            order: 1,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
          {
            id: '1-2',
            title: '（二）国内外研究现状',
            level: 2,
            order: 2,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
          {
            id: '1-3',
            title: '（三）项目目标与任务',
            level: 2,
            order: 3,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
        ],
      },
      {
        id: '2',
        title: '二、技术方案',
        level: 1,
        order: 2,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [
          {
            id: '2-1',
            title: '（一）技术路线',
            level: 2,
            order: 1,
            needsImage: true,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
          {
            id: '2-2',
            title: '（二）关键技术与创新点',
            level: 2,
            order: 2,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
          {
            id: '2-3',
            title: '（三）技术指标',
            level: 2,
            order: 3,
            needsImage: false,
            needsTable: true,
            dataKeywords: ['指标', '参数'],
            children: [],
          },
        ],
      },
      {
        id: '3',
        title: '三、实施计划与进度',
        level: 1,
        order: 3,
        needsImage: false,
        needsTable: true,
        dataKeywords: [],
        children: [],
      },
      {
        id: '4',
        title: '四、经费预算',
        level: 1,
        order: 4,
        needsImage: false,
        needsTable: true,
        dataKeywords: ['经费', '万元'],
        children: [],
      },
    ],
  },
  nsfc: {
    name: '自然科学基金申请书',
    icon: <ExperimentOutlined />,
    desc: '适合自然科学基金、科研课题、实验研究场景。',
    nodes: [
      {
        id: '1',
        title: '一、立项依据与研究内容',
        level: 1,
        order: 1,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [
          {
            id: '1-1',
            title: '（一）立项依据',
            level: 2,
            order: 1,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
          {
            id: '1-2',
            title: '（二）研究内容、目标与关键问题',
            level: 2,
            order: 2,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
        ],
      },
      {
        id: '2',
        title: '二、研究方案与可行性分析',
        level: 1,
        order: 2,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [
          {
            id: '2-1',
            title: '（一）研究方法与技术路线',
            level: 2,
            order: 1,
            needsImage: true,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
          {
            id: '2-2',
            title: '（二）可行性分析',
            level: 2,
            order: 2,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
        ],
      },
      {
        id: '3',
        title: '三、研究基础与条件',
        level: 1,
        order: 3,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [],
      },
    ],
  },
  social: {
    name: '社科基金申请书',
    icon: <FundOutlined />,
    desc: '适合社科论文、政策研究、课题申报等正式文本。',
    nodes: [
      {
        id: '1',
        title: '一、选题依据',
        level: 1,
        order: 1,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [
          {
            id: '1-1',
            title: '（一）研究现状',
            level: 2,
            order: 1,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
          {
            id: '1-2',
            title: '（二）研究价值与意义',
            level: 2,
            order: 2,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
        ],
      },
      {
        id: '2',
        title: '二、研究内容与思路',
        level: 1,
        order: 2,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [
          {
            id: '2-1',
            title: '（一）研究对象与内容',
            level: 2,
            order: 1,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
          {
            id: '2-2',
            title: '（二）研究方法与框架',
            level: 2,
            order: 2,
            needsImage: true,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
        ],
      },
    ],
  },
  product: {
    name: '产品研发报告',
    icon: <FileTextOutlined />,
    desc: '适合企业产品研发、项目复盘和方案汇报。',
    nodes: [
      {
        id: '1',
        title: '一、项目背景',
        level: 1,
        order: 1,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [
          {
            id: '1-1',
            title: '（一）市场需求分析',
            level: 2,
            order: 1,
            needsImage: false,
            needsTable: true,
            dataKeywords: [],
            children: [],
          },
          {
            id: '1-2',
            title: '（二）技术现状与差距',
            level: 2,
            order: 2,
            needsImage: false,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
        ],
      },
      {
        id: '2',
        title: '二、研发方案',
        level: 1,
        order: 2,
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
        children: [
          {
            id: '2-1',
            title: '（一）产品设计',
            level: 2,
            order: 1,
            needsImage: true,
            needsTable: false,
            dataKeywords: [],
            children: [],
          },
          {
            id: '2-2',
            title: '（二）技术指标',
            level: 2,
            order: 2,
            needsImage: false,
            needsTable: true,
            dataKeywords: ['指标', '参数'],
            children: [],
          },
        ],
      },
    ],
  },
};

function cloneNodes(nodes: FrameworkNode[]): FrameworkNode[] {
  return nodes.map((node) => ({
    ...node,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    children: cloneNodes(node.children),
  }));
}

export function TemplateDialog({ open, onClose }: Props) {
  const [selected, setSelected] = useState('tech');
  const setNodes = useFrameworkStore((state) => state.setNodes);
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);

  const apply = () => {
    const tpl = TEMPLATES[selected];
    const nextNodes = cloneNodes(tpl.nodes);

    setNodes(nextNodes);
    setDoc(
      syncDocumentWithState({
        ...doc,
        framework: nextNodes,
        editorContent: {},
        updatedAt: new Date().toISOString(),
      })
    );

    message.success(`已套用“${tpl.name}”模板`);
    onClose();
  };

  return (
    <Modal title="选择模板" open={open} onCancel={onClose} footer={null} width={500}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {Object.entries(TEMPLATES).map(([key, tpl]) => (
          <Card
            key={key}
            size="small"
            hoverable
            style={{ border: selected === key ? '2px solid #1677ff' : '1px solid #d9d9d9' }}
            onClick={() => setSelected(key)}
          >
            <Space>
              <span style={{ fontSize: 18 }}>{tpl.icon}</span>
              <strong style={{ fontSize: 13 }}>{tpl.name}</strong>
            </Space>
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{tpl.desc}</div>
          </Card>
        ))}
      </div>
      <Button type="primary" block onClick={apply}>
        套用模板
      </Button>
    </Modal>
  );
}
