import { useState } from 'react';
import { Button, Divider, Input, Space, message } from 'antd';
import { PictureOutlined, RobotOutlined, UploadOutlined } from '@ant-design/icons';
import { IPC_CHANNELS, type IPCResponse } from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import { insertDocumentHtml } from '../../services/documentEngineCommands';

export function ImagePolishPanel() {
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState('');

  const insertImage = async (src: string) => {
    const applied = await insertDocumentHtml(`<img src="${src}" alt="插入图片" />`);
    if (!applied) {
      message.error('当前文档无法插入图片');
      return;
    }
    message.success('图片已插入编辑区');
  };

  const handleGenerateImage = async () => {
    if (!aiPrompt.trim()) {
      message.warning('请输入图片生成描述');
      return;
    }

    setGenerating(true);
    try {
      const response = await ipcClient.invoke<IPCResponse<{ base64: string }>>(IPC_CHANNELS.AI_GENERATE_IMAGE, {
        prompt: aiPrompt,
        aiConfig: { provider: 'openai', model: 'dall-e-3', temperature: 0.7, maxTokens: 1024 },
      });

      if (response.success && response.data) {
        setGeneratedImage(`data:image/png;base64,${response.data.base64}`);
        message.success('图片生成成功');
      }
    } catch {
      message.error('图片生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleImportLocal = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result || '');
        if (base64) {
          void insertImage(base64);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          <UploadOutlined /> 导入本地图片
        </label>
        <Button icon={<PictureOutlined />} onClick={handleImportLocal} size="small" block style={{ marginTop: 6 }}>
          选择图片文件
        </Button>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          <RobotOutlined /> AI 生成图片
        </label>
        <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          描述你需要的图片内容，AI 会为你生成适合报告的插图或示意图。
        </p>
      </div>

      <Input.TextArea
        value={aiPrompt}
        onChange={(event) => setAiPrompt(event.target.value)}
        placeholder="例如：一张展示技术路线流程的数据分析示意图，包含数据采集、模型训练、结果评估三个阶段"
        rows={3}
        style={{ marginBottom: 8 }}
      />

      <Button type="primary" icon={<RobotOutlined />} loading={generating} onClick={() => void handleGenerateImage()} block size="small">
        生成图片
      </Button>

      {generatedImage ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 4 }}>
            <img src={generatedImage} alt="AI 生成" style={{ width: '100%' }} />
          </div>
          <Space style={{ marginTop: 8 }}>
            <Button size="small" type="primary" onClick={() => void insertImage(generatedImage)}>
              插入编辑区
            </Button>
            <Button size="small" onClick={() => setGeneratedImage('')}>
              放弃
            </Button>
          </Space>
        </div>
      ) : null}
    </div>
  );
}
