import type { Editor } from '@tiptap/core';
import type { PageLayoutSettings } from '@qiuai/shared';

const A4_PORTRAIT = { width: 210, height: 297 };
const A4_LANDSCAPE = { width: 297, height: 210 };
const MM_TO_PX = 96 / 25.4;

export type LayoutBreakKind = 'block' | 'line';

export interface LayoutBreak {
  pos: number;
  height: number;
  kind: LayoutBreakKind;
}

export interface LayoutBlockSnapshot {
  pos: number;
  nodeSize: number;
  offsetTop: number;
  offsetHeight: number;
  dom: HTMLElement;
}

export interface LayoutMeasurementSnapshot {
  rootTop: number;
  blocks: LayoutBlockSnapshot[];
  existingBreaks: LayoutBreak[];
}

export interface LayoutPageMetrics {
  pageWidthMm: number;
  pageHeightMm: number;
  contentHeightMm: number;
  pageHeightPx: number;
  contentHeightPx: number;
  pageBottomMarginPx: number;
}

export interface LayoutComputationResult {
  pageCount: number;
  breaks: LayoutBreak[];
  contentHeightMm: number;
}

export function getPageMetrics(layout: PageLayoutSettings, zoom: number): LayoutPageMetrics {
  const page = layout.orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
  const contentHeightMm = page.height - layout.margins.top - layout.margins.bottom;

  return {
    pageWidthMm: page.width,
    pageHeightMm: page.height,
    contentHeightMm,
    pageHeightPx: Math.max(page.height * zoom * MM_TO_PX, 1),
    contentHeightPx: Math.max(contentHeightMm * zoom * MM_TO_PX, 1),
    pageBottomMarginPx: Math.max(layout.margins.bottom * zoom * MM_TO_PX, 1),
  };
}

export function readExistingLayoutBreaks(root: HTMLElement): LayoutBreak[] {
  const elements = Array.from(root.querySelectorAll('[data-page-flow-break]')).filter(
    (element): element is HTMLElement => element instanceof HTMLElement
  );

  return elements
    .map((element) => {
      const pos = Number.parseInt(element.getAttribute('data-page-flow-pos') ?? '', 10);
      const height = Number.parseFloat(element.getAttribute('data-page-flow-height') ?? '');
      const kind = element.getAttribute('data-page-flow-kind') === 'line' ? 'line' : 'block';

      if (!Number.isFinite(pos) || !Number.isFinite(height) || height <= 0) {
        return null;
      }

      return { pos, height, kind } satisfies LayoutBreak;
    })
    .filter((item): item is LayoutBreak => item !== null);
}

export function sumLayoutBreakHeight(breaks: LayoutBreak[], startPos: number, endPos?: number) {
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

export function captureLayoutSnapshot(editor: Editor, root: HTMLElement): LayoutMeasurementSnapshot {
  const domBlocks = Array.from(root.children).filter(
    (element): element is HTMLElement => element instanceof HTMLElement
  );
  const blocks: LayoutBlockSnapshot[] = [];
  let pos = 0;

  editor.state.doc.forEach((node, _offset, index) => {
    const dom = domBlocks[index];
    if (!(dom instanceof HTMLElement)) {
      pos += node.nodeSize;
      return;
    }

    blocks.push({
      pos,
      nodeSize: node.nodeSize,
      offsetTop: dom.offsetTop,
      offsetHeight: dom.offsetHeight,
      dom,
    });

    dom.dataset.nodePos = String(pos);
    dom.dataset.nodeSize = String(node.nodeSize);
    pos += node.nodeSize;
  });

  return {
    rootTop: root.getBoundingClientRect().top,
    blocks,
    existingBreaks: readExistingLayoutBreaks(root),
  };
}

export function syncBlockNodeMetadata(editor: Editor) {
  const root = editor.view.dom;

  Array.from(root.children).forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    try {
      const pos = editor.view.posAtDOM(element, 0);
      const node = editor.state.doc.nodeAt(pos);
      element.dataset.nodePos = String(pos);
      if (node) {
        element.dataset.nodeSize = String(node.nodeSize);
      } else {
        delete element.dataset.nodeSize;
      }
    } catch {
      delete element.dataset.nodePos;
      delete element.dataset.nodeSize;
    }
  });
}
