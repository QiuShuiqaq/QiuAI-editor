import { Button, Input, Select, message } from 'antd';
import {
  resolvePageSlotField,
  resolvePageSlotText,
  resolvePageVariant,
  type PageHeaderFooterVariant,
} from '@qiuai/shared';
import { useProjectStore } from '../../stores/useProjectStore';
import { usePageViewStore } from '../../stores/usePageViewStore';

interface PageHeaderFooterLayerProps {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  headerOffset: number;
  footerOffset: number;
  zoom?: number;
}

const EDIT_BAND_HEIGHT_MM = 10;

const VARIANT_OPTIONS = [
  { value: 'default', label: '统一内容' },
  { value: 'first', label: '首页内容' },
  { value: 'odd', label: '奇数页内容' },
  { value: 'even', label: '偶数页内容' },
] satisfies Array<{ value: PageHeaderFooterVariant; label: string }>;

export function PageHeaderFooterLayer({
  pageNumber,
  pageWidth,
  pageHeight,
  marginLeft,
  marginRight,
  headerOffset,
  footerOffset,
  zoom = 1,
}: PageHeaderFooterLayerProps) {
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const editMode = usePageViewStore((state) => state.editMode);
  const setEditMode = usePageViewStore((state) => state.setEditMode);
  const activeVariant = usePageViewStore((state) => state.activeVariant);
  const setActiveVariant = usePageViewStore((state) => state.setActiveVariant);

  const pageLayout = doc.documentState.pageLayout;
  const usableWidth = Math.max(pageWidth - marginLeft - marginRight, 0);
  const pageVariant = resolvePageVariant(pageLayout, pageNumber);
  const isEditing = editMode !== 'none';

  const updateLayout = (patch: Partial<typeof pageLayout>) => {
    setDoc({
      ...doc,
      updatedAt: new Date().toISOString(),
      documentState: {
        ...doc.documentState,
        pageLayout: {
          ...pageLayout,
          ...patch,
        },
      },
    });
  };

  const renderBand = (mode: 'header' | 'footer') => {
    const currentField = resolvePageSlotField(mode, activeVariant);
    const currentValue = pageLayout[currentField];
    const displayText = resolvePageSlotText(
      pageLayout,
      mode,
      pageNumber,
      mode === 'header' ? doc.title : ''
    );
    const currentModeEditing = editMode === mode;
    const canEditThisBand = currentModeEditing && activeVariant === pageVariant;
    const emptyHint = mode === 'header' ? '页眉' : '页脚';

    return (
      <div
        onDoubleClick={() => {
          setActiveVariant(pageVariant);
          setEditMode(mode);
        }}
        style={{
          position: 'relative',
          minHeight: `${EDIT_BAND_HEIGHT_MM * zoom}mm`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '0 6px',
          background: currentModeEditing ? 'rgba(22,119,255,0.05)' : 'transparent',
          borderTop: mode === 'footer' && currentModeEditing ? '1px solid rgba(22,119,255,0.4)' : 'none',
          borderBottom: mode === 'header' && currentModeEditing ? '1px solid rgba(22,119,255,0.4)' : 'none',
        }}
      >
        {canEditThisBand ? (
          <>
            <Select
              size="small"
              value={activeVariant}
              style={{ width: 118 }}
              onChange={(value: PageHeaderFooterVariant) => {
                setActiveVariant(value);
                if (value === 'default') {
                  updateLayout({ differentFirstPage: false, differentOddEven: false });
                } else if (value === 'first') {
                  updateLayout({ differentFirstPage: true, differentOddEven: false });
                } else {
                  updateLayout({ differentFirstPage: false, differentOddEven: true });
                }
              }}
              options={VARIANT_OPTIONS}
            />
            <Input
              size="small"
              value={currentValue}
              placeholder={mode === 'header' ? '输入页眉内容' : '输入页脚内容'}
              onChange={(event) =>
                updateLayout({ [currentField]: event.target.value } as Partial<typeof pageLayout>)
              }
            />
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setEditMode('none');
                message.success(`${mode === 'header' ? '页眉' : '页脚'}已更新。`);
              }}
            >
              完成
            </Button>
          </>
        ) : isEditing ? (
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              color: '#64748b',
              fontSize: `${11 * zoom}px`,
            }}
          >
            <span>
              {displayText ||
                `双击此处编辑${mode === 'header' ? '页眉' : '页脚'}，当前页面类型为${
                  VARIANT_OPTIONS.find((item) => item.value === pageVariant)?.label ?? '统一内容'
                }`}
            </span>
            <Button
              size="small"
              type="text"
              onClick={() => {
                setActiveVariant(pageVariant);
                setEditMode(mode);
              }}
            >
              编辑{mode === 'header' ? '页眉' : '页脚'}
            </Button>
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              textAlign: mode === 'footer' ? 'center' : 'left',
              color: displayText ? '#6b7280' : 'transparent',
              fontSize: `${11 * zoom}px`,
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              userSelect: 'none',
            }}
          >
            {displayText || emptyHint}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: `${headerOffset * zoom}mm`,
          left: `${marginLeft * zoom}mm`,
          width: `${usableWidth * zoom}mm`,
          zIndex: 4,
          pointerEvents: isEditing ? 'auto' : 'none',
        }}
      >
        {renderBand('header')}
      </div>

      <div
        style={{
          position: 'absolute',
          top: `${(pageHeight - footerOffset - EDIT_BAND_HEIGHT_MM) * zoom}mm`,
          left: `${marginLeft * zoom}mm`,
          width: `${usableWidth * zoom}mm`,
          zIndex: 4,
          pointerEvents: isEditing ? 'auto' : 'none',
        }}
      >
        {renderBand('footer')}
      </div>

      {isEditing ? (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            zIndex: 5,
            background: '#fff',
            border: '1px solid #bfdbfe',
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 12,
            color: '#1677ff',
            boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
            fontWeight: 600,
          }}
        >
          当前正在编辑
          {VARIANT_OPTIONS.find((item) => item.value === activeVariant)?.label ?? '统一内容'}
          {editMode === 'header' ? '页眉' : '页脚'}
        </div>
      ) : null}
    </>
  );
}
