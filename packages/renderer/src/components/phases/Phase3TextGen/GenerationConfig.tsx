import { Select, InputNumber, Space, Input } from 'antd';
import type { AIConfig } from '@qiuai/shared';

interface GenerationConfigProps {
  config: AIConfig;
  onChange: (config: AIConfig) => void;
}

const modelOptions = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'glm-4.7', label: 'GLM-4.7' },
  { value: 'qwen2.5:72b', label: 'Qwen 2.5 72B (本地)' },
];

const providerOptions = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI / Compatible' },
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
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>AI 提供商</label>
        <Select
          size="small"
          value={config.provider}
          onChange={(value) => handleChange('provider', value)}
          options={providerOptions}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>模型</label>
        <Select
          size="small"
          value={config.model}
          onChange={(value) => handleChange('model', value)}
          options={modelOptions}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>API Key（可选）</label>
        <Input.Password
          size="small"
          value={config.apiKey || ''}
          onChange={(event) => handleChange('apiKey', event.target.value)}
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
            onChange={(value) => handleChange('temperature', value || 0.7)}
            style={{ width: 80 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>最大 Token</label>
          <InputNumber
            size="small"
            min={256}
            max={32768}
            step={256}
            value={config.maxTokens}
            onChange={(value) => handleChange('maxTokens', value || 4096)}
            style={{ width: 110 }}
          />
        </div>
      </Space>
    </div>
  );
}
