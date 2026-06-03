import { useMemo, useRef, useState } from 'react';
import { PrinterOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { Button, Modal, Slider, Space, message } from 'antd';
import { syncDocumentWithState } from '@qiuai/shared';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { buildDocumentHtml } from '../../utils/documentHtml';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PrintPreview({ open, onClose }: Props) {
  const [scale, setScale] = useState(60);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const editor = useEditorStore((state) => state.editor);
  const pageCount = useEditorStore((state) => state.pageCount);
  const doc = useProjectStore((state) => state.doc);
  const pageLayout = useProjectStore((state) => state.doc.documentState.pageLayout);

  const previewDoc = useMemo(
    () =>
      syncDocumentWithState({
        ...doc,
        editorContent: editor?.getJSON() || doc.editorContent,
        documentState: {
          ...doc.documentState,
          pageCount,
        },
      }),
    [doc, editor, pageCount]
  );

  const previewHtml = useMemo(() => buildDocumentHtml(previewDoc), [previewDoc]);

  const print = () => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) {
      message.warning('打印预览尚未准备完成。');
      return;
    }

    frameWindow.focus();
    frameWindow.print();
    message.success('已发送到打印。');
  };

  return (
    <Modal
      title="打印预览"
      open={open}
      onCancel={onClose}
      width={980}
      style={{ top: 20 }}
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={print}>
            打印
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setScale(Math.max(30, scale - 10))} />
        <Slider
          min={30}
          max={120}
          step={10}
          value={scale}
          onChange={setScale}
          style={{ width: 180 }}
          tooltip={{ formatter: (value) => `${value}%` }}
        />
        <Button size="small" icon={<ZoomInOutlined />} onClick={() => setScale(Math.min(120, scale + 10))} />
        <span style={{ fontSize: 12 }}>{scale}%</span>
      </div>

      <div
        style={{
          background: '#999',
          padding: 16,
          minHeight: 560,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            transform: `scale(${scale / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease',
          }}
        >
          <iframe
            ref={iframeRef}
            title="打印预览文档"
            srcDoc={previewHtml}
            style={{
              width: pageLayout.orientation === 'landscape' ? '1122px' : '794px',
              height: '1123px',
              border: 'none',
              background: '#f3f4f6',
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
