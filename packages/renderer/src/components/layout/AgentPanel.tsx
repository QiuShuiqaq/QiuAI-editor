import { useEffect, useRef, useState } from 'react';
import { Button, Input, Progress, Tag, message } from 'antd';
import {
  CompressOutlined,
  ExpandOutlined,
  RobotOutlined,
  SendOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { PolishRequest } from '@qiuai/shared';
import { chatWithAssistant, polishText as aiPolish } from '../../services/aiClient';
import {
  executeDocumentCommand,
  executeAgentActions,
  getCurrentDocumentText,
  replaceCurrentSelection,
} from '../../services/documentEngineCommands';
import {
  FULL_PAPER_PROGRESS_EVENT,
  type FullPaperGenerationProgress,
} from '../../services/fullPaperGeneration';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

export function AgentPanel({ embedded = false }: { embedded?: boolean }) {
  const editor = useEditorStore((state) => state.editor);
  const selectedText = useEditorStore((state) => state.selectedText);
  const activeSectionTitle = useEditorStore((state) => state.activeSectionTitle);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const doc = useProjectStore((state) => state.doc);
  const getActiveConfig = useSettingsStore((state) => state.getActiveConfig);
  const getWritingConfig = useSettingsStore((state) => state.getWritingConfig);

  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      'assistant',
      '我是 AI 助手。你可以直接和我对话，也可以让我基于当前文档、章节和选中文本直接执行编辑。'
    ),
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [generatingFullPaper, setGeneratingFullPaper] = useState(false);
  const [fullPaperProgress, setFullPaperProgress] = useState<FullPaperGenerationProgress | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const taskSteps = fullPaperProgress
    ? [
        {
          key: 'preparing',
          label: '准备大纲与规范',
          done: fullPaperProgress.stage !== 'preparing',
          active: fullPaperProgress.stage === 'preparing',
        },
        {
          key: 'generating',
          label: '逐节生成正文',
          done: ['section-done', 'applying', 'completed'].includes(fullPaperProgress.stage),
          active: ['section-start', 'typing'].includes(fullPaperProgress.stage),
        },
        {
          key: 'decorating',
          label: '插入图表预留位',
          done: ['applying', 'completed'].includes(fullPaperProgress.stage),
          active: fullPaperProgress.stage === 'section-done',
        },
        {
          key: 'applying',
          label: '写回文档并完成',
          done: fullPaperProgress.stage === 'completed',
          active: fullPaperProgress.stage === 'applying',
        },
      ]
    : [];

  useEffect(() => {
    (window as { __aiPreviewResult?: (text: string) => void }).__aiPreviewResult = (text: string) => {
      setPreviewText(text);
    };

    return () => {
      delete (window as { __aiPreviewResult?: (text: string) => void }).__aiPreviewResult;
    };
  }, []);

  useEffect(() => {
    const handleProgress = (event: Event) => {
      const customEvent = event as CustomEvent<FullPaperGenerationProgress>;
      if (!customEvent.detail) {
        return;
      }
      setFullPaperProgress(customEvent.detail);
    };

    window.addEventListener(FULL_PAPER_PROGRESS_EVENT, handleProgress as EventListener);
    return () => {
      window.removeEventListener(FULL_PAPER_PROGRESS_EVENT, handleProgress as EventListener);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, previewText]);

  const pushMessage = (role: ChatMessage['role'], content: string) => {
    setMessages((prev) => [...prev, createMessage(role, content)]);
  };

  const resolveSelectedText = async () => {
    if (documentEngineAdapter) {
      const selection = await documentEngineAdapter.getSelection();
      return selection.selectedText || '';
    }
    if (!editor) {
      return '';
    }
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) {
      return;
    }

    setInput('');
    pushMessage('user', text);
    setLoading(true);

    try {
      const documentText = await getCurrentDocumentText();
      const response = await chatWithAssistant({
        message: text,
        selectedText: selectedText || '',
        activeSectionTitle: activeSectionTitle || '',
        headingPath: activeSectionTitle ? [activeSectionTitle] : [],
        documentTitle: doc.title,
        documentPlan: doc.documentState.documentPlan || doc.documentPlan || '',
        documentText,
        aiConfig: getActiveConfig(),
      });

      pushMessage('assistant', response.message || '已收到请求。');

      if (response.actions.length > 0) {
        const result = await executeAgentActions(response.actions);
        if (result.appliedCount > 0 && result.failedCount === 0) {
          pushMessage('assistant', `已执行 ${result.appliedCount} 条编辑动作。`);
          message.success(`AI 已执行 ${result.appliedCount} 条编辑动作`);
        } else if (result.appliedCount > 0) {
          pushMessage(
            'assistant',
            `已执行 ${result.appliedCount} 条编辑动作，另有 ${result.failedCount} 条未成功执行。`
          );
          message.warning(`已执行 ${result.appliedCount} 条动作，${result.failedCount} 条失败`);
        } else {
          pushMessage('assistant', '这次我理解了你的意图，但没有成功执行到文档里。');
          message.warning('AI 动作未成功应用到文档');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '这次请求失败了，请稍后再试。';
      pushMessage('assistant', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action: 'polish' | 'concise' | 'expand') => {
    const text = await resolveSelectedText();
    if (!text) {
      message.warning('请先在编辑区选中需要处理的文本。');
      return;
    }

    const styleMap: Record<typeof action, PolishRequest['style']> = {
      polish: 'academic',
      concise: 'concise',
      expand: 'expand',
    };
    const labelMap: Record<typeof action, string> = {
      polish: '润色',
      concise: '精简',
      expand: '扩写',
    };

    pushMessage('user', `${labelMap[action]}当前选中文本：${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
    setLoading(true);

    try {
      const result = await aiPolish({
        originalText: text,
        style: styleMap[action],
        aiConfig: getWritingConfig(),
      });
      setPreviewText(result);
      pushMessage('assistant', `${labelMap[action]}结果已生成，请先预览，再决定是否应用到正文。`);
      message.success(`${labelMap[action]}结果已生成`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '操作失败，请检查模型配置后重试。';
      message.error(errorMessage);
      pushMessage('assistant', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFullPaper = async () => {
    if (!doc.framework.length) {
      message.warning('请先导入文档大纲，再生成整篇论文。');
      return;
    }

    setGeneratingFullPaper(true);
    setFullPaperProgress({
      stage: 'preparing',
      completedSections: 0,
      totalSections: 0,
      percent: 0,
      statusText: '正在准备生成任务',
    });
    pushMessage('user', '请根据当前大纲生成整篇论文初稿。');

    try {
      const applied = await executeDocumentCommand('generate-full-paper');
      if (!applied) {
        throw new Error('未能启动整篇论文生成。');
      }

      pushMessage('assistant', '已根据当前大纲和内置论文规范生成完整论文，并写入编辑区。');
      message.success('整篇论文已生成');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '整篇论文生成失败';
      pushMessage('assistant', errorMessage);
      message.error(errorMessage);
    } finally {
      setGeneratingFullPaper(false);
    }
  };

  const applyPreview = async () => {
    if (!previewText) {
      return;
    }

    try {
      const applied = await replaceCurrentSelection(previewText);
      if (!applied) {
        return;
      }

      pushMessage('assistant', '已将预览结果应用到当前选区。');
      setPreviewText('');
      message.success('已应用到正文');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '应用失败';
      message.error(errorMessage);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: embedded ? 'transparent' : '#fafafa',
        borderLeft: embedded ? 'none' : '1px solid #e0e0e0',
        overflow: 'hidden',
      }}
    >
      {!embedded ? (
        <div
          style={{
            padding: '8px 10px',
            borderBottom: '1px solid #e0e0e0',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <RobotOutlined /> AI 助手
        </div>
      ) : null}

      {fullPaperProgress ? (
        <div
          style={{
            margin: '12px 12px 0',
            padding: 12,
            border: '1px solid #d9e8ff',
            borderRadius: 10,
            background: '#f7fbff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0958d9' }}>任务进度</div>
            <Tag color={fullPaperProgress.stage === 'completed' ? 'success' : 'processing'}>
              {fullPaperProgress.completedSections}/{Math.max(fullPaperProgress.totalSections, 1)} 章节
            </Tag>
          </div>
          <Progress
            percent={fullPaperProgress.percent}
            size="small"
            status={fullPaperProgress.stage === 'completed' ? 'success' : 'active'}
            style={{ marginBottom: 8 }}
          />
          <div style={{ fontSize: 12, color: '#262626', lineHeight: 1.6 }}>
            {fullPaperProgress.statusText}
          </div>
          {fullPaperProgress.title ? (
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              当前章节：{fullPaperProgress.title}
              {fullPaperProgress.totalChunks
                ? ` · 写入 ${fullPaperProgress.typedChunks || 0}/${fullPaperProgress.totalChunks}`
                : ''}
            </div>
          ) : null}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {taskSteps.map((step, index) => (
              <div
                key={step.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: step.active ? '#0958d9' : step.done ? '#389e0d' : '#8c8c8c',
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: step.active ? '#e6f4ff' : step.done ? '#f6ffed' : '#f5f5f5',
                    border: `1px solid ${step.active ? '#91caff' : step.done ? '#b7eb8f' : '#d9d9d9'}`,
                    flexShrink: 0,
                  }}
                >
                  {step.done ? '✓' : index + 1}
                </span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {previewText ? (
        <div
          style={{
            margin: '12px 12px 0',
            padding: 12,
            border: '1px solid #91caff',
            borderRadius: 10,
            background: '#f0f8ff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0958d9' }}>AI 预览结果</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="small" onClick={() => setPreviewText('')}>
                放弃
              </Button>
              <Button size="small" type="primary" onClick={() => void applyPreview()}>
                应用
              </Button>
            </div>
          </div>
          <div
            style={{
              maxHeight: 160,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: 12,
              lineHeight: 1.7,
              color: '#262626',
            }}
          >
            {previewText}
          </div>
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{ display: 'flex', gap: 6, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: msg.role === 'user' ? '#1677ff' : '#52c41a',
                flexShrink: 0,
              }}
            >
              {msg.role === 'user' ? (
                <UserOutlined style={{ color: '#fff', fontSize: 10 }} />
              ) : (
                <RobotOutlined style={{ color: '#fff', fontSize: 10 }} />
              )}
            </div>
            <div
              style={{
                maxWidth: '85%',
                padding: '6px 9px',
                borderRadius: 8,
                background: msg.role === 'user' ? '#e6f4ff' : '#f5f5f5',
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading ? (
          <div style={{ fontSize: 11, color: '#8c8c8c', padding: '2px 8px' }}>
            <RobotOutlined /> AI 正在处理...
          </div>
        ) : null}
        <div ref={chatEndRef} />
      </div>

      <div style={{ padding: '6px 8px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 6 }}>
        <Button
          size="small"
          type="primary"
          icon={<RobotOutlined />}
          onClick={() => void handleGenerateFullPaper()}
          loading={generatingFullPaper}
          disabled={loading}
          style={{ fontSize: 11 }}
        >
          生成全文
        </Button>
        <Button
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={() => void handleQuickAction('polish')}
          disabled={!selectedText}
          style={{ fontSize: 11 }}
        >
          润色
        </Button>
        <Button
          size="small"
          icon={<CompressOutlined />}
          onClick={() => void handleQuickAction('concise')}
          disabled={!selectedText}
          style={{ fontSize: 11 }}
        >
          精简
        </Button>
        <Button
          size="small"
          icon={<ExpandOutlined />}
          onClick={() => void handleQuickAction('expand')}
          disabled={!selectedText}
          style={{ fontSize: 11 }}
        >
          扩写
        </Button>
      </div>

      <div style={{ padding: '6px 8px 8px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 6 }}>
        <Input.TextArea
          size="small"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="输入问题，或直接让我修改当前文档、当前章节、选中文本。"
          rows={2}
          style={{ flex: 1, fontSize: 12 }}
        />
        <Button
          type="primary"
          size="small"
          icon={<SendOutlined />}
          onClick={() => void handleSend()}
          loading={loading}
          style={{ alignSelf: 'flex-end' }}
        />
      </div>
    </div>
  );
}
