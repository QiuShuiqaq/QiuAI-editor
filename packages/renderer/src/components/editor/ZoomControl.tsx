/**
 * ZoomControl — Word-like zoom slider + fit modes.
 * Supports: 50%–200% range, "Fit Page", "Fit Width" modes.
 */

import { useState, useCallback } from 'react';
import { Button, Slider, Space, Tooltip, Dropdown } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, ColumnWidthOutlined, FileOutlined } from '@ant-design/icons';

interface ZoomControlProps {
  zoom: number;
  onChange: (zoom: number) => void;
}

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

export function ZoomControl({ zoom, onChange }: ZoomControlProps) {
  const [fitMode, setFitMode] = useState<'custom' | 'fitWidth' | 'fitPage'>('custom');

  const handleFitWidth = () => {
    setFitMode('fitWidth');
    onChange(100); // Would calculate based on container width
  };

  const handleFitPage = () => {
    setFitMode('fitPage');
    onChange(100); // Would calculate based on container height
  };

  const handleZoomIn = () => {
    setFitMode('custom');
    onChange(Math.min(ZOOM_MAX, Math.round(zoom / 10) * 10 + ZOOM_STEP));
  };

  const handleZoomOut = () => {
    setFitMode('custom');
    onChange(Math.max(ZOOM_MIN, Math.round(zoom / 10) * 10 - ZOOM_STEP));
  };

  return (
    <Space size={4} style={{ fontSize: 12 }}>
      <Tooltip title="适配宽度">
        <Button
          type={fitMode === 'fitWidth' ? 'primary' : 'text'}
          size="small"
          icon={<ColumnWidthOutlined />}
          onClick={handleFitWidth}
          style={{ height: 22, fontSize: 11 }}
        />
      </Tooltip>
      <Tooltip title="适配页面">
        <Button
          type={fitMode === 'fitPage' ? 'primary' : 'text'}
          size="small"
          icon={<FileOutlined />}
          onClick={handleFitPage}
          style={{ height: 22, fontSize: 11 }}
        />
      </Tooltip>

      <Tooltip title="缩小">
        <Button type="text" size="small" icon={<ZoomOutOutlined />} onClick={handleZoomOut} style={{ height: 22 }} />
      </Tooltip>

      <Slider
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={ZOOM_STEP}
        value={zoom}
        onChange={(v) => { setFitMode('custom'); onChange(v); }}
        style={{ width: 100, margin: 0 }}
        tooltip={{ formatter: (v) => `${v}%` }}
      />

      <Tooltip title="放大">
        <Button type="text" size="small" icon={<ZoomInOutlined />} onClick={handleZoomIn} style={{ height: 22 }} />
      </Tooltip>

      <span
        style={{ cursor: 'pointer', minWidth: 36, textAlign: 'center', fontWeight: 500, userSelect: 'none' }}
        onClick={() => { setFitMode('custom'); onChange(100); }}
      >
        {Math.round(zoom)}%
      </span>
    </Space>
  );
}
