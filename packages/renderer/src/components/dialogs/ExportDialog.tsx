import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Radio, Space, message } from 'antd';
import { ExportOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
import {
  IPC_CHANNELS,
  syncDocumentWithState,
  type ExportRequest,
  type IPCResponse,
} from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import { saveCurrentDocument } from '../../services/documentEngineCommands';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'docx' | 'pdf'>('docx');
  const [exporting, setExporting] = useState(false);
  const doc = useProjectStore((state) => state.doc);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const [fileName, setFileName] = useState(doc.title || '项目报告');

  useEffect(() => {
    if (!open) {
      return;
    }

    setFileName(doc.title || '项目报告');
    setFormat('docx');
  }, [doc.title, open]);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (documentEngineAdapter) {
        await saveCurrentDocument();
      }

      const currentEditor = useEditorStore.getState().editor;
      const pageCount = useEditorStore.getState().pageCount;
      const latestDoc = useProjectStore.getState().doc;
      const normalizedFileName = fileName.trim() || latestDoc.title || '项目报告';
      const exportDoc = syncDocumentWithState({
        ...latestDoc,
        title: normalizedFileName,
        editorContent: currentEditor?.getJSON() || latestDoc.editorContent,
        documentState: {
          ...latestDoc.documentState,
          editorContent: currentEditor?.getJSON() || latestDoc.editorContent,
          pageCount,
        },
        updatedAt: new Date().toISOString(),
      });

      const channel = format === 'pdf' ? IPC_CHANNELS.EXPORT_PDF : IPC_CHANNELS.EXPORT_DOCX;
      const payload: ExportRequest = {
        doc: exportDoc,
        suggestedFileName: `${normalizedFileName}.${format}`,
      };
      const result = await ipcClient.invoke<IPCResponse<string>>(channel, payload);

      if (result.success) {
        message.success(`已导出 ${normalizedFileName}.${format}`);
        onClose();
        return;
      }

      if (result.error) {
        message.error(result.error);
      }
    } catch {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <ExportOutlined /> 导出项目报告
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={420}
    >
      <Form layout="vertical" size="small">
        <Form.Item label="文件名">
          <Input value={fileName} onChange={(event) => setFileName(event.target.value)} addonAfter={`.${format}`} />
        </Form.Item>

        <Form.Item label="导出格式">
          <Radio.Group value={format} onChange={(event) => setFormat(event.target.value)} style={{ width: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio
                value="docx"
                style={{
                  padding: '8px 12px',
                  border: format === 'docx' ? '1px solid #1677ff' : '1px solid #d9d9d9',
                  borderRadius: 6,
                  width: '100%',
                }}
              >
                <Space>
                  <FileTextOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                  <div>
                    <div>
                      <strong>Word 文档 (.docx)</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#666' }}>适合继续编辑，优先保留当前文档结构。</div>
                  </div>
                </Space>
              </Radio>

              <Radio
                value="pdf"
                style={{
                  padding: '8px 12px',
                  border: format === 'pdf' ? '1px solid #1677ff' : '1px solid #d9d9d9',
                  borderRadius: 6,
                  width: '100%',
                }}
              >
                <Space>
                  <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                  <div>
                    <div>
                      <strong>PDF 文档</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#666' }}>适合预览、打印和提交。</div>
                  </div>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" icon={<ExportOutlined />} loading={exporting} onClick={() => void handleExport()}>
            导出
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
