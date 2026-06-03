import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';

const MM_PER_INCH = 25.4;
const DEFAULT_FIRST_LINE_MM = 7.4;
const DEFAULT_FONT_SIZE_PT = 16;
const CHINESE_CHAR_WIDTH_FACTOR = 0.66;

type DraggingMarker = 'left' | 'first' | 'right' | 'hanging' | null;

interface EditorRulerProps {
  zoom?: number;
}

function ptToMm(points: number): number {
  return (points / 72) * MM_PER_INCH;
}

function mmToPt(mm: number): string {
  return `${((mm / MM_PER_INCH) * 72).toFixed(1)}pt`;
}

function parseLengthToMm(value: string | null | undefined, fontSizePt = DEFAULT_FONT_SIZE_PT): number {
  if (!value) return 0;

  const normalized = value.trim().toLowerCase();
  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric)) return 0;

  if (normalized.endsWith('pt')) return ptToMm(numeric);
  if (normalized.endsWith('px')) return numeric * 0.264583;
  if (normalized.endsWith('mm')) return numeric;
  if (normalized.endsWith('cm')) return numeric * 10;
  if (normalized.endsWith('em')) return numeric * ptToMm(fontSizePt) * CHINESE_CHAR_WIDTH_FACTOR;

  return 0;
}

function formatMmLabel(value: number): string {
  return `${value.toFixed(1)} mm`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function EditorRuler({ zoom = 1 }: EditorRulerProps) {
  const editor = useEditorStore((state) => state.editor);
  const formatting = useEditorStore((state) => state.formatting);
  const pageLayout = useProjectStore((state) => state.doc.documentState.pageLayout);
  const rulerRef = useRef<HTMLDivElement>(null);

  const pageWidth = pageLayout.orientation === 'landscape' ? 297 : 210;
  const contentWidth = pageWidth - pageLayout.margins.left - pageLayout.margins.right;

  const [leftIndent, setLeftIndent] = useState(0);
  const [firstLineIndent, setFirstLineIndent] = useState(DEFAULT_FIRST_LINE_MM);
  const [rightIndent, setRightIndent] = useState(0);
  const [dragging, setDragging] = useState<DraggingMarker>(null);
  const [dragBubble, setDragBubble] = useState<{ label: string; leftPct: number } | null>(null);

  const applyToParagraph = useCallback(
    (nextLeft = leftIndent, nextFirstLine = firstLineIndent, nextRight = rightIndent) => {
      if (!editor) return;

      editor
        .chain()
        .focus()
        .setParagraphAttrs({
          textIndent: nextFirstLine !== 0 ? mmToPt(nextFirstLine) : null,
          marginLeft: nextLeft > 0 ? mmToPt(nextLeft) : null,
          marginRight: nextRight > 0 ? mmToPt(nextRight) : null,
        })
        .run();
    },
    [editor, firstLineIndent, leftIndent, rightIndent]
  );

  useEffect(() => {
    if (dragging) return;

    const fontSizePt = Number.parseFloat(formatting.fontSize) || DEFAULT_FONT_SIZE_PT;
    setLeftIndent(parseLengthToMm(formatting.marginLeft, fontSizePt));
    setFirstLineIndent(
      formatting.textIndent && formatting.textIndent !== '0em'
        ? parseLengthToMm(formatting.textIndent, fontSizePt)
        : 0
    );
    setRightIndent(parseLengthToMm(formatting.marginRight, fontSizePt));
  }, [dragging, formatting.fontSize, formatting.marginLeft, formatting.marginRight, formatting.textIndent]);

  const contentLeftPct = (pageLayout.margins.left / pageWidth) * 100;
  const contentRightPct = (pageLayout.margins.right / pageWidth) * 100;
  const contentTrackPct = 100 - contentLeftPct - contentRightPct;

  const leftMarkerPct = contentLeftPct + (leftIndent / contentWidth) * contentTrackPct;
  const firstLineMarkerPct =
    contentLeftPct +
    ((leftIndent + Math.max(0, firstLineIndent)) / contentWidth) * contentTrackPct;
  const rightMarkerPct = 100 - contentRightPct - (rightIndent / contentWidth) * contentTrackPct;

  const updateBubble = useCallback(
    (marker: DraggingMarker, nextLeft: number, nextFirstLine: number, nextRight: number) => {
      if (!marker) {
        setDragBubble(null);
        return;
      }

      if (marker === 'right') {
        setDragBubble({
          label: `右缩进 ${formatMmLabel(nextRight)}`,
          leftPct: rightMarkerPct,
        });
        return;
      }

      if (marker === 'first') {
        setDragBubble({
          label: `首行缩进 ${formatMmLabel(nextFirstLine)}`,
          leftPct:
            contentLeftPct +
            ((nextLeft + Math.max(0, nextFirstLine)) / contentWidth) * contentTrackPct,
        });
        return;
      }

      if (marker === 'hanging') {
        setDragBubble({
          label: `悬挂缩进 ${formatMmLabel(Math.abs(nextFirstLine))}`,
          leftPct: contentLeftPct + (nextLeft / contentWidth) * contentTrackPct,
        });
        return;
      }

      setDragBubble({
        label: `左缩进 ${formatMmLabel(nextLeft)}`,
        leftPct: contentLeftPct + (nextLeft / contentWidth) * contentTrackPct,
      });
    },
    [contentLeftPct, contentTrackPct, contentWidth, rightMarkerPct]
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!rulerRef.current) return;

      const rect = rulerRef.current.getBoundingClientRect();
      const contentLeftPx = (pageLayout.margins.left / pageWidth) * rect.width;
      const contentRightPx = ((pageWidth - pageLayout.margins.right) / pageWidth) * rect.width;
      const currentContentWidthPx = contentRightPx - contentLeftPx;
      const mmPerPx = contentWidth / currentContentWidthPx;
      const xInContent = event.clientX - rect.left - contentLeftPx;
      const mmPos = clamp(xInContent * mmPerPx, 0, contentWidth);

      let nextLeft = leftIndent;
      let nextFirstLine = firstLineIndent;
      let nextRight = rightIndent;

      switch (dragging) {
        case 'left':
          nextLeft = clamp(mmPos, 0, contentWidth - rightIndent - 5);
          break;
        case 'first':
          nextFirstLine = clamp(
            mmPos - leftIndent,
            -leftIndent,
            contentWidth - leftIndent - rightIndent - 2
          );
          break;
        case 'right':
          nextRight = clamp(contentWidth - mmPos, 0, contentWidth - leftIndent - 5);
          break;
        case 'hanging':
          nextLeft = clamp(mmPos, 0, contentWidth - rightIndent - 5);
          nextFirstLine = -nextLeft;
          break;
      }

      setLeftIndent(nextLeft);
      setFirstLineIndent(nextFirstLine);
      setRightIndent(nextRight);
      updateBubble(dragging, nextLeft, nextFirstLine, nextRight);
    };

    const handleMouseUp = () => {
      applyToParagraph(leftIndent, firstLineIndent, rightIndent);
      setDragging(null);
      setDragBubble(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    applyToParagraph,
    contentWidth,
    dragging,
    firstLineIndent,
    leftIndent,
    pageLayout.margins.left,
    pageLayout.margins.right,
    pageWidth,
    rightIndent,
    updateBubble,
  ]);

  const applyQuickIndent = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current || dragging) return;

    const rect = rulerRef.current.getBoundingClientRect();
    const contentLeftPx = (pageLayout.margins.left / pageWidth) * rect.width;
    const contentRightPx = ((pageWidth - pageLayout.margins.right) / pageWidth) * rect.width;
    const currentContentWidthPx = contentRightPx - contentLeftPx;
    const xInContent = event.clientX - rect.left - contentLeftPx;

    if (xInContent < 0 || xInContent > currentContentWidthPx) {
      return;
    }

    const mmPerPx = contentWidth / currentContentWidthPx;
    const mmPos = clamp(xInContent * mmPerPx, 0, contentWidth);

    let nextLeft = leftIndent;
    let nextFirstLine = firstLineIndent;
    let nextRight = rightIndent;

    if (event.shiftKey) {
      nextRight = clamp(contentWidth - mmPos, 0, contentWidth - leftIndent - 5);
    } else if (event.altKey) {
      nextLeft = clamp(mmPos, 0, contentWidth - rightIndent - 5);
      nextFirstLine = clamp(firstLineIndent, -nextLeft, contentWidth - nextLeft - nextRight - 2);
    } else {
      nextFirstLine = clamp(mmPos - leftIndent, -leftIndent, contentWidth - leftIndent - rightIndent - 2);
    }

    setLeftIndent(nextLeft);
    setFirstLineIndent(nextFirstLine);
    setRightIndent(nextRight);
    applyToParagraph(nextLeft, nextFirstLine, nextRight);
  };

  const ticks = [];
  for (let mm = 0; mm <= contentWidth; mm += 5) {
    const isMajor = mm % 10 === 0;
    const isLabel = mm % 20 === 0;
    ticks.push(
      <div
        key={mm}
        style={{
          position: 'absolute',
          left: `${(mm / contentWidth) * 100}%`,
          top: 0,
          height: isMajor ? 18 : 10,
          borderLeft: `1px solid ${isMajor ? '#7a8699' : '#a8b0bd'}`,
        }}
      >
        {isLabel ? (
          <span
            style={{
              position: 'absolute',
              top: 18,
              left: 2,
              fontSize: 9,
              color: '#5b6472',
              whiteSpace: 'nowrap',
            }}
          >
            {mm / 10}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        height: 66,
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
        borderBottom: '1px solid #d0d7e2',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.7)',
      }}
    >
      <div
        style={{
          width: `${pageWidth * zoom}mm`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#4b5563',
          padding: '0 8px',
          boxSizing: 'border-box',
        }}
      >
        <span>{`左缩进：${formatMmLabel(leftIndent)}`}</span>
        <span>{`首行缩进：${formatMmLabel(firstLineIndent)}`}</span>
        <span>{`右缩进：${formatMmLabel(rightIndent)}`}</span>
      </div>

      <div
        ref={rulerRef}
        onClick={applyQuickIndent}
        style={{
          width: `${pageWidth * zoom}mm`,
          height: 36,
          background: '#e7ebf1',
          position: 'relative',
          cursor: dragging ? 'grabbing' : 'default',
          overflow: 'hidden',
          borderRadius: 8,
          border: '1px solid #cfd6e1',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.85)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${contentLeftPct}%`,
            background: 'repeating-linear-gradient(135deg, #dde3eb 0, #dde3eb 8px, #e6ebf2 8px, #e6ebf2 16px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: `${contentRightPct}%`,
            background: 'repeating-linear-gradient(135deg, #dde3eb 0, #dde3eb 8px, #e6ebf2 8px, #e6ebf2 16px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${contentLeftPct}%`,
            right: `${contentRightPct}%`,
            background: 'linear-gradient(180deg, #ffffff 0%, #f9fbfd 100%)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 2,
            left: 8,
            fontSize: 10,
            color: '#64748b',
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          页边距
        </div>
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: `${contentLeftPct + 1.5}%`,
            fontSize: 10,
            color: '#334155',
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          正文区
        </div>

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `${contentLeftPct}%`,
            right: `${contentRightPct}%`,
            bottom: 0,
          }}
        >
          {ticks}
        </div>

        {dragBubble ? (
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: `${dragBubble.leftPct}%`,
              transform: 'translateX(-50%)',
              background: '#1677ff',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
              boxShadow: '0 8px 16px rgba(22,119,255,0.18)',
              whiteSpace: 'nowrap',
              zIndex: 5,
            }}
          >
            {dragBubble.label}
          </div>
        ) : null}

        <div
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragging('first');
            updateBubble('first', leftIndent, firstLineIndent, rightIndent);
          }}
          style={{
            position: 'absolute',
            top: 9,
            left: `${firstLineMarkerPct}%`,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `10px solid ${dragging === 'first' ? '#1677ff' : '#1f2937'}`,
            cursor: 'grab',
            zIndex: 3,
            transform: 'translateX(-50%)',
          }}
          title="首行缩进"
        />

        <div
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragging('hanging');
            updateBubble('hanging', leftIndent, firstLineIndent, rightIndent);
          }}
          style={{
            position: 'absolute',
            bottom: 4,
            left: `${leftMarkerPct}%`,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: `10px solid ${dragging === 'hanging' ? '#1677ff' : '#475569'}`,
            cursor: 'grab',
            zIndex: 3,
            transform: 'translateX(-50%)',
          }}
          title="悬挂缩进"
        />

        <div
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragging('left');
            updateBubble('left', leftIndent, firstLineIndent, rightIndent);
          }}
          style={{
            position: 'absolute',
            top: 16,
            left: `${leftMarkerPct}%`,
            width: 10,
            height: 10,
            background: dragging === 'left' ? '#1677ff' : '#475569',
            borderRadius: '0 2px 2px 0',
            cursor: 'grab',
            zIndex: 2,
          }}
          title="左缩进"
        />

        <div
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragging('right');
            updateBubble('right', leftIndent, firstLineIndent, rightIndent);
          }}
          style={{
            position: 'absolute',
            top: 16,
            left: `${rightMarkerPct}%`,
            width: 10,
            height: 10,
            background: dragging === 'right' ? '#1677ff' : '#475569',
            borderRadius: '2px 0 0 2px',
            cursor: 'grab',
            zIndex: 2,
            transform: 'translateX(-100%)',
          }}
          title="右缩进"
        />
      </div>

      <div
        style={{
          width: `${pageWidth * zoom}mm`,
          padding: '0 8px',
          boxSizing: 'border-box',
          fontSize: 10,
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>单击正文区：设置首行缩进</span>
        <span>Alt + 单击：设置左缩进</span>
        <span>Shift + 单击：设置右缩进</span>
      </div>
    </div>
  );
}
