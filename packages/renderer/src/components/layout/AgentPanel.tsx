import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, InputNumber, Progress, Tag, message } from 'antd';
import {
  CompressOutlined,
  ExpandOutlined,
  RobotOutlined,
  SendOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { AIChatAction, PolishRequest } from '@qiuai/shared';
import { parseOutlineText, syncDocumentWithState } from '@qiuai/shared';
import { chatWithAssistant, polishText as aiPolish } from '../../services/aiClient';
import {
  executeDocumentCommand,
  executeAgentActionsWithTracking,
  getCurrentDocumentText,
  replaceSelectionWithAgentTracking,
} from '../../services/documentEngineCommands';
import {
  FULL_PAPER_PROGRESS_EVENT,
  type FullPaperGenerationProgress,
} from '../../services/fullPaperGeneration';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface PendingAgentPlan {
  actions: AIChatAction[];
  selectionTextSnapshot: string;
  documentTextSnapshot: string;
  provider: string;
  model: string;
  previewItems: PendingPlanPreviewItem[];
}

interface PendingPlanPreviewItem {
  id: string;
  title: string;
  beforeText?: string;
  afterText?: string;
  detail?: string;
}

interface TextPreviewState {
  originalText: string;
  resultText: string;
  actionType: 'polish' | 'concise' | 'expand';
  provider: string;
  model: string;
}

interface AgentStatusState {
  type: 'info' | 'success' | 'error';
  text: string;
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

function isSelectionBoundAction(action: AIChatAction): boolean {
  return action.type === 'replace-selection' || action.type === 'append-after-selection';
}

function truncatePreviewText(text: string, maxLength = 240): string {
  const normalized = text.trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function buildPendingPlanPreviewItems(
  actions: AIChatAction[],
  selectionTextSnapshot: string,
  documentTextSnapshot: string
): PendingPlanPreviewItem[] {
  return actions.map((action, index) => {
    switch (action.type) {
      case 'replace-selection':
        return {
          id: `${action.type}-${index}`,
          title: `修改 ${index + 1}: 替换当前选区`,
          beforeText: truncatePreviewText(selectionTextSnapshot),
          afterText: truncatePreviewText(action.text),
          detail: action.reason,
        };
      case 'append-after-selection':
        return {
          id: `${action.type}-${index}`,
          title: `修改 ${index + 1}: 在当前选区后追加`,
          beforeText: truncatePreviewText(selectionTextSnapshot),
          afterText: truncatePreviewText(`${selectionTextSnapshot}${action.text}`),
          detail: action.reason,
        };
      case 'insert-text':
        return {
          id: `${action.type}-${index}`,
          title: `修改 ${index + 1}: 插入文本`,
          afterText: truncatePreviewText(action.text),
          detail: action.reason,
        };
      case 'replace-document':
        return {
          id: `${action.type}-${index}`,
          title: `修改 ${index + 1}: 替换整篇正文`,
          beforeText: truncatePreviewText(documentTextSnapshot, 320),
          afterText: truncatePreviewText(action.text, 320),
          detail: action.reason,
        };
      case 'execute-command':
      default:
        return {
          id: `${action.type}-${index}`,
          title: `修改 ${index + 1}: 执行文档命令`,
          detail: `${action.command}${action.reason ? ` - ${action.reason}` : ''}`,
        };
    }
  });
}

function buildDirectGenerationRequirements(requirements: string, targetWordCount: number | null): string {
  const parts: string[] = [];

  if (targetWordCount && targetWordCount > 0) {
    parts.push(`目标字数：约 ${Math.round(targetWordCount)} 字`);
  }

  if (requirements.trim()) {
    parts.push(`补充写作要求：\n${requirements.trim()}`);
  }

  return parts.join('\n\n').trim();
}

function normalizeDraftTitle(rawTitle: string, fallbackTitle: string): string {
  const trimmed = rawTitle.trim();
  if (trimmed) {
    return trimmed;
  }

  const fallback = fallbackTitle.trim();
  if (fallback && fallback !== '未命名文稿') {
    return fallback;
  }

  return '未命名文稿';
}

export function AgentPanel({ embedded = false }: { embedded?: boolean }) {
  const editor = useEditorStore((state) => state.editor);
  const selectedText = useEditorStore((state) => state.selectedText);
  const activeSectionTitle = useEditorStore((state) => state.activeSectionTitle);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const setFrameworkNodes = useFrameworkStore((state) => state.setNodes);
  const getActiveConfig = useSettingsStore((state) => state.getActiveConfig);
  const getWritingConfig = useSettingsStore((state) => state.getWritingConfig);

  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      'assistant',
      '我是 AI 助手。你可以直接和我对话、润色当前选区，也可以把论文题目和大纲直接贴给我，我会按结构生成整篇初稿。'
    ),
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<AgentStatusState | null>(null);
  const [previewState, setPreviewState] = useState<TextPreviewState | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PendingAgentPlan | null>(null);
  const [generatingFullPaper, setGeneratingFullPaper] = useState(false);
  const [fullPaperProgress, setFullPaperProgress] = useState<FullPaperGenerationProgress | null>(null);
  const [directTitle, setDirectTitle] = useState(() =>
    doc.title && doc.title !== '未命名文稿' ? doc.title : ''
  );
  const [directOutline, setDirectOutline] = useState('');
  const [directRequirements, setDirectRequirements] = useState('');
  const [directWordCount, setDirectWordCount] = useState<number | null>(null);
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
    if (!directTitle && doc.title && doc.title !== '未命名文稿') {
      setDirectTitle(doc.title);
    }
  }, [directTitle, doc.title]);

  useEffect(() => {
    (window as { __aiPreviewResult?: (text: string) => void }).__aiPreviewResult = (text: string) => {
      const config = getWritingConfig();
      setPreviewState({
        originalText: '',
        resultText: text,
        actionType: 'polish',
        provider: config.provider,
        model: config.model,
      });
    };

    return () => {
      delete (window as { __aiPreviewResult?: (text: string) => void }).__aiPreviewResult;
    };
  }, [getWritingConfig]);

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
  }, [messages, previewState, pendingPlan]);

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

  const handleQuickAction = async (action: TextPreviewState['actionType']) => {
    const text = await resolveSelectedText();
    if (!text) {
      message.warning('请先在编辑区选中需要处理的文本。');
      return;
    }

    const styleMap: Record<TextPreviewState['actionType'], PolishRequest['style']> = {
      polish: 'academic',
      concise: 'concise',
      expand: 'expand',
    };
    const labelMap: Record<TextPreviewState['actionType'], string> = {
      polish: '润色',
      concise: '精简',
      expand: '扩写',
    };

    pushMessage('user', `${labelMap[action]}当前选中文本：${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
    setStatus({
      type: 'info',
      text: `正在${labelMap[action]}当前选中文本，请稍候...`,
    });
    message.open({
      key: 'agent-quick-action',
      type: 'loading',
      content: `正在${labelMap[action]}当前选中文本...`,
      duration: 0,
    });
    setLoading(true);

    try {
      const config = getWritingConfig();
      const result = await aiPolish({
        originalText: text,
        style: styleMap[action],
        aiConfig: config,
      });
      const applyResult = await replaceSelectionWithAgentTracking({
        text: result,
        expectedSelectionText: text,
        provider: config.provider,
        model: config.model,
        reason: `quick-${action}`,
      });

      if (applyResult.selectionChanged) {
        const warning = '当前选区在 AI 处理过程中发生了变化，为避免替换错位置，请重新选中文本后再试。';
        setStatus({
          type: 'error',
          text: warning,
        });
        message.open({
          key: 'agent-quick-action',
          type: 'warning',
          content: warning,
        });
        pushMessage('assistant', warning);
        return;
      }

      if (!applyResult.applied) {
        throw new Error('AI 已返回结果，但未能写入当前选区');
      }

      setPreviewState(null);
      const successText = `${labelMap[action]}结果已直接替换当前选区。`;
      pushMessage('assistant', successText);
      setStatus({
        type: 'success',
        text: applyResult.saveError ? `${successText} 自动保存失败，请手动保存一次。` : successText,
      });
      message.open({
        key: 'agent-quick-action',
        type: applyResult.saveError ? 'warning' : 'success',
        content: applyResult.saveError ? `${successText} 自动保存失败` : successText,
      });
      if (applyResult.saveError) {
        message.warning(applyResult.saveError);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '操作失败，请检查模型配置后重试。';
      setStatus({
        type: 'error',
        text: `${labelMap[action]}失败：${errorMessage}`,
      });
      message.open({
        key: 'agent-quick-action',
        type: 'error',
        content: `${labelMap[action]}失败：${errorMessage}`,
      });
      message.error(errorMessage);
      pushMessage('assistant', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSafeSend = async () => {
    const text = input.trim();
    if (!text) {
      return;
    }

    const selectionSnapshot = await resolveSelectedText();
    setInput('');
    pushMessage('user', text);
    setStatus({
      type: 'info',
      text: '正在分析你的请求并生成处理方案...',
    });
    setLoading(true);

    try {
      const documentText = await getCurrentDocumentText();
      const config = getActiveConfig();
      const response = await chatWithAssistant({
        message: text,
        selectedText: selectionSnapshot,
        activeSectionTitle: activeSectionTitle || '',
        headingPath: activeSectionTitle ? [activeSectionTitle] : [],
        documentTitle: doc.title,
        documentPlan: doc.documentState.documentPlan || doc.documentPlan || '',
        documentText,
        aiConfig: config,
      });

      pushMessage('assistant', response.message || '已收到你的请求。');
      setStatus({
        type: 'success',
        text: response.actions.length > 0 ? 'AI 已生成待确认修改。' : 'AI 已返回答复。',
      });

      if (response.actions.length > 0) {
        setPendingPlan({
          actions: response.actions,
          selectionTextSnapshot: selectionSnapshot,
          documentTextSnapshot: documentText,
          provider: config.provider,
          model: config.model,
          previewItems: buildPendingPlanPreviewItems(response.actions, selectionSnapshot, documentText),
        });
        pushMessage('assistant', `我整理了 ${response.actions.length} 个待执行修改，请确认后再应用到文稿。`);
        message.info('AI 修改已进入待确认列表');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '这次请求失败了，请稍后再试。';
      setStatus({
        type: 'error',
        text: errorMessage,
      });
      pushMessage('assistant', errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const startFullPaperGeneration = async (userMessage: string, successMessage: string) => {
    setGeneratingFullPaper(true);
    setFullPaperProgress({
      stage: 'preparing',
      completedSections: 0,
      totalSections: 0,
      percent: 0,
      statusText: '正在准备生成任务',
    });
    pushMessage('user', userMessage);

    try {
      const applied = await executeDocumentCommand('generate-full-paper');
      if (!applied) {
        throw new Error('未能启动整篇论文生成。');
      }

      pushMessage('assistant', successMessage);
      message.success('整篇论文已生成');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '整篇论文生成失败';
      pushMessage('assistant', errorMessage);
      message.error(errorMessage);
    } finally {
      setGeneratingFullPaper(false);
    }
  };

  const handleGenerateFullPaper = async () => {
    if (!doc.framework.length) {
      if (directOutline.trim()) {
        await handleDirectGenerateFullPaper();
        return;
      }
      message.warning('请先粘贴论文大纲，或使用当前文档结构后再生成整篇论文。');
      return;
    }

    await startFullPaperGeneration(
      '请根据当前文档结构生成整篇论文初稿。',
      '已根据当前文档结构和内置论文规范生成完整论文，并写入编辑区。'
    );
  };

  const handleDirectGenerateFullPaper = async () => {
    const outlineText = directOutline.trim();
    const framework = outlineText ? parseOutlineText(outlineText) : doc.framework;

    if (framework.length === 0) {
      message.warning('请先粘贴可识别的大纲，或先在文档中建立章节结构。');
      return;
    }

    const title = normalizeDraftTitle(directTitle, doc.title);
    const extraRequirements = buildDirectGenerationRequirements(directRequirements, directWordCount);

    const nextDoc = syncDocumentWithState({
      ...doc,
      title,
      framework,
      documentPlan: extraRequirements,
      updatedAt: new Date().toISOString(),
      documentState: {
        ...doc.documentState,
        outline: framework,
        documentPlan: extraRequirements,
      },
    });

    setDoc(nextDoc);
    setFrameworkNodes(framework);

    const promptParts = [`题目：${title}`];
    if (outlineText) {
      promptParts.push(`大纲：\n${outlineText}`);
    } else {
      promptParts.push('使用当前文档结构生成全文。');
    }
    if (extraRequirements) {
      promptParts.push(`补充要求：\n${extraRequirements}`);
    }

    await startFullPaperGeneration(
      `请根据以下信息直接生成整篇论文初稿：\n\n${promptParts.join('\n\n')}`,
      '已根据你提供的题目、大纲和补充要求生成整篇论文，并写入编辑区。'
    );
  };

  const applyPreview = async () => {
    if (!previewState) {
      return;
    }

    try {
      const result = await executeAgentActionsWithTracking(
        [
          {
            type: 'replace-selection',
            text: previewState.resultText,
            reason: `quick-${previewState.actionType}`,
          },
        ],
        {
          provider: previewState.provider,
          model: previewState.model,
        }
      );

      if (result.appliedCount <= 0) {
        return;
      }

      pushMessage('assistant', '已将预览结果应用到当前选区。');
      setStatus({
        type: 'success',
        text: '预览结果已应用到正文。',
      });
      setPreviewState(null);
      message.success('已应用到正文');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '应用失败';
      setStatus({
        type: 'error',
        text: errorMessage,
      });
      message.error(errorMessage);
    }
  };

  const applyPendingPlan = async () => {
    if (!pendingPlan) {
      return;
    }

    const requiresSelection = pendingPlan.actions.some(isSelectionBoundAction);
    if (requiresSelection) {
      const currentSelection = await resolveSelectedText();
      if (currentSelection !== pendingPlan.selectionTextSnapshot) {
        const warning =
          pendingPlan.selectionTextSnapshot.trim().length > 0
            ? '当前选区已经变化。为避免改错位置，请重新选中原文后再应用这组修改。'
            : '这组修改依赖当前选区，但现在没有匹配的选中文本，请重新选择目标内容。';
        pushMessage('assistant', warning);
        setStatus({
          type: 'error',
          text: warning,
        });
        message.warning('当前选区已变化，请重新选择目标内容');
        return;
      }
    }

    setLoading(true);
    try {
      const result = await executeAgentActionsWithTracking(pendingPlan.actions, {
        provider: pendingPlan.provider,
        model: pendingPlan.model,
      });

      if (result.appliedCount > 0 && result.failedCount === 0) {
        pushMessage('assistant', `已应用 ${result.appliedCount} 个修改动作。`);
        setStatus({
          type: 'success',
          text: `已成功应用 ${result.appliedCount} 个修改动作。`,
        });
        message.success(`已应用 ${result.appliedCount} 个修改动作`);
        setPendingPlan(null);
      } else if (result.appliedCount > 0) {
        pushMessage(
          'assistant',
          `已应用 ${result.appliedCount} 个修改动作，另有 ${result.failedCount} 个执行失败。`
        );
        setStatus({
          type: 'error',
          text: `已应用 ${result.appliedCount} 个动作，但还有 ${result.failedCount} 个失败。`,
        });
        message.warning(`已应用 ${result.appliedCount} 个动作，${result.failedCount} 个失败`);
        setPendingPlan(null);
      } else {
        pushMessage('assistant', '这组待确认修改没有成功应用到文稿。');
        setStatus({
          type: 'error',
          text: '待确认修改未能成功应用到文稿。',
        });
        message.warning('待确认修改未能应用');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '应用待确认修改失败';
      setStatus({
        type: 'error',
        text: errorMessage,
      });
      pushMessage('assistant', errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const discardPendingPlan = () => {
    if (!pendingPlan) {
      return;
    }

    setPendingPlan(null);
    setStatus({
      type: 'info',
      text: '已取消这组待确认修改。',
    });
    pushMessage('assistant', '已取消这组待确认修改。');
    message.info('已取消待确认修改');
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

      <div
        style={{
          margin: '12px 12px 0',
          padding: 12,
          border: '1px solid #d9d9d9',
          borderRadius: 10,
          background: '#ffffff',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1f1f1f', marginBottom: 6 }}>直接贴大纲生成全文</div>
        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6, marginBottom: 10 }}>
          不想先导入大纲时，可以直接在这里填题目、粘贴目录和写作要求，AI 会先写入结构，再生成整篇论文初稿。
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input
            size="small"
            value={directTitle}
            onChange={(event) => setDirectTitle(event.target.value)}
            placeholder="论文题目，例如：基于大模型的论文写作助手设计"
          />
          <Input.TextArea
            size="small"
            value={directOutline}
            onChange={(event) => setDirectOutline(event.target.value)}
            placeholder={'粘贴章节大纲，例如：\n一、绪论\n（一）研究背景\n（二）研究意义\n二、系统设计'}
            rows={5}
          />
          <Input.TextArea
            size="small"
            value={directRequirements}
            onChange={(event) => setDirectRequirements(event.target.value)}
            placeholder="补充写作要求，例如：学术风格、突出方法创新、每章尽量自然过渡"
            rows={3}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <InputNumber
              size="small"
              style={{ flex: 1 }}
              min={500}
              max={50000}
              step={500}
              value={directWordCount}
              onChange={(value) => setDirectWordCount(typeof value === 'number' ? value : null)}
              placeholder="目标字数"
            />
            <Button
              size="small"
              type="primary"
              icon={<RobotOutlined />}
              onClick={() => void handleDirectGenerateFullPaper()}
              loading={generatingFullPaper}
              disabled={loading}
            >
              按大纲生成
            </Button>
          </div>
        </div>
      </div>

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
          <div style={{ fontSize: 12, color: '#262626', lineHeight: 1.6 }}>{fullPaperProgress.statusText}</div>
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

      {status ? (
        <div style={{ margin: '12px 12px 0' }}>
          <Alert
            type={status.type}
            showIcon
            message={status.text}
            closable
            onClose={() => setStatus(null)}
          />
        </div>
      ) : null}

      {previewState ? (
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
              <Button size="small" onClick={() => setPreviewState(null)}>
                放弃
              </Button>
              <Button size="small" type="primary" onClick={() => void applyPreview()}>
                应用
              </Button>
            </div>
          </div>
          <div
            style={{
              maxHeight: 220,
              overflow: 'auto',
              fontSize: 12,
              lineHeight: 1.7,
              color: '#262626',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {previewState.originalText ? (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#595959', marginBottom: 4 }}>原文</div>
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    background: '#fff',
                    border: '1px solid #d9e8ff',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}
                >
                  {previewState.originalText}
                </div>
              </div>
            ) : null}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0958d9', marginBottom: 4 }}>修改后</div>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  background: '#fff',
                  border: '1px solid #91caff',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              >
                {previewState.resultText}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pendingPlan ? (
        <div
          style={{
            margin: '12px 12px 0',
            padding: 12,
            border: '1px solid #ffe58f',
            borderRadius: 10,
            background: '#fffbe6',
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
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ad6800' }}>待确认修改</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="small" onClick={discardPendingPlan}>
                取消
              </Button>
              <Button size="small" type="primary" onClick={() => void applyPendingPlan()} loading={loading}>
                应用
              </Button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflow: 'auto' }}>
            {pendingPlan.previewItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: '#fff',
                  border: '1px solid #f5d27a',
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: '#262626',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: item.beforeText || item.afterText ? 8 : 0 }}>
                  {item.title}
                </div>
                {item.detail ? (
                  <div style={{ marginBottom: item.beforeText || item.afterText ? 8 : 0 }}>{item.detail}</div>
                ) : null}
                {item.beforeText ? (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#595959', marginBottom: 4 }}>当前内容</div>
                    <div style={{ background: '#fff7e6', borderRadius: 6, padding: '6px 8px' }}>{item.beforeText}</div>
                  </div>
                ) : null}
                {item.afterText ? (
                  <div>
                    <div style={{ fontSize: 11, color: '#ad6800', marginBottom: 4 }}>应用后</div>
                    <div
                      style={{
                        background: '#fff',
                        borderRadius: 6,
                        padding: '6px 8px',
                        border: '1px solid #f5d27a',
                      }}
                    >
                      {item.afterText}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
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
            <RobotOutlined /> {status?.type === 'info' ? status.text : 'AI 正在处理...'}
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
          当前结构生成
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
              void handleSafeSend();
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
          onClick={() => void handleSafeSend()}
          loading={loading}
          style={{ alignSelf: 'flex-end' }}
        />
      </div>
    </div>
  );
}
