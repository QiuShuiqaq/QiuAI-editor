import { useState, useEffect, useCallback } from 'react';
import { Modal, List, Button, message, Space, Tag, Popconfirm, Empty } from 'antd';
import {
  FolderOpenOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { IPC_CHANNELS, type IPCResponse, type DraftMeta, type QiuAiDocument, WritingPhase } from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import { useProjectStore } from '../../stores/useProjectStore';
import { usePhaseStore } from '../../stores/usePhaseStore';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { formatDate } from '@qiuai/shared';

interface DraftManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

const phaseLabels: Record<number, string> = {
  [WritingPhase.FRAMEWORK]: '框架',
  [WritingPhase.SLOTS]: '板块',
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
  const setDoc = useProjectStore((s) => s.setDoc);
  const setPhase = usePhaseStore((s) => s.setPhase);
  const setNodes = useFrameworkStore((s) => s.setNodes);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ipcClient.invoke<IPCResponse<DraftMeta[]>>(
        IPC_CHANNELS.FILE_LIST_DRAFTS
      );
      if (response.success && response.data) {
        setDrafts(response.data);
      }
    } catch {
      message.error('加载草稿列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleOpen = async (draftId: string) => {
    try {
      const response = await ipcClient.invoke<IPCResponse<QiuAiDocument>>(
        IPC_CHANNELS.FILE_OPEN_DRAFT,
        draftId
      );
      if (response.success && response.data) {
        const doc = response.data;
        setDoc(doc);
        setPhase(doc.currentPhase as WritingPhase);
        setNodes(doc.framework || []);
        message.success(`已打开"${doc.title}"`);
        onClose();
      } else {
        message.error(response.error || '打开失败');
      }
    } catch {
      message.error('打开草稿失败');
    }
  };

  const handleDelete = async (draftId: string) => {
    try {
      await ipcClient.invoke(IPC_CHANNELS.FILE_DELETE_DRAFT, draftId);
      message.success('草稿已删除');
      refresh();
    } catch {
      message.error('删除失败');
    }
  };

  const handleDuplicate = async (draftId: string) => {
    try {
      const response = await ipcClient.invoke<IPCResponse<QiuAiDocument>>(
        IPC_CHANNELS.FILE_OPEN_DRAFT,
        draftId
      );
      if (response.success && response.data) {
        const newDoc = {
          ...response.data,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          title: `${response.data.title} (副本)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await ipcClient.invoke(IPC_CHANNELS.FILE_SAVE_DRAFT, newDoc);
        message.success('副本已创建');
        refresh();
      }
    } catch {
      message.error('复制失败');
    }
  };

  return (
    <Modal
      title={
        <span>
          <FolderOpenOutlined /> 草稿箱
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
    >
      {drafts.length === 0 ? (
        <Empty
          description="暂无草稿"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: 32 }}
        />
      ) : (
        <List
          loading={loading}
          dataSource={drafts}
          style={{ maxHeight: 400, overflow: 'auto' }}
          renderItem={(item) => (
            <List.Item
              style={{ padding: '8px 0' }}
              actions={[
                <Button
                  key="open"
                  type="primary"
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={() => handleOpen(item.id)}
                >
                  打开
                </Button>,
                <Button
                  key="dup"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleDuplicate(item.id)}
                />,
                <Popconfirm
                  key="del"
                  title="确定删除此草稿？"
                  onConfirm={() => handleDelete(item.id)}
                >
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={4}>
                    <FileTextOutlined />
                    <span style={{ fontSize: 13 }}>{item.title}</span>
                    <Tag color={phaseColors[item.currentPhase] || 'default'}>
                      {phaseLabels[item.currentPhase] || `阶段${item.currentPhase}`}
                    </Tag>
                  </Space>
                }
                description={
                  <div style={{ fontSize: 11, color: '#999' }}>
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
