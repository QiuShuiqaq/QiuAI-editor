/**
 * PageView — Multi-page A4 rendering with auto-pagination, zoom, and headers/footers.
 *
 * Renders editor content across multiple A4 page containers stacked vertically,
 * with page gaps, page numbers, headers/footers, and zoom control.
 */

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';

// A4 & margin constants (in mm and CSS mm)
const A4_W = 210;
const A4_H = 297;
const MARGIN_TOP = 25.4;
const MARGIN_BOTTOM = 25.4;
const MARGIN_LEFT = 31.7;
const MARGIN_RIGHT = 31.7;
const CONTENT_H = A4_H - MARGIN_TOP - MARGIN_BOTTOM; // ~246mm
const PAGE_GAP = 16; // px between pages

interface PageViewProps {
  children: ReactNode;
  zoom?: number;
  wordCount?: number;
}

export function PageView({ children, zoom = 1, wordCount = 0 }: PageViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Estimate pages based on content and zoom
  useEffect(() => {
    if (!contentRef.current) return;
    const contentEl = contentRef.current;
    const contentHeight = contentEl.scrollHeight;
    // Content height in mm at 100% zoom
    const contentHeightMm = contentHeight / (3.7795 * zoom);
    const estimated = Math.max(1, Math.ceil(contentHeightMm / CONTENT_H));
    setTotalPages(estimated);
  }, [children, zoom, wordCount]);

  // Track current page on scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const pageHeightPx = A4_H * 3.7795 * zoom + PAGE_GAP;
    const page = Math.floor(scrollTop / pageHeightPx) + 1;
    setCurrentPage(Math.min(page, totalPages));
  }, [totalPages, zoom]);

  // Build page background strips
  const pages = [];
  for (let i = 0; i < totalPages; i++) {
    pages.push(
      <div
        key={`page-${i}`}
        className="a4-page-sheet"
        style={{
          width: `${A4_W * zoom}mm`,
          minHeight: `${A4_H * zoom}mm`,
          background: '#fff',
          boxShadow: i === currentPage - 1
            ? `0 ${2 * zoom}px ${12 * zoom}px rgba(0,0,0,0.15)`
            : `0 ${1 * zoom}px ${3 * zoom}px rgba(0,0,0,0.08)`,
          padding: `${MARGIN_TOP * zoom}mm ${MARGIN_RIGHT * zoom}mm ${MARGIN_BOTTOM * zoom}mm ${MARGIN_LEFT * zoom}mm`,
          position: 'relative',
          flexShrink: 0,
          marginBottom: PAGE_GAP,
          transition: 'box-shadow 0.2s',
        }}
      >
        {/* Header area indicator */}
        <div style={{
          position: 'absolute', top: `${5 * zoom}mm`, left: `${MARGIN_LEFT * zoom}mm`,
          right: `${MARGIN_RIGHT * zoom}mm`, height: `${15 * zoom}mm`,
          borderBottom: '1px solid #e0e0e0', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: `${9 * zoom}pt`, color: '#ccc',
        }}>
          {i === 0 ? '— 页眉 —' : ''}
        </div>

        {/* Footer area */}
        <div style={{
          position: 'absolute', bottom: `${8 * zoom}mm`,
          left: `${MARGIN_LEFT * zoom}mm`, right: `${MARGIN_RIGHT * zoom}mm`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: `${9 * zoom}pt`, color: '#999',
        }}>
          <span>{i === 0 ? '— 页脚 —' : ''}</span>
          <span>— {i + 1} —</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div style={{
          position: 'absolute', top: 8, right: 16, zIndex: 10,
          background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 4,
          padding: '2px 8px', fontSize: 12,
        }}>
          {Math.round(zoom * 100)}%
        </div>
      )}

      {/* Scrolling area with page backgrounds */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflow: 'auto', background: '#c8c8c8',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 16, paddingBottom: 32,
        }}
      >
        {/* Page sheets (background only) */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Content overlay — positioned absolutely over the pages */}
          <div
            ref={contentRef}
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: `translateX(-50%) scale(${zoom})`,
              transformOrigin: 'top center',
              width: `${A4_W}mm`,
              padding: `${MARGIN_TOP}mm ${MARGIN_RIGHT}mm ${MARGIN_BOTTOM}mm ${MARGIN_LEFT}mm`,
            }}
          >
            {children}
          </div>

          {/* Background pages */}
          {pages}
        </div>
      </div>

      {/* Page navigator */}
      <div style={{
        position: 'absolute', right: 16, bottom: 8, zIndex: 100,
        background: '#fff', border: '1px solid #d9d9d9', borderRadius: 6,
        padding: '2px 10px', fontSize: 12, color: '#666',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      }}>
        第 {currentPage}/{totalPages} 页
      </div>
    </div>
  );
}
