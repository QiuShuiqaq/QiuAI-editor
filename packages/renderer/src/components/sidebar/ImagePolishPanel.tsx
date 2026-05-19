import { useState } from 'react';
import { Button, Input, Space, Divider, Upload, message } from 'antd';
import {
  UploadOutlined,
  RobotOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { IPC_CHANNELS, type IPCResponse } from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import { useEditorStore } from '../../stores/useEditorStore';

export function ImagePolishPanel() {
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const editor = useEditorStore((s) => s.editor);

  const handleGenerateImage = async () => {
    if (!aiPrompt.trim()) {
      message.warning('请输入图片生成描述');
      return;
    }

    setGenerating(true);
    try {
      const response = await ipcClient.invoke<IPCResponse<{ base64: string }>>(
        IPC_CHANNELS.AI_GENERATE_IMAGE,
        {
          prompt: aiPrompt,
          aiConfig: { provider: 'openai', model: 'dall-e-3', temperature: 0.7, maxTokens: 1024 },
        }
      );

      if (response.success && response.data) {
        setGeneratedImage(`data:image/png;base64,${response.data.base64}`);
        message.success('图片生成成功');
      }
    } catch (e) {
      message.error('图片生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleImportLocal = () => {
    // Use file input for local image import
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          if (editor) {
            editor.commands.insertContent(`<img src="${base64}" />`);
            message.success('图片已插入编辑区');
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleInsertToEditor = () => {
    if (generatedImage && editor) {
      editor.commands.insertContent(`<img src="${generatedImage}" />`);
      message.success('图片已插入编辑区');
    }
  };

  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          <UploadOutlined /> 导入本地图片
        </label>
        <Button
          icon={<PictureOutlined />}
          onClick={handleImportLocal}
          size="small"
          block
          style={{ marginTop: 6 }}
        >
          选择图片文件
        </Button>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          <RobotOutlined /> AI生成图片
        </label>
        <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          描述您需要的图片内容，AI将为您生成专业图表或插图
        </p>
      </div>

      <Input.TextArea
        value={aiPrompt}
        onChange={(e) => setAiPrompt(e.target.value)}
        placeholder="例如：一张展示技术路线流程的示意图，包含数据采集、模型训练、结果评估三个阶段..."
        rows={3}
        style={{ marginBottom: 8 }}
      />

      <Button
        type="primary"
        icon={<RobotOutlined />}
        loading={generating}
        onClick={handleGenerateImage}
        block
        size="small"
      >
        生成图片
      </Button>

      {generatedImage && (
        <div style={{ marginTop: 12 }}>
          <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 4 }}>
            <img src={generatedImage} alt="AI生成" style={{ width: '100%' }} />
          </div>
          <Space style={{ marginTop: 8 }}>
            <Button size="small" type="primary" onClick={handleInsertToEditor}>
              插入编辑区
            </Button>
            <Button size="small" onClick={() => setGeneratedImage('')}>
              放弃
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
}
