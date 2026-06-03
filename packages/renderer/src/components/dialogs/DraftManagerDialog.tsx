import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, List, Modal, Popconfirm, Space, Tag, message } from 'antd';
import { CopyOutlined, DeleteOutlined, FileTextOutlined, FolderOpenOutlined } from '@ant-design/icons';
import {
  WritingPhase,
  formatDate,
  syncDocumentWithState,
  type DraftMeta,
  type IPCResponse,
  type QiuAiDocument,
} from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { usePhaseStore } from '../../stores/usePhaseStore';
import { useProjectStore } from '../../stores/useProjectStore';

interface DraftManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

const phaseLabels: Record<number, string> = {
  [WritingPhase.FRAMEWORK]: '框架',
  [WritingPhase.SLOTS]: '槽位',
  [WritingPhase.TEXT_GEN]: '文本',
  [WritingPhase.IMAGES]: '图片',
  [WritingPhase.TABLES]: '表格',
  [WritingPhase.DONE]: '完成',
};

const phaseColors: Record<number, string> = {
  [WritingPhase.FRAMEWORK]: 'default',
  [WritingPhase.SLOTS]: 'processing',
  [WritingPhase.TEXT_GEN]: 'blue',
  [WritingPhase.IMAGES]: 'purple',
  [WritingPhase.TABLES]: 'green',
  [WritingPhase.DONE]: 'success',
};

export function DraftManagerDialog({ open, onClose }: DraftManagerDialogProps) {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const setDoc = useProjectStore((state) => state.setDoc);
  const setPhase = usePhaseStore((state) => state.setPhase);
  const setNodes = useFrameworkStore((state) => state.setNodes);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ipcClient.invoke<IPCResponse<DraftMeta[]>>('file:list-drafts');
      if (response.success && response.data) {
        setDrafts(response.data);
      } else {
        setDrafts([]);
      }
    } catch {
      message.error('加载草稿列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  const handleOpen = async (draftId: string) => {
    try {
      const response = await ipcClient.invoke<IPCResponse<QiuAiDocument>>('file:open-draft', draftId);
      if (response.success && response.data) {
        const doc = syncDocumentWithState(response.data);
        setDoc(doc);
        setPhase(doc.currentPhase as WritingPhase);
        setNodes(doc.framework || []);
        message.success(`已打开“${doc.title}”`);
        onClose();
        return;
      }

      message.error(response.error || '打开草稿失败');
    } catch {
      message.error('打开草稿失败');
    }
  };

  const handleDelete = async (draftId: string) => {
    try {
      await ipcClient.invoke('file:delete-draft', draftId);
      message.success('草稿已删除');
      void refresh();
    } catch {
      message.error('删除草稿失败');
    }
  };

  const handleDuplicate = async (draftId: string) => {
    try {
      const response = await ipcClient.invoke<IPCResponse<QiuAiDocument>>('file:open-draft', draftId);
      if (response.success && response.data) {
        const duplicated = syncDocumentWithState({
          ...response.data,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          title: `${response.data.title}（副本）`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await ipcClient.invoke('file:save-draft', duplicated);
        message.success('已创建草稿副本');
        void refresh();
        return;
      }

      message.error(response.error || '复制草稿失败');
    } catch {
      message.error('复制草稿失败');
    }
  };

  return (
    <Modal
      title={
        <span>
          <FolderOpenOutlined /> 打开草稿
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      {drafts.length === 0 ? (
        <Empty description="暂时还没有草稿" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 32 }} />
      ) : (
        <List
          loading={loading}
          dataSource={drafts}
          style={{ maxHeight: 440, overflow: 'auto' }}
          renderItem={(item) => (
            <List.Item
              style={{ padding: '10px 0' }}
              actions={[
                <Button
                  key="open"
                  type="primary"
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={() => void handleOpen(item.id)}
                >
                  打开
                </Button>,
                <Button
                  key="duplicate"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => void handleDuplicate(item.id)}
                />,
                <Popconfirm
                  key="delete"
                  title="确定删除这份草稿吗？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => void handleDelete(item.id)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={6}>
                    <FileTextOutlined />
                    <span style={{ fontSize: 14 }}>{item.title}</span>
                    <Tag color={phaseColors[item.currentPhase] || 'default'}>
                      {phaseLabels[item.currentPhase] || `阶段 ${item.currentPhase}`}
                    </Tag>
                  </Space>
                }
                description={
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                    <span>更新于 {formatDate(item.updatedAt)}</span>
                    <span style={{ margin: '0 8px' }}>|</span>
                    <span>约 {item.wordCount || 0} 字</span>
                    <span style={{ margin: '0 8px' }}>|</span>
                    <span>{item.pageCount || 0} 页</span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}
