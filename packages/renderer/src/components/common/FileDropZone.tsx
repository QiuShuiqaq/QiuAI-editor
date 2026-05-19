import { useState, useCallback, type DragEvent, type ReactNode } from 'react';
import { Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

interface FileDropZoneProps {
  onFile: (file: File) => void;
  accept: string;
  children?: ReactNode;
}

export function FileDropZone({ onFile, accept, children }: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        onFile(file);
      }
    },
    [onFile]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? '#1677ff' : '#d9d9d9'}`,
        borderRadius: 8,
        padding: 24,
        textAlign: 'center',
        background: dragging ? '#f0f5ff' : '#fafafa',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
    >
      {children || (
        <>
          <InboxOutlined style={{ fontSize: 32, color: '#1677ff' }} />
          <p style={{ marginTop: 8, color: '#666' }}>
            拖放文件到此处，或点击选择
          </p>
        </>
      )}
    </div>
  );
}
