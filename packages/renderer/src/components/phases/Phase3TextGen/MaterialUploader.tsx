import { useState } from 'react';
import { Button, List, Tag, message, Space } from 'antd';
import { UploadOutlined, DeleteOutlined, FileTextOutlined, FilePdfOutlined } from '@ant-design/icons';
import { IPC_CHANNELS, type IPCResponse, type ReferenceMaterial, generateId } from '@qiuai/shared';
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
    onMaterialsChange(materials.filter((m) => m.id !== id));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>参考资料</span>
        <span style={{ fontSize: 11, color: '#999' }}>{materials.length} 个文件</span>
      </div>

      <Space size="small" style={{ marginBottom: 8 }}>
        <Button
          size="small"
          icon={<FilePdfOutlined />}
          onClick={() => handleUpload('pdf')}
          loading={uploading}
        >
          导入PDF
        </Button>
        <Button
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => handleUpload('docx')}
          loading={uploading}
        >
          导入DOCX
        </Button>
      </Space>

      {materials.length > 0 && (
        <List
          size="small"
          dataSource={materials}
          style={{ maxHeight: 200, overflow: 'auto' }}
          renderItem={(item) => (
            <List.Item
              style={{ padding: '4px 8px' }}
              actions={[
                <Button
                  key="del"
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
      )}

      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
        上传申报书相关的参考PDF/DOCX文件，AI将基于这些材料生成内容
      </div>
    </div>
  );
}
