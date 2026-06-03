import { useEffect, useState } from 'react';
import { Modal, Tabs, Form, Input, Select, InputNumber, Slider, Button, Space, Tooltip, message } from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  KeyOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../../stores/useSettingsStore';

const modelOptions: Record<string, Array<{ value: string; label: string; description: string }>> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: '平衡速度与质量，适合大多数写作任务' },
    { value: 'claude-opus-4-7', label: 'Claude Opus 4.7', description: '更高质量，适合深度润色与复杂改写' },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: '响应更快，适合轻量生成' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o', description: '综合能力强，适合通用办公与多模态任务' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: '成本更低，速度更快' },
  ],
  glm: [
    { value: 'glm-4.7', label: 'GLM-4.7', description: '适合中文办公与正式文稿写作' },
    { value: 'glm-4-plus', label: 'GLM-4 Plus', description: '更强的通用理解与生成能力' },
    { value: 'glm-4-flash', label: 'GLM-4 Flash', description: '更快，适合轻量任务' },
  ],
  deepseek: [
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: '默认写作模型，适合润色、续写与章节生成' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: '质量更高，适合正式稿打磨与复杂重写' },
  ],
  ollama: [
    { value: 'qwen2.5:72b', label: 'Qwen 2.5 72B', description: '本地高质量中文模型' },
    { value: 'qwen2.5:32b', label: 'Qwen 2.5 32B', description: '质量与资源占用更平衡' },
    { value: 'qwen2.5:14b', label: 'Qwen 2.5 14B', description: '更适合低配置设备' },
    { value: 'deepseek-r1:70b', label: 'DeepSeek R1 70B', description: '偏推理型本地模型' },
  ],
};

interface AISettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

function getProviderHint(provider: string) {
  switch (provider) {
    case 'anthropic':
      return '需要配置 Anthropic API Key，可从 console.anthropic.com 获取。';
    case 'openai':
      return '需要配置 OpenAI API Key，可从 platform.openai.com 获取。';
    case 'glm':
      return '需要配置 GLM API Key，可从 open.bigmodel.cn 获取。';
    case 'deepseek':
      return '写作类 AI 默认使用 DeepSeek，可填写 API Key，也可使用本地 .env.local。';
    case 'ollama':
      return '需要本地启动 Ollama 服务，例如执行 ollama serve。';
    default:
      return '';
  }
}

function getBaseUrlPlaceholder(provider: string) {
  switch (provider) {
    case 'ollama':
      return 'http://localhost:11434';
    case 'deepseek':
      return 'https://api.deepseek.com';
    case 'glm':
      return 'https://open.bigmodel.cn/api/paas/v4/';
    default:
      return '默认官方地址';
  }
}

export function AISettingsDialog({ open, onClose }: AISettingsDialogProps) {
  const settings = useSettingsStore((state) => state.settings);
  const updateProvider = useSettingsStore((state) => state.updateProviderConfig);
  const setActiveProvider = useSettingsStore((state) => state.setActiveProvider);
  const setDataKeywords = useSettingsStore((state) => state.setDataKeywords);
  const save = useSettingsStore((state) => state.save);

  const [activeTab, setActiveTab] = useState(settings.activeProvider);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setActiveTab(settings.activeProvider);
    }
  }, [open, settings.activeProvider]);

  const handleSave = () => {
    setActiveProvider(activeTab as typeof settings.activeProvider);
    save();
    message.success('AI 配置已保存');
    onClose();
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const renderProviderTab = (provider: string) => {
    const config = settings.aiProviders[provider as keyof typeof settings.aiProviders];
    const models = modelOptions[provider] || [];

    return (
      <div style={{ padding: '8px 0' }}>
        <div
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            background: '#fafafa',
            borderRadius: 6,
            fontSize: 12,
            color: '#666',
            lineHeight: 1.6,
          }}
        >
          {getProviderHint(provider)}
        </div>

        <Form layout="vertical" size="small">
          <Form.Item label="API Key">
            <Input
              value={config.apiKey || ''}
              onChange={(event) => updateProvider(provider, { apiKey: event.target.value })}
              placeholder={provider === 'ollama' ? '本地 Ollama 无需 API Key' : '输入 API Key'}
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

          <Form.Item label="API Base URL（可选）">
            <Input
              value={config.baseURL || ''}
              onChange={(event) => updateProvider(provider, { baseURL: event.target.value || undefined })}
              placeholder={getBaseUrlPlaceholder(provider)}
              prefix={<ApiOutlined />}
            />
          </Form.Item>

          <Form.Item label="模型选择">
            <Select
              value={config.model}
              onChange={(value) => updateProvider(provider, { model: value })}
              popupMatchSelectWidth
              optionLabelProp="plainLabel"
              style={{ width: '100%' }}
              styles={{
                popup: {
                  root: {
                    maxWidth: 560,
                  },
                },
              }}
              options={models.map((item) => ({
                value: item.value,
                plainLabel: item.label,
                label: (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      minWidth: 0,
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <div style={{ fontWeight: 500, lineHeight: 1.4 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.5 }}>{item.description}</div>
                  </div>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item label="生成温度">
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={config.temperature}
              onChange={(value) => updateProvider(provider, { temperature: value })}
              marks={{ 0: '严谨', 0.7: '平衡', 1.5: '发散' }}
            />
          </Form.Item>

          <Form.Item label="最大输出 Token">
            <InputNumber
              min={256}
              max={32768}
              step={512}
              value={config.maxTokens}
              onChange={(value) => updateProvider(provider, { maxTokens: value || 4096 })}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              约 {Math.round((config.maxTokens || 0) * 1.5)} 个中文字符
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
            children: renderProviderTab('anthropic'),
          },
          {
            key: 'openai',
            label: (
              <span>
                <RobotOutlined /> GPT
              </span>
            ),
            children: renderProviderTab('openai'),
          },
          {
            key: 'glm',
            label: (
              <span>
                <RobotOutlined /> GLM
              </span>
            ),
            children: renderProviderTab('glm'),
          },
          {
            key: 'deepseek',
            label: (
              <span>
                <RobotOutlined /> DeepSeek
              </span>
            ),
            children: renderProviderTab('deepseek'),
          },
          {
            key: 'ollama',
            label: (
              <span>
                <RobotOutlined /> 本地
              </span>
            ),
            children: renderProviderTab('ollama'),
          },
        ]}
      />

      <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
          关键数据标记
          <Tooltip title="这些关键词会在 AI 写作时被重点提醒，便于后续人工复核。">
            <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 12 }} />
          </Tooltip>
        </div>
        <Form.Item style={{ marginBottom: 0 }}>
          <Select
            mode="tags"
            size="small"
            value={settings.dataKeywords}
            onChange={setDataKeywords}
            placeholder="例如：经费、指标、参数、百分比、万元、人月"
            style={{ width: '100%' }}
          />
        </Form.Item>
        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          用于提醒 AI 对数字、金额、参数等内容保持谨慎，不替代人工核查。
        </div>
      </div>
    </Modal>
  );
}
