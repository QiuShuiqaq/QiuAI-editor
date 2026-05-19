/** AgentPanel — AI chat + quick polish/replace actions */
import { useState, useRef, useEffect } from 'react';
import { Input, Button, message } from 'antd';
import { RobotOutlined, SendOutlined, UserOutlined, ThunderboltOutlined, CompressOutlined, ExpandOutlined } from '@ant-design/icons';
import { useEditorStore } from '../../stores/useEditorStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { streamGenerateText, polishText as aiPolish } from '../../services/aiClient';
import type { PolishRequest } from '@qiuai/shared';

interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; timestamp: number; }

export function AgentPanel() {
  const editor = useEditorStore((s) => s.editor);
  const selectedText = useEditorStore((s) => s.selectedText);
  const getActiveConfig = useSettingsStore((s) => s.getActiveConfig);

  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '1', role: 'assistant',
    content: '你好！我是Agent写作助手。选中文本后可以点下方按钮润色/精简/扩展。也可以在输入框和我对话。',
    timestamp: Date.now(),
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const addMsg = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, { id: String(Date.now()), role, content, timestamp: Date.now() }]);
  };

  // Chat handler
  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addMsg('user', text);
    setLoading(true);
    try {
      const cfg = getActiveConfig();
      let resp = '';
      const gen = streamGenerateText({ sectionId: 'agent', sectionTitle: text, headingPath: [], referenceChunks: [], neighborSummaries: [], documentPlan: '', dataKeywords: [], aiConfig: cfg });
      for await (const chunk of gen) resp += chunk;
      addMsg('assistant', resp || '请检查AI配置中的API Key。');
    } catch { addMsg('assistant', '出错了'); }
    finally { setLoading(false); }
  };

  // Quick action: polish/concise/expand — replaces selected text directly
  const handleQuickAction = async (action: 'polish' | 'concise' | 'expand') => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to);
    if (!text) { message.warning('请先在编辑区选中需要处理的文本'); return; }

    setLoading(true);
    const styleMap: Record<string, PolishRequest['style']> = { polish: 'formal', concise: 'concise', expand: 'expand' };
    const labels: Record<string, string> = { polish: '润色', concise: '精简', expand: '扩展' };
    addMsg('user', `${labels[action]}选中文本: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`);

    try {
      const cfg = getActiveConfig();
      const result = await aiPolish({ originalText: text, style: styleMap[action], aiConfig: cfg });

      // Replace selected text with result directly in editor
      editor.chain().focus().deleteSelection().insertContent(result).run();

      addMsg('assistant', `${labels[action]}完成，已替换原文。`);
      message.success(`${labels[action]}完成`);
    } catch { message.error('操作失败'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fafafa', borderLeft: '1px solid #e0e0e0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #e0e0e0', fontSize: 12, fontWeight: 600 }}>
        <RobotOutlined /> Agent
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: 6, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: msg.role === 'user' ? '#1677ff' : '#52c41a', flexShrink: 0 }}>
              {msg.role === 'user' ? <UserOutlined style={{ color: '#fff', fontSize: 10 }} /> : <RobotOutlined style={{ color: '#fff', fontSize: 10 }} />}
            </div>
            <div style={{ maxWidth: '85%', padding: '5px 8px', borderRadius: 6, background: msg.role === 'user' ? '#e6f4ff' : '#f5f5f5', fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: 11, color: '#999', padding: '2px 8px' }}><RobotOutlined /> Agent 思考中...</div>}
        <div ref={chatEndRef} />
      </div>

      {/* Quick actions */}
      <div style={{ padding: '4px 8px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 4 }}>
        <Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleQuickAction('polish')} disabled={!selectedText} style={{ fontSize: 11 }}>润色</Button>
        <Button size="small" icon={<CompressOutlined />} onClick={() => handleQuickAction('concise')} disabled={!selectedText} style={{ fontSize: 11 }}>精简</Button>
        <Button size="small" icon={<ExpandOutlined />} onClick={() => handleQuickAction('expand')} disabled={!selectedText} style={{ fontSize: 11 }}>扩展</Button>
      </div>

      {/* Input */}
      <div style={{ padding: '4px 8px 6px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 4 }}>
        <Input.TextArea size="small" value={input} onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="输入消息..." rows={2} style={{ flex: 1, fontSize: 11 }} />
        <Button type="primary" size="small" icon={<SendOutlined />} onClick={handleSend} loading={loading} style={{ alignSelf: 'flex-end' }} />
      </div>
    </div>
  );
}
