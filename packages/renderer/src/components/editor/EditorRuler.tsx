import { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';

const MM_PER_INCH = 25.4;
const A4_WIDTH_MM = 210;
const MARGIN_LEFT_MM = 31.7;
const MARGIN_RIGHT_MM = 31.7;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_LEFT_MM - MARGIN_RIGHT_MM;
const DEFAULT_FIRST_LINE_MM = 7.4; // ~2 Chinese chars at 16pt

export function EditorRuler() {
  const editor = useEditorStore((s) => s.editor);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [leftIndent, setLeftIndent] = useState(0);
  const [firstLineIndent, setFirstLineIndent] = useState(DEFAULT_FIRST_LINE_MM);
  const [rightIndent, setRightIndent] = useState(0);
  const [dragging, setDragging] = useState<'left' | 'first' | 'right' | 'hanging' | null>(null);

  const applyToParagraph = useCallback(() => {
    if (!editor) return;
    const indentPt = firstLineIndent > 0
      ? `${(firstLineIndent / MM_PER_INCH * 72).toFixed(1)}pt`
      : `${(-firstLineIndent / MM_PER_INCH * 72).toFixed(1)}pt`;
    const leftPt = leftIndent > 0 ? `${(leftIndent / MM_PER_INCH * 72).toFixed(1)}pt` : null;
    const rightPt = rightIndent > 0 ? `${(rightIndent / MM_PER_INCH * 72).toFixed(1)}pt` : null;

    editor.chain().focus().setParagraphAttrs({
      textIndent: firstLineIndent !== 0 ? indentPt : null,
      marginLeft: leftPt,
      marginRight: rightPt,
    }).run();
  }, [editor, firstLineIndent, leftIndent, rightIndent]);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!rulerRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const contentLeft = (MARGIN_LEFT_MM / A4_WIDTH_MM) * rect.width;
      const contentRight = ((A4_WIDTH_MM - MARGIN_RIGHT_MM) / A4_WIDTH_MM) * rect.width;
      const contentWidth = contentRight - contentLeft;
      const mmPerPx = CONTENT_WIDTH_MM / contentWidth;
      const xInContent = e.clientX - rect.left - contentLeft;
      const mmPos = Math.max(0, Math.min(CONTENT_WIDTH_MM, xInContent * mmPerPx));

      switch (dragging) {
        case 'left':
          setLeftIndent(Math.min(mmPos, CONTENT_WIDTH_MM - rightIndent - 5));
          break;
        case 'first':
          setFirstLineIndent(Math.max(-leftIndent, Math.min(mmPos - leftIndent, CONTENT_WIDTH_MM - leftIndent - rightIndent - 2)));
          break;
        case 'right':
          setRightIndent(Math.max(0, Math.min(CONTENT_WIDTH_MM - mmPos, CONTENT_WIDTH_MM - leftIndent - 5)));
          break;
        case 'hanging':
          setLeftIndent(Math.max(mmPos, 0));
          setFirstLineIndent(-mmPos);
          break;
      }
    };

    const handleMouseUp = () => {
      applyToParagraph();
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, leftIndent, rightIndent, firstLineIndent, applyToParagraph]);

  // Render mm tick marks
  const ticks = [];
  for (let mm = 0; mm <= CONTENT_WIDTH_MM; mm += 10) {
    const isMajor = mm % 30 === 0;
    ticks.push(
      <div key={mm} style={{
        position: 'absolute', left: `${(mm / CONTENT_WIDTH_MM) * 100}%`,
        top: 0, height: isMajor ? 16 : 8, borderLeft: '1px solid #999',
      }}>
        {isMajor && <span style={{ position: 'absolute', top: 16, left: 2, fontSize: 8, color: '#666', whiteSpace: 'nowrap' }}>{mm}mm</span>}
      </div>
    );
  }

  // Left edge of content area (page margin indicator)
  const contentLeftPct = (MARGIN_LEFT_MM / A4_WIDTH_MM) * 100;
  const contentRightPct = (MARGIN_RIGHT_MM / A4_WIDTH_MM) * 100;

  // Marker positions in % of ruler width
  const leftMarkerPct = contentLeftPct + ((leftIndent / CONTENT_WIDTH_MM) * (100 - contentLeftPct - contentRightPct));
  const firstLineMarkerPct = contentLeftPct + (((leftIndent + Math.max(0, firstLineIndent)) / CONTENT_WIDTH_MM) * (100 - contentLeftPct - contentRightPct));
  const rightMarkerPct = 100 - contentRightPct - ((rightIndent / CONTENT_WIDTH_MM) * (100 - contentLeftPct - contentRightPct));

  return (
    <div style={{ height: 24, background: '#f0f0f0', borderBottom: '1px solid #d0d0d0', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
      <div ref={rulerRef} style={{
        width: '210mm', height: '100%', background: '#e8e8e8', position: 'relative', cursor: dragging ? 'grabbing' : 'default', overflow: 'hidden',
      }}>
        {/* White content area on ruler */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${contentLeftPct}%`, right: `${contentRightPct}%`, background: '#fff' }} />

        {/* Tick marks */}
        <div style={{ position: 'absolute', top: 0, left: `${contentLeftPct}%`, right: `${contentRightPct}%`, bottom: 0 }}>{ticks}</div>

        {/* First-line indent triangle */}
        <div onMouseDown={(e) => { e.preventDefault(); setDragging('first'); }} style={{
          position: 'absolute', top: 2, left: `${firstLineMarkerPct}%`,
          width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '9px solid #333',
          cursor: 'grab', zIndex: 2, transform: 'translateX(-50%)',
        }} title="首行缩进" />

        {/* Hanging indent triangle (bottom half) */}
        <div onMouseDown={(e) => { e.preventDefault(); setDragging('hanging'); }} style={{
          position: 'absolute', bottom: 2, left: `${leftMarkerPct}%`,
          width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '9px solid #555',
          cursor: 'grab', zIndex: 2,
        }} title="悬挂缩进" />

        {/* Left indent box */}
        <div onMouseDown={(e) => { e.preventDefault(); setDragging('left'); }} style={{
          position: 'absolute', top: 11, left: `${leftMarkerPct}%`,
          width: 10, height: 10, background: '#555', borderRadius: '0 2px 2px 0',
          cursor: 'grab', zIndex: 1,
        }} title="左缩进" />

        {/* Right indent */}
        <div onMouseDown={(e) => { e.preventDefault(); setDragging('right'); }} style={{
          position: 'absolute', top: 11, left: `${rightMarkerPct}%`,
          width: 10, height: 10, background: '#555', borderRadius: '2px 0 0 2px',
          cursor: 'grab', zIndex: 1, transform: 'translateX(-100%)',
        }} title="右缩进" />
      </div>
    </div>
  );
}
