import type { Node as ProseMirrorNode } from 'prosemirror-model';

export type DocumentReferenceKind = 'heading' | 'image' | 'table';

interface BaseReferenceTarget {
  id: string;
  kind: DocumentReferenceKind;
  text: string;
  label: string;
  preview: string;
  anchorId: string;
  page: number;
  pos: number;
  order: number;
}

export interface HeadingReferenceTarget extends BaseReferenceTarget {
  kind: 'heading';
  level: number;
  sectionNumber: string;
}

export interface CaptionReferenceTarget extends BaseReferenceTarget {
  kind: 'image' | 'table';
  numberLabel: string;
  sectionNumber: string;
}

export interface TocOptions {
  title: string;
  levels: number[];
  withPageNumbers: boolean;
}

export interface TocEntryData {
  level: number;
  label: string;
  anchorId: string;
  page: number;
}

export interface DocumentReferenceSummary {
  headings: HeadingReferenceTarget[];
  images: CaptionReferenceTarget[];
  tables: CaptionReferenceTarget[];
}

const PAGE_POSITION_ESTIMATE = 1500;
const CAPTION_PREFIX = {
  image: '图',
  table: '表',
} as const;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function createSlug(text: string): string {
  return encodeURIComponent(normalizeText(text).slice(0, 80).toLowerCase() || 'item');
}

export function createDocumentAnchorId(kind: DocumentReferenceKind, text: string): string {
  return `${kind}-anchor-${createSlug(text)}`;
}

function createTargetId(kind: DocumentReferenceKind, order: number, text: string): string {
  return `${kind}-${order}-${createSlug(text)}`;
}

function estimatePage(pos: number): number {
  return Math.max(1, Math.ceil(Math.max(pos, 1) / PAGE_POSITION_ESTIMATE));
}

function stripCaptionPrefix(kind: 'image' | 'table', text: string): string {
  const prefix = CAPTION_PREFIX[kind];
  return normalizeText(text).replace(new RegExp(`^${prefix}\\s*[0-9]+(?:\\.[0-9]+)*\\s*`), '').trim();
}

function extractCaptionNumber(kind: 'image' | 'table', text: string): string | null {
  const prefix = CAPTION_PREFIX[kind];
  const match = normalizeText(text).match(new RegExp(`^${prefix}\\s*([0-9]+(?:\\.[0-9]+)*)`));
  return match?.[1] ?? null;
}

function getSectionCountersLabel(counters: number[], level: number) {
  return counters.slice(0, level).join('.');
}

function getCurrentSectionNumber(counters: number[]) {
  const active = counters.filter((value, index) => index === 0 || counters[index - 1] > 0);
  return active.length > 0 ? active.join('.') : '1';
}

function buildSectionCaptionNumber(sectionNumber: string, index: number) {
  return `${sectionNumber}.${index}`;
}

export function buildCaptionText(kind: 'image' | 'table', numberLabel: string, captionText: string): string {
  const prefix = CAPTION_PREFIX[kind];
  const normalizedCaption = stripCaptionPrefix(kind, captionText) || (kind === 'image' ? '图片标题' : '表格标题');
  return `${prefix} ${numberLabel} ${normalizedCaption}`;
}

function createHeadingReference(
  order: number,
  level: number,
  sectionNumber: string,
  text: string,
  pos: number
): HeadingReferenceTarget {
  const normalizedText = normalizeText(text);
  return {
    id: createTargetId('heading', order, normalizedText),
    kind: 'heading',
    level,
    order,
    sectionNumber,
    text: normalizedText,
    label: `${sectionNumber} ${normalizedText}`,
    preview: `见 ${sectionNumber} ${normalizedText}`,
    anchorId: createDocumentAnchorId('heading', normalizedText),
    page: estimatePage(pos),
    pos,
  };
}

function createCaptionReference(
  kind: 'image' | 'table',
  order: number,
  sectionNumber: string,
  text: string,
  pos: number,
  providedNumber?: string
): CaptionReferenceTarget {
  const normalizedText = normalizeText(text);
  const numberLabel = providedNumber ?? extractCaptionNumber(kind, normalizedText) ?? buildSectionCaptionNumber(sectionNumber, order);
  const label = buildCaptionText(kind, numberLabel, normalizedText);

  return {
    id: createTargetId(kind, order, label),
    kind,
    order,
    sectionNumber,
    text: label,
    label,
    preview: `见${label}`,
    anchorId: createDocumentAnchorId(kind, label),
    numberLabel,
    page: estimatePage(pos),
    pos,
  };
}

export function extractDocumentReferences(doc: ProseMirrorNode): DocumentReferenceSummary {
  const headings: HeadingReferenceTarget[] = [];
  const images: CaptionReferenceTarget[] = [];
  const tables: CaptionReferenceTarget[] = [];
  const headingCounters = [0, 0, 0];
  const imageCountersBySection = new Map<string, number>();
  const tableCountersBySection = new Map<string, number>();
  let headingOrder = 0;
  let imageOrder = 0;
  let tableOrder = 0;
  let currentSectionNumber = '1';

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const text = normalizeText(node.textContent);
      if (!text) return;

      const level = Math.min(3, Math.max(1, Number(node.attrs.level ?? 1)));
      headingCounters[level - 1] += 1;
      for (let index = level; index < headingCounters.length; index += 1) {
        headingCounters[index] = 0;
      }

      currentSectionNumber = getSectionCountersLabel(headingCounters, level);
      headingOrder += 1;
      headings.push(createHeadingReference(headingOrder, level, currentSectionNumber, text, pos));
      return;
    }

    if (node.type.name === 'imagePlaceholder') {
      imageOrder += 1;
      const figureNumber = normalizeText(String(node.attrs.figureNumber ?? ''));
      const caption = normalizeText(String(node.attrs.caption ?? '图片标题'));
      const sectionKey = currentSectionNumber;
      const nextIndex = (imageCountersBySection.get(sectionKey) ?? 0) + 1;
      imageCountersBySection.set(sectionKey, nextIndex);
      images.push(createCaptionReference('image', imageOrder, sectionKey, caption, pos, figureNumber || buildSectionCaptionNumber(sectionKey, nextIndex)));
      return;
    }

    if (node.type.name === 'tablePlaceholder') {
      tableOrder += 1;
      const tableNumber = normalizeText(String(node.attrs.tableNumber ?? ''));
      const caption = normalizeText(String(node.attrs.caption ?? '表格标题'));
      const sectionKey = currentSectionNumber;
      const nextIndex = (tableCountersBySection.get(sectionKey) ?? 0) + 1;
      tableCountersBySection.set(sectionKey, nextIndex);
      tables.push(createCaptionReference('table', tableOrder, sectionKey, caption, pos, tableNumber || buildSectionCaptionNumber(sectionKey, nextIndex)));
      return;
    }

    if (node.type.name !== 'paragraph') {
      return;
    }

    const text = normalizeText(node.textContent);
    if (!text) return;

    const className = String(node.attrs?.class ?? '');
    const styleName = String(node.attrs?.styleName ?? '');
    const sectionKey = currentSectionNumber;

    if (className === 'image-text' || styleName === 'Caption') {
      const nextIndex = (imageCountersBySection.get(sectionKey) ?? 0) + 1;
      const detectedNumber = extractCaptionNumber('image', text);
      if (detectedNumber) {
        imageCountersBySection.set(sectionKey, nextIndex);
        imageOrder += 1;
        images.push(createCaptionReference('image', imageOrder, sectionKey, text, pos, detectedNumber));
      }
      return;
    }

    if (className === 'table-text' || styleName === 'TableCaption') {
      const nextIndex = (tableCountersBySection.get(sectionKey) ?? 0) + 1;
      const detectedNumber = extractCaptionNumber('table', text);
      if (detectedNumber) {
        tableCountersBySection.set(sectionKey, nextIndex);
        tableOrder += 1;
        tables.push(createCaptionReference('table', tableOrder, sectionKey, text, pos, detectedNumber));
      }
    }
  });

  return { headings, images, tables };
}

export function getSectionNumberAtPos(doc: ProseMirrorNode, pos: number): string {
  const headingCounters = [0, 0, 0];
  let currentSectionNumber = '1';

  doc.descendants((node, nodePos) => {
    if (nodePos > pos) {
      return false;
    }

    if (node.type.name !== 'heading') {
      return;
    }

    const level = Math.min(3, Math.max(1, Number(node.attrs.level ?? 1)));
    headingCounters[level - 1] += 1;
    for (let index = level; index < headingCounters.length; index += 1) {
      headingCounters[index] = 0;
    }
    currentSectionNumber = getSectionCountersLabel(headingCounters, level);
  });

  return currentSectionNumber;
}

export function getNextCaptionNumber(doc: ProseMirrorNode, kind: 'image' | 'table', pos?: number): string {
  const summary = extractDocumentReferences(doc);
  const targets = kind === 'image' ? summary.images : summary.tables;
  const currentSection = typeof pos === 'number' ? getSectionNumberAtPos(doc, pos) : summary.headings.at(-1)?.sectionNumber ?? '1';
  const sectionTargets = targets.filter((target) => target.sectionNumber === currentSection);
  return buildSectionCaptionNumber(currentSection, sectionTargets.length + 1);
}

export function buildTocHtml(doc: ProseMirrorNode, options: TocOptions): string | null {
  const headings = extractDocumentReferences(doc).headings.filter((heading) => options.levels.includes(heading.level));
  if (headings.length === 0) {
    return null;
  }

  let toc = `<div class="toc-block" data-generated="true" data-toc-title="${options.title}"><h1 style="text-align:center">${options.title}</h1>`;
  toc += '<p>&nbsp;</p>';

  for (const heading of headings) {
    const indent = '&emsp;'.repeat(Math.max(heading.level - 1, 0));
    const fontSize = heading.level === 1 ? '16pt' : heading.level === 2 ? '14pt' : '12pt';
    toc += `<p class="toc-entry" data-toc-level="${heading.level}" data-toc-target="${heading.anchorId}" style="font-size:${fontSize};margin:4px 0;text-indent:0">${indent}<a href="#${heading.anchorId}" style="color:inherit;text-decoration:none">${heading.label}</a>${options.withPageNumbers ? `<span style="float:right;color:#999">${heading.page}</span>` : ''}</p>`;
  }

  toc += '</div>';
  return toc;
}

export function buildTocEntries(doc: ProseMirrorNode, options: TocOptions): TocEntryData[] {
  return extractDocumentReferences(doc)
    .headings.filter((heading) => options.levels.includes(heading.level))
    .map((heading) => ({
      level: heading.level,
      label: heading.label,
      anchorId: heading.anchorId,
      page: heading.page,
    }));
}
