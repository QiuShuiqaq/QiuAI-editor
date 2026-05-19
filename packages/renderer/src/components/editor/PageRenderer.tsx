import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';

interface PageRendererProps {
  children: ReactNode;
}

const MM_TO_PX = 3.7795275591; // 1mm = ~3.78px at 96dpi
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_TOP_MM = 25.4;
const MARGIN_BOTTOM_MM = 25.4;
const MARGIN_LEFT_MM = 31.7;
const MARGIN_RIGHT_MM = 31.7;

const PAGE_WIDTH = A4_WIDTH_MM * MM_TO_PX;
const PAGE_HEIGHT = A4_HEIGHT_MM * MM_TO_PX;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_LEFT_MM + MARGIN_RIGHT_MM) * MM_TO_PX;
const CONTENT_HEIGHT = PAGE_HEIGHT - (MARGIN_TOP_MM + MARGIN_BOTTOM_MM) * MM_TO_PX;

export function PageRenderer({ children }: PageRendererProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordCount = useEditorStore((s) => s.wordCount);

  // Estimate pages based on word count (rough: ~500 Chinese chars per A4 page)
  useEffect(() => {
    const estimated = Math.max(1, Math.ceil(wordCount / 500));
    setTotalPages(estimated);
  }, [wordCount]);

  // Track scroll position to determine current page
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const pageHeightPx = CONTENT_HEIGHT;
    const page = Math.floor(scrollTop / pageHeightPx) + 1;
    setCurrentPage(Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflow: 'auto',
        background: '#e8e8e8',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        position: 'relative',
      }}
    >
      {/* Page background strips to simulate multiple pages */}
      {Array.from({ length: totalPages }, (_, i) => (
        <div
          key={i}
          style={{
            width: `${PAGE_WIDTH}px`,
            minHeight: `${PAGE_HEIGHT}px`,
            background: '#fff',
            boxShadow: i === currentPage - 1
              ? '0 2px 12px rgba(0,0,0,0.15)'
              : '0 1px 3px rgba(0,0,0,0.1)',
            padding: `${MARGIN_TOP_MM * MM_TO_PX}px ${MARGIN_RIGHT_MM * MM_TO_PX}px ${MARGIN_BOTTOM_MM * MM_TO_PX}px ${MARGIN_LEFT_MM * MM_TO_PX}px`,
            position: 'relative',
            transition: 'box-shadow 0.2s',
          }}
        >
          {/* Page number */}
          <div
            style={{
              position: 'absolute',
              bottom: MARGIN_BOTTOM_MM * MM_TO_PX / 2,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 10,
              color: '#999',
              lineHeight: 1,
            }}
          >
            — {i + 1} —
          </div>
        </div>
      ))}

      {/* Content overlay - positioned absolutely over the pages */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          width: `${PAGE_WIDTH}px`,
          padding: `${MARGIN_TOP_MM * MM_TO_PX}px ${MARGIN_RIGHT_MM * MM_TO_PX}px ${MARGIN_BOTTOM_MM * MM_TO_PX}px ${MARGIN_LEFT_MM * MM_TO_PX}px`,
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          {children}
        </div>
      </div>

      {/* Page navigator */}
      <div
        style={{
          position: 'fixed',
          right: 16,
          bottom: 48,
          background: '#fff',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          padding: '4px 8px',
          fontSize: 12,
          color: '#666',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          zIndex: 100,
        }}
      >
        第 {currentPage}/{totalPages} 页
      </div>
    </div>
  );
}
