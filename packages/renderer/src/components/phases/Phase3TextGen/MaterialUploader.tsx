import { useState } from 'react';
import { Button, List, Space, Tag, message } from 'antd';
import { DeleteOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
import { IPC_CHANNELS, type IPCResponse, type ReferenceMaterial } from '@qiuai/shared';
import { ipcClient } from '../../../services/ipcClient';

interface MaterialUploaderProps {
  materials: ReferenceMaterial[];
  onMaterialsChange: (materials: ReferenceMaterial[]) => void;
}

export function MaterialUploader({ materials, onMaterialsChange }: MaterialUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (type: 'pdf' | 'docx') => {
    setUploading(true);
    try {
      const response = await ipcClient.invoke<IPCResponse<ReferenceMaterial>>(
        IPC_CHANNELS.FILE_IMPORT_REFERENCE,
        type
      );
      if (response.success && response.data) {
        onMaterialsChange([...materials, response.data]);
        message.success(`${response.data.fileName} 导入成功`);
      } else if (response.error) {
        message.error(response.error);
      }
    } catch {
      message.error('文件导入失败');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (id: string) => {
    onMaterialsChange(materials.filter((item) => item.id !== id));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>参考材料</span>
        <span style={{ fontSize: 11, color: '#999' }}>{materials.length} 个文件</span>
      </div>

      <Space size="small" style={{ marginBottom: 8 }}>
        <Button size="small" icon={<FilePdfOutlined />} onClick={() => handleUpload('pdf')} loading={uploading}>
          导入 PDF
        </Button>
        <Button size="small" icon={<FileTextOutlined />} onClick={() => handleUpload('docx')} loading={uploading}>
          导入 DOCX
        </Button>
      </Space>

      {materials.length > 0 ? (
        <List
          size="small"
          dataSource={materials}
          style={{ maxHeight: 200, overflow: 'auto' }}
          renderItem={(item) => (
            <List.Item
              style={{ padding: '4px 8px' }}
              actions={[
                <Button
                  key="delete"
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemove(item.id)}
                />,
              ]}
            >
              <Space size={4}>
                {item.fileType === 'pdf' ? (
                  <FilePdfOutlined style={{ color: '#ff4d4f' }} />
                ) : (
                  <FileTextOutlined style={{ color: '#1677ff' }} />
                )}
                <span style={{ fontSize: 12 }}>{item.fileName}</span>
                <Tag style={{ fontSize: 10 }}>{item.chunks.length} 段</Tag>
              </Space>
            </List.Item>
          )}
        />
      ) : null}

      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
        上传与当前报告相关的 PDF 或 DOCX 材料，AI 会优先基于这些内容给出更可靠的写作建议。
      </div>
    </div>
  );
}
