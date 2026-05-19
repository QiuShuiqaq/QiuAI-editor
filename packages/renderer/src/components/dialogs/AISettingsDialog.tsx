import { useState } from 'react';
import { Modal, Tabs, Form, Input, Select, InputNumber, Slider, Button, message, Alert, Tag, Space, Tooltip } from 'antd';
import {
  KeyOutlined,
  RobotOutlined,
  ApiOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { AIConfig } from '@qiuai/shared';

const modelOptions: Record<string, Array<{ value: string; label: string; description: string }>> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: '平衡速度与质量，适合大部分写作任务' },
    { value: 'claude-opus-4-7', label: 'Claude Opus 4.7', description: '最高质量，适合精修和润色' },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: '最快速度，适合简单生成' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o', description: '综合能力强，多模态支持' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: '速度快，成本低' },
  ],
  glm: [
    { value: 'glm-4.7', label: 'GLM-4.7', description: '智谱AI最新旗舰，中文能力业界领先' },
    { value: 'glm-4-plus', label: 'GLM-4 Plus', description: '智谱AI旗舰模型' },
    { value: 'glm-4-flash', label: 'GLM-4 Flash', description: '智谱AI快速模型，适合简单任务' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat', description: '性价比高，中文优异' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: '深度推理，适合复杂内容' },
  ],
  ollama: [
    { value: 'qwen2.5:72b', label: 'Qwen 2.5 72B', description: '阿里通义千问，中文最佳' },
    { value: 'qwen2.5:32b', label: 'Qwen 2.5 32B', description: '通义千问32B，平衡性能' },
    { value: 'qwen2.5:14b', label: 'Qwen 2.5 14B', description: '通义千问14B，低配置友好' },
    { value: 'deepseek-r1:70b', label: 'DeepSeek R1 70B', description: '深度求索推理模型' },
  ],
};

interface AISettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AISettingsDialog({ open, onClose }: AISettingsDialogProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateProvider = useSettingsStore((s) => s.updateProviderConfig);
  const setActiveProvider = useSettingsStore((s) => s.setActiveProvider);
  const setDataKeywords = useSettingsStore((s) => s.setDataKeywords);
  const save = useSettingsStore((s) => s.save);

  const [activeTab, setActiveTab] = useState(settings.activeProvider);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const handleSave = () => {
    setActiveProvider(activeTab as typeof settings.activeProvider);
    save();
    message.success('AI配置已保存');
    onClose();
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const renderProviderTab = (provider: string, label: string, icon: React.ReactNode) => {
    const config = settings.aiProviders[provider as keyof typeof settings.aiProviders];
    const models = modelOptions[provider] || [];

    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 6, fontSize: 12, color: '#666' }}>
          {provider === 'anthropic' && '需要 Anthropic API Key，从 console.anthropic.com 获取'}
          {provider === 'openai' && '需要 OpenAI API Key，从 platform.openai.com 获取'}
          {provider === 'glm' && '需要智谱AI API Key，从 open.bigmodel.cn 获取。API已配置。'}
          {provider === 'deepseek' && '需要 DeepSeek API Key，从 platform.deepseek.com 获取'}
          {provider === 'ollama' && '需要本地运行 Ollama 服务（ollama serve），无需 API Key'}
        </div>

        <Form layout="vertical" size="small">
          <Form.Item label="API Key">
            <Input
              value={config.apiKey || ''}
              onChange={(e) => updateProvider(provider, { apiKey: e.target.value })}
              placeholder={provider === 'ollama' ? '本地Ollama无需API Key' : '输入你的API密钥...'}
              type={showKeys[provider] ? 'text' : 'password'}
              prefix={<KeyOutlined />}
              suffix={
                <Button
                  type="text"
                  size="small"
                  icon={showKeys[provider] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={() => toggleShowKey(provider)}
                />
              }
            />
          </Form.Item>

          <Form.Item label="API Base URL（可选，用于代理或自建服务）">
            <Input
              value={config.baseURL || ''}
              onChange={(e) => updateProvider(provider, { baseURL: e.target.value || undefined })}
              placeholder={
                provider === 'ollama'
                  ? 'http://localhost:11434'
                  : provider === 'deepseek'
                  ? 'https://api.deepseek.com'
                  : '默认官方地址'
              }
              prefix={<ApiOutlined />}
            />
          </Form.Item>

          <Form.Item label="模型选择">
            <Select
              value={config.model}
              onChange={(v) => updateProvider(provider, { model: v })}
              options={models.map((m) => ({
                value: m.value,
                label: (
                  <div>
                    <div>{m.label}</div>
                    <div style={{ fontSize: 10, color: '#999' }}>{m.description}</div>
                  </div>
                ),
              }))}
              optionRender={(option) => (
                <div>
                  <div style={{ fontWeight: 500 }}>{option.data?.label}</div>
                </div>
              )}
            />
          </Form.Item>

          <Form.Item label="生成温度（创造性程度）">
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={config.temperature}
              onChange={(v) => updateProvider(provider, { temperature: v })}
              marks={{ 0: '精确', 0.7: '平衡', 1.5: '创造' }}
            />
          </Form.Item>

          <Form.Item label="最大输出 Token 数">
            <InputNumber
              min={256}
              max={32768}
              step={512}
              value={config.maxTokens}
              onChange={(v) => updateProvider(provider, { maxTokens: v || 4096 })}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              约 {Math.round(config.maxTokens * 1.5)} 个中文字符（1 token ≈ 1.5 汉字）
            </div>
          </Form.Item>
        </Form>
      </div>
    );
  };

  return (
    <Modal
      title={
        <span>
          <SettingOutlined /> AI 模型配置
        </span>
      }
      open={open}
      onCancel={onClose}
      width={560}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleSave}>
            保存配置
          </Button>
        </Space>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
        size="small"
        items={[
          {
            key: 'anthropic',
            label: (
              <span>
                <RobotOutlined /> Claude
              </span>
            ),
            children: renderProviderTab('anthropic', 'Anthropic Claude', <RobotOutlined />),
          },
          {
            key: 'openai',
            label: (
              <span>
                <RobotOutlined /> GPT
              </span>
            ),
            children: renderProviderTab('openai', 'OpenAI GPT', <RobotOutlined />),
          },
          {
            key: 'glm',
            label: (
              <span>
                <RobotOutlined /> GLM
              </span>
            ),
            children: renderProviderTab('glm', '智谱 GLM-4', <RobotOutlined />),
          },
          {
            key: 'deepseek',
            label: (
              <span>
                <RobotOutlined /> DeepSeek
              </span>
            ),
            children: renderProviderTab('deepseek', 'DeepSeek', <RobotOutlined />),
          },
          {
            key: 'ollama',
            label: (
              <span>
                <RobotOutlined /> 本地
              </span>
            ),
            children: renderProviderTab('ollama', 'Ollama 本地', <RobotOutlined />),
          },
        ]}
      />

      <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
          关键数据标记
          <Tooltip title="AI在生成文本时会将这些类型的数据用高亮标出，方便您审核修改">
            <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 12 }} />
          </Tooltip>
        </div>
        <Form.Item style={{ marginBottom: 0 }}>
          <Select
            mode="tags"
            size="small"
            value={settings.dataKeywords}
            onChange={setDataKeywords}
            placeholder="输入需要标记的数据类型，如：经费、指标、参数"
            style={{ width: '100%' }}
          />
        </Form.Item>
        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          例如：经费数额、性能指标、技术参数、百分比、万元、人月等
        </div>
      </div>
    </Modal>
  );
}
