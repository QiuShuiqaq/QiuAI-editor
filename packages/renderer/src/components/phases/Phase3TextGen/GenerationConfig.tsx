import { Select, InputNumber, Space, Input } from 'antd';
import type { AIConfig } from '@qiuai/shared';

interface GenerationConfigProps {
  config: AIConfig;
  onChange: (config: AIConfig) => void;
}

const modelOptions = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (推荐)' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7 (高质量)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'deepseek-v3', label: 'DeepSeek V3' },
  { value: 'qwen2.5-72b', label: 'Qwen 2.5 72B (本地)' },
];

const providerOptions = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'ollama', label: 'Ollama (本地)' },
];

export function GenerationConfig({ config, onChange }: GenerationConfigProps) {
  const handleChange = (key: keyof AIConfig, value: unknown) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>生成设置</div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>AI供应商</label>
        <Select
          size="small"
          value={config.provider}
          onChange={(v) => handleChange('provider', v)}
          options={providerOptions}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>模型</label>
        <Select
          size="small"
          value={config.model}
          onChange={(v) => handleChange('model', v)}
          options={modelOptions}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>API密钥（可选，浏览器模式下使用占位生成）</label>
        <Input.Password
          size="small"
          value={config.apiKey || ''}
          onChange={(e) => handleChange('apiKey', e.target.value)}
          placeholder="sk-..."
          style={{ width: '100%' }}
        />
      </div>

      <Space size={8}>
        <div>
          <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>温度</label>
          <InputNumber
            size="small"
            min={0}
            max={2}
            step={0.1}
            value={config.temperature}
            onChange={(v) => handleChange('temperature', v || 0.7)}
            style={{ width: 80 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>最大Token</label>
          <InputNumber
            size="small"
            min={256}
            max={32768}
            step={256}
            value={config.maxTokens}
            onChange={(v) => handleChange('maxTokens', v || 4096)}
            style={{ width: 110 }}
          />
        </div>
      </Space>
    </div>
  );
}
