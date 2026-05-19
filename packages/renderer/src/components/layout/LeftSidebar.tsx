import { Tabs } from 'antd';
import {
  EditOutlined,
  PictureOutlined,
  TableOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { TextPolishPanel } from '../sidebar/TextPolishPanel';
import { ImagePolishPanel } from '../sidebar/ImagePolishPanel';
import { TablePolishPanel } from '../sidebar/TablePolishPanel';
import { FrameworkBuilder } from '../phases/Phase1Framework/FrameworkBuilder';
import { SlotAssignmentPanel } from '../phases/Phase2Slots/SlotAssignmentPanel';
import { useSidebarStore } from '../../stores/useSidebarStore';
import { usePhaseStore } from '../../stores/usePhaseStore';
import { WritingPhase } from '@qiuai/shared';

export function LeftSidebar() {
  const activeTab = useSidebarStore((s) => s.activeTab);
  const setActiveTab = useSidebarStore((s) => s.setActiveTab);
  const phase = usePhaseStore((s) => s.currentPhase);

  // In Phase 1 & 2, show framework/slot tools instead of polish tools
  if (phase === WritingPhase.FRAMEWORK) {
    return (
      <Tabs
        centered
        size="small"
        items={[
          {
            key: 'framework',
            label: <span><ApartmentOutlined /> 定框架</span>,
            children: <FrameworkBuilder />,
          },
          {
            key: 'text',
            label: <span><EditOutlined /> 文本润色</span>,
            children: <TextPolishPanel />,
          },
        ]}
      />
    );
  }

  if (phase === WritingPhase.SLOTS) {
    return (
      <Tabs
        centered
        size="small"
        items={[
          {
            key: 'slots',
            label: <span><AppstoreOutlined /> 定板块</span>,
            children: <SlotAssignmentPanel />,
          },
          {
            key: 'text',
            label: <span><EditOutlined /> 文本润色</span>,
            children: <TextPolishPanel />,
          },
        ]}
      />
    );
  }

  // Phase 3+: Full polish tools
  return (
    <Tabs
      activeKey={activeTab}
      onChange={(key) => setActiveTab(key as 'text' | 'image' | 'table')}
      centered
      size="small"
      items={[
        {
          key: 'text',
          label: (
            <span>
              <EditOutlined /> 文本润色
            </span>
          ),
          children: <TextPolishPanel />,
        },
        {
          key: 'image',
          label: (
            <span>
              <PictureOutlined /> 图片润色
            </span>
          ),
          children: <ImagePolishPanel />,
        },
        {
          key: 'table',
          label: (
            <span>
              <TableOutlined /> 表格润色
            </span>
          ),
          children: <TablePolishPanel />,
        },
      ]}
    />
  );
}
