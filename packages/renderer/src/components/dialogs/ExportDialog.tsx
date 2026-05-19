import { useState } from 'react';
import { Modal, Radio, Space, Button, message, Input, Form } from 'antd';
import { FileTextOutlined, FilePdfOutlined, ExportOutlined } from '@ant-design/icons';
import { IPC_CHANNELS, type IPCResponse } from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import { useProjectStore } from '../../stores/useProjectStore';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'docx' | 'pdf'>('docx');
  const [exporting, setExporting] = useState(false);
  const doc = useProjectStore((s) => s.doc);
  const [fileName, setFileName] = useState(doc.title || '申报书');

  const handleExport = async () => {
    setExporting(true);
    try {
      const channel = format === 'pdf' ? IPC_CHANNELS.EXPORT_PDF : IPC_CHANNELS.EXPORT_DOCX;
      const result = await ipcClient.invoke<IPCResponse<string>>(channel, doc);
      if (result.success) {
        message.success(`导出成功: ${fileName}.${format}`);
        onClose();
      } else if (result.error) {
        message.error(result.error);
      }
    } catch (e) {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <ExportOutlined /> 导出申报书
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={420}
    >
      <Form layout="vertical" size="small">
        <Form.Item label="文件名称">
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            addonAfter={`.${format}`}
          />
        </Form.Item>

        <Form.Item label="导出格式">
          <Radio.Group
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio value="docx" style={{ padding: '8px 12px', border: format === 'docx' ? '1px solid #1677ff' : '1px solid #d9d9d9', borderRadius: 6, width: '100%' }}>
                <Space>
                  <FileTextOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                  <div>
                    <div><strong>Word 文档 (.docx)</strong></div>
                    <div style={{ fontSize: 11, color: '#666' }}>可编辑的Microsoft Word格式，保留完整排版</div>
                  </div>
                </Space>
              </Radio>
              <Radio value="pdf" style={{ padding: '8px 12px', border: format === 'pdf' ? '1px solid #1677ff' : '1px solid #d9d9d9', borderRadius: 6, width: '100%' }}>
                <Space>
                  <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                  <div>
                    <div><strong>PDF 文档</strong></div>
                    <div style={{ fontSize: 11, color: '#666' }}>固定版式的PDF，适合提交和打印</div>
                  </div>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            loading={exporting}
            onClick={handleExport}
          >
            导出
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
