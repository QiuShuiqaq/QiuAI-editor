import type { Editor } from '@tiptap/core';
import type { LayoutBreak, LayoutComputationResult, LayoutMeasurementSnapshot, LayoutPageMetrics } from './layoutCore';

const HEADING_KEEP_WITH_NEXT_SELECTORS = new Set(['H1', 'H2', 'H3']);
const CAPTION_SELECTORS = new Set(['image-text', 'table-text']);
const ATOMIC_BLOCK_SELECTORS = new Set(['image-placeholder-node', 'table-placeholder-node', 'toc-block']);

function normalizeBreakHeight(height: number) {
  return Math.max(0, Math.round(height));
}

function pushNormalizedBreak(
  breaks: LayoutBreak[],
  nextBreak: LayoutBreak
) {
  const normalizedHeight = normalizeBreakHeight(nextBreak.height);
  if (normalizedHeight <= 0) {
    return 0;
  }

  const previous = breaks[breaks.length - 1];
  if (previous && previous.pos === nextBreak.pos && previous.kind === nextBreak.kind) {
    previous.height = normalizedHeight;
    return normalizedHeight;
  }

  breaks.push({
    ...nextBreak,
    height: normalizedHeight,
  });
  return normalizedHeight;
}

function sumBreakHeight(breaks: LayoutBreak[], startPos: number, endPos?: number) {
  return breaks.reduce((sum, item) => {
    if (item.pos < startPos) {
      return sum;
    }

    if (typeof endPos === 'number' && item.pos >= endPos) {
      return sum;
    }

    return sum + item.height;
  }, 0);
}

function sumBreakHeightBeforeOrAt(breaks: LayoutBreak[], pos: number) {
  return breaks.reduce((sum, item) => {
    if (item.pos > pos) {
      return sum;
    }

    return sum + item.height;
  }, 0);
}

function hasClassName(element: HTMLElement, className: string) {
  return element.classList.contains(className);
}

function isHeadingBlock(element: HTMLElement) {
  return HEADING_KEEP_WITH_NEXT_SELECTORS.has(element.tagName);
}

function isCaptionBlock(element: HTMLElement) {
  return Array.from(CAPTION_SELECTORS).some((className) => hasClassName(element, className));
}

function isAtomicBlock(element: HTMLElement) {
  return Array.from(ATOMIC_BLOCK_SELECTORS).some((className) => hasClassName(element, className));
}

function isTableBlock(element: HTMLElement) {
  return element.tagName === 'TABLE' || element.querySelector('table') !== null;
}

function shouldKeepWithNext(element: HTMLElement) {
  return isHeadingBlock(element) || isCaptionBlock(element);
}

function canSplitByLine(element: HTMLElement) {
  if (isAtomicBlock(element) || isTableBlock(element) || element.tagName === 'UL' || element.tagName === 'OL') {
    return false;
  }

  return true;
}

export function computeDocumentLayout(
  editor: Editor,
  snapshot: LayoutMeasurementSnapshot,
  metrics: LayoutPageMetrics
): LayoutComputationResult {
  if (snapshot.blocks.length === 0) {
    return {
      pageCount: 1,
      breaks: [],
      contentHeightMm: metrics.pageHeightMm,
    };
  }

  const breaks: LayoutBreak[] = [];
  let contentBottom = 0;
  let computedBreakOffset = 0;

  for (let index = 0; index < snapshot.blocks.length; index += 1) {
    const block = snapshot.blocks[index];
    const intrinsicBreakHeight = sumBreakHeightBeforeOrAt(snapshot.existingBreaks, block.pos);
    const naturalBlockTop = block.offsetTop - intrinsicBreakHeight;
    let blockTop = naturalBlockTop + computedBreakOffset;
    const blockHeight = block.offsetHeight;
    const nextBlock = snapshot.blocks[index + 1];
    const nextIntrinsicBreakHeight = nextBlock ? sumBreakHeightBeforeOrAt(snapshot.existingBreaks, nextBlock.pos) : 0;
    const nextBlockTop = nextBlock ? nextBlock.offsetTop - nextIntrinsicBreakHeight + computedBreakOffset : null;
    const nextBlockHeight = nextBlock?.offsetHeight ?? 0;
    const pageIndex = Math.max(0, Math.floor(blockTop / metrics.pageHeightPx));
    const pageContentEnd = pageIndex * metrics.pageHeightPx + metrics.contentHeightPx;
    const nextPageStart = (pageIndex + 1) * metrics.pageHeightPx;

    if (shouldKeepWithNext(block.dom) && nextBlock && nextBlockTop !== null) {
      const groupHeight = nextBlockTop + nextBlockHeight - blockTop;
      if (blockTop < pageContentEnd && blockTop + groupHeight > pageContentEnd && groupHeight <= metrics.contentHeightPx) {
        const extraOffset = Math.max(0, nextPageStart - blockTop);
        const appliedOffset = pushNormalizedBreak(breaks, { pos: block.pos, height: extraOffset, kind: 'block' });
        if (appliedOffset > 0) {
          computedBreakOffset += appliedOffset;
          blockTop += appliedOffset;
          contentBottom = Math.max(contentBottom, blockTop + groupHeight);
          continue;
        }
      }
    }

    const startsInsideDeadZone = blockTop >= pageContentEnd;
    const crossesPageBoundary = blockTop < pageContentEnd && blockTop + blockHeight > pageContentEnd;
    const shouldPushWholeBlock =
      startsInsideDeadZone ||
      ((isAtomicBlock(block.dom) || isTableBlock(block.dom) || !canSplitByLine(block.dom)) && crossesPageBoundary) ||
      (crossesPageBoundary && blockHeight <= metrics.contentHeightPx * 0.96);

    if (shouldPushWholeBlock) {
      const extraOffset = Math.max(0, nextPageStart - blockTop);
      const appliedOffset = pushNormalizedBreak(breaks, { pos: block.pos, height: extraOffset, kind: 'block' });
      computedBreakOffset += appliedOffset;
      blockTop += appliedOffset;
      contentBottom = Math.max(contentBottom, blockTop + blockHeight);
      continue;
    }

    contentBottom = Math.max(contentBottom, blockTop + blockHeight);
  }

  return {
    pageCount: Math.max(1, Math.ceil((contentBottom + metrics.pageBottomMarginPx) / metrics.pageHeightPx)),
    breaks,
    contentHeightMm: Math.max(metrics.pageHeightMm, Math.ceil(contentBottom / (metrics.pageHeightPx / metrics.pageHeightMm))),
  };
}
