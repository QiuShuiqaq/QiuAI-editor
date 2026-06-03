import { useMemo, useState, type ReactNode } from 'react';
import { Button, Empty, Input, List, Select, Space, Switch, Tag, message } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { generateId, type ReviewIssue } from '@qiuai/shared';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { DISPLAY_TASK_PANE_LABELS } from '../../utils/displayText';
import { supportsRevisionTracking } from '../../utils/documentEngineCapabilities';
import { DataReviewOverlay } from '../editor/DataReviewOverlay';
import {
  extractRevisionItems,
  getRevisionPreviewText,
  getRevisionRangeById,
  summarizeRevisionCounts,
} from '../editor/revisionUtils';
import { AgentPanel } from './AgentPanel';
import { ReferencesPanePanel } from './ReferencesPanePanel';
import { PropertiesPanel, WritingStrategyPanel } from './RightPanel';

export type TaskPaneTab = 'properties' | 'strategy' | 'assistant' | 'review' | 'references';

const TAB_LABELS: Record<TaskPaneTab, string> = DISPLAY_TASK_PANE_LABELS;

const REVIEW_SEVERITY_OPTIONS: Array<{ value: ReviewIssue['severity']; label: string }> = [
  { value: 'warning', label: '提醒' },
  { value: 'error', label: '重要' },
  { value: 'info', label: '一般' },
];

function SectionBlock({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        margin: 16,
        marginBottom: 0,
        padding: 12,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1f1f1f' }}>{title}</div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        minWidth: 88,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid #dbeafe',
        background: '#f8fbff',
      }}
    >
      <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0958d9' }}>{value}</div>
    </div>
  );
}

function ReviewPane() {
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const editor = useEditorStore((state) => state.editor);
  const activeSectionId = useEditorStore((state) => state.activeSectionId);
  const activeSectionTitle = useEditorStore((state) => state.activeSectionTitle);
  const revisionRefreshKey = useEditorStore((state) => state.revisionRefreshKey);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const [issueMessage, setIssueMessage] = useState('');
  const [issueSeverity, setIssueSeverity] = useState<ReviewIssue['severity']>('warning');

  const reviewIssues = doc.documentState.reviewIssues;
  const factsNeedReview = doc.documentState.facts.filter((item) => item.status === 'needs-review').length;
  const revisionTrackingEnabled = supportsRevisionTracking(documentEngineAdapter) || Boolean(editor);
  const revisionItems = useMemo(
    () => extractRevisionItems((editor?.getJSON() ?? {}) as Record<string, unknown>),
    [editor, revisionRefreshKey]
  );
  const revisionSummary = useMemo(() => summarizeRevisionCounts(revisionItems), [revisionItems]);

  const updateReviewIssues = (nextIssues: ReviewIssue[]) => {
    setDoc({
      ...doc,
      updatedAt: new Date().toISOString(),
      documentState: {
        ...doc.documentState,
        reviewIssues: nextIssues,
      },
    });
  };

  const addReviewIssue = () => {
    const nextMessage = issueMessage.trim();
    if (!nextMessage) {
      message.warning('请先输入审阅问题。');
      return;
    }

    updateReviewIssues([
      {
        id: generateId(),
        message: nextMessage,
        severity: issueSeverity,
        sectionId: activeSectionId || undefined,
      },
      ...reviewIssues,
    ]);
    setIssueMessage('');
    message.success('已加入审阅问题。');
  };

  const removeReviewIssue = (id: string) => {
    updateReviewIssues(reviewIssues.filter((item) => item.id !== id));
  };

  const setTrackRevisions = (checked: boolean) => {
    setDoc({
      ...doc,
      updatedAt: new Date().toISOString(),
      documentState: {
        ...doc.documentState,
        trackRevisions: checked,
      },
    });
    message.success(checked ? '已开启修订模式。' : '已关闭修订模式。');
  };

  const focusRevision = (revisionId: string) => {
    if (!editor) return;
    const range = getRevisionRangeById(editor.state.doc, revisionId);
    if (!range) {
      message.warning('没有定位到这条修订。');
      return;
    }
    editor.chain().focus().setTextSelection(range.from).run();
  };

  const acceptRevision = (revisionId: string) => {
    if (!editor) return;
    focusRevision(revisionId);
    const accepted = editor.chain().focus().acceptRevisionAtSelection().run();
    if (!accepted) {
      message.warning('未能接受这条修订。');
      return;
    }
    message.success('已接受修订。');
  };

  const rejectRevision = (revisionId: string) => {
    if (!editor) return;
    focusRevision(revisionId);
    const rejected = editor.chain().focus().rejectRevisionAtSelection().run();
    if (!rejected) {
      message.warning('未能拒绝这条修订。');
      return;
    }
    message.success('已拒绝修订。');
  };

  const acceptAll = () => {
    if (!editor) return;
    const accepted = editor.chain().focus().acceptAllRevisions().run();
    if (!accepted) {
      message.info('当前没有可处理的修订。');
      return;
    }
    message.success('已接受全部修订。');
  };

  const rejectAll = () => {
    if (!editor) return;
    const rejected = editor.chain().focus().rejectAllRevisions().run();
    if (!rejected) {
      message.info('当前没有可处理的修订。');
      return;
    }
    message.success('已拒绝全部修订。');
  };

  const severityColorMap: Record<ReviewIssue['severity'], string> = {
    info: 'default',
    warning: 'gold',
    error: 'red',
  };

  const severityLabelMap: Record<ReviewIssue['severity'], string> = {
    info: '一般',
    warning: '提醒',
    error: '重要',
  };

  return (
    <div style={{ paddingBottom: 16 }}>
      <SectionBlock title="审阅总览">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SummaryPill label="审阅问题" value={reviewIssues.length} />
          <SummaryPill label="待核查事实" value={factsNeedReview} />
          <SummaryPill label="修订" value={revisionItems.length} />
          <SummaryPill label="当前章节" value={activeSectionTitle || '未定位'} />
        </div>
      </SectionBlock>

      <SectionBlock
        title="修订模式"
        extra={
          <Switch
            size="small"
            checked={doc.documentState.trackRevisions}
            onChange={setTrackRevisions}
            checkedChildren="开"
            unCheckedChildren="关"
          />
        }
      >
        {!revisionTrackingEnabled ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="当前文档可继续记录审阅问题和数据核查项；修订记录会在支持的编辑区域中显示。"
          />
        ) : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <SummaryPill label="新增" value={revisionSummary.inserts} />
          <SummaryPill label="删除" value={revisionSummary.deletes} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <Button size="small" disabled={!revisionTrackingEnabled} onClick={acceptAll}>
            全部接受
          </Button>
          <Button size="small" disabled={!revisionTrackingEnabled} danger onClick={rejectAll}>
            全部拒绝
          </Button>
        </div>
        <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.7 }}>
          开启后，新增内容会以修订方式显示，删除操作也会先转成修订记录。只有接受或拒绝后，正文才会正式定稿。
        </div>
      </SectionBlock>

      <SectionBlock title="修订列表">
        {!revisionTrackingEnabled ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前页面暂不显示修订列表，请继续使用审阅问题和数据核查。" />
        ) : revisionItems.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有待处理修订。" />
        ) : (
          <List
            dataSource={revisionItems}
            renderItem={(item) => (
              <List.Item
                style={{ padding: '10px 0' }}
                actions={[
                  <Button key="focus" size="small" type="text" onClick={() => focusRevision(item.id)}>
                    定位
                  </Button>,
                  <Button
                    key="accept"
                    size="small"
                    type="text"
                    icon={<CheckOutlined />}
                    onClick={() => acceptRevision(item.id)}
                  >
                    接受
                  </Button>,
                  <Button
                    key="reject"
                    size="small"
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => rejectRevision(item.id)}
                  >
                    拒绝
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={6} wrap>
                      <Tag color={item.kind === 'insert' ? 'green' : 'red'}>
                        {item.kind === 'insert' ? '插入' : '删除'}
                      </Tag>
                      <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : '刚刚'}
                      </span>
                    </Space>
                  }
                  description={<span style={{ fontSize: 12, color: '#262626' }}>{getRevisionPreviewText(item)}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </SectionBlock>

      <SectionBlock title="数据待核查" extra={<DataReviewOverlay />}>
        <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.7 }}>
          这里集中处理 AI 生成内容中的数据核查项、修订提醒和章节级审阅问题。
        </div>
      </SectionBlock>

      <SectionBlock title="新增审阅问题">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input.TextArea
            value={issueMessage}
            onChange={(event) => setIssueMessage(event.target.value)}
            placeholder="例如：这一节缺少实验数据来源，或术语表述与前文不一致。"
            rows={3}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Select
              style={{ width: 120 }}
              value={issueSeverity}
              onChange={(value) => setIssueSeverity(value)}
              options={REVIEW_SEVERITY_OPTIONS}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={addReviewIssue}>
              添加问题
            </Button>
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            {activeSectionTitle ? `将绑定到当前章节：${activeSectionTitle}` : '当前没有章节定位，将作为全文问题保存。'}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="审阅问题列表">
        {reviewIssues.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有审阅问题。" />
        ) : (
          <List
            dataSource={reviewIssues}
            renderItem={(item) => (
              <List.Item
                style={{ padding: '10px 0' }}
                actions={[
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeReviewIssue(item.id)}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={6} wrap>
                      <Tag color={severityColorMap[item.severity]}>{severityLabelMap[item.severity]}</Tag>
                      <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {item.sectionId ? '章节问题' : '全文问题'}
                      </span>
                    </Space>
                  }
                  description={<span style={{ fontSize: 12, color: '#262626' }}>{item.message}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </SectionBlock>
    </div>
  );
}

export function TaskPane({
  open,
  activeTab,
  onClose,
  onChangeTab,
}: {
  open: boolean;
  activeTab: TaskPaneTab;
  onClose: () => void;
  onChangeTab: (tab: TaskPaneTab) => void;
}) {
  if (!open) {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'properties':
        return <PropertiesPanel />;
      case 'strategy':
        return <WritingStrategyPanel />;
      case 'assistant':
        return <AgentPanel embedded />;
      case 'review':
        return <ReviewPane />;
      case 'references':
        return <ReferencesPanePanel />;
      default:
        return null;
    }
  };

  return (
    <aside
      style={{
        width: 320,
        minWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #d7deea',
        background: 'linear-gradient(180deg, #fbfdff 0%, #f4f7fb 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 12px',
          borderBottom: '1px solid #dbe3ef',
          background: 'rgba(255,255,255,0.94)',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1f1f1f' }}>{TAB_LABELS[activeTab]}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            当前任务窗格服务于正文编辑，不会打断主写作流程。
          </div>
        </div>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 8px 0',
          borderBottom: '1px solid #e7edf5',
          background: 'rgba(255,255,255,0.92)',
          overflowX: 'auto',
        }}
      >
        {(Object.keys(TAB_LABELS) as TaskPaneTab[]).map((tab) => {
          const active = tab === activeTab;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChangeTab(tab)}
              style={{
                border: '1px solid transparent',
                borderBottom: active ? '2px solid #1677ff' : '2px solid transparent',
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                background: active ? '#f5f9ff' : 'transparent',
                color: active ? '#0958d9' : '#4b5563',
                padding: '8px 10px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                whiteSpace: 'nowrap',
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: 8 }}>{renderContent()}</div>
    </aside>
  );
}
