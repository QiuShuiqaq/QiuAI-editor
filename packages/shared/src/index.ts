// IPC Channel Names
export const IPC_CHANNELS = {
  FILE_OPEN_DRAFT: 'file:open-draft',
  FILE_SAVE_DRAFT: 'file:save-draft',
  FILE_LIST_DRAFTS: 'file:list-drafts',
  FILE_DELETE_DRAFT: 'file:delete-draft',
  FILE_IMPORT_REFERENCE: 'file:import-reference',
  REFERENCE_IMPORT_DOI: 'reference:import-doi',
  AI_GENERATE_TEXT: 'ai:generate-text',
  AI_GENERATE_TEXT_STREAM: 'ai:generate-text-stream',
  AI_CHAT: 'ai:chat',
  AI_POLISH_TEXT: 'ai:polish-text',
  AI_GENERATE_IMAGE: 'ai:generate-image',
  AI_PROCESS_TABLE: 'ai:process-table',
  EXPORT_DOCX: 'export:docx',
  EXPORT_PDF: 'export:pdf',
} as const;

// Writing Phases
export enum WritingPhase {
  FRAMEWORK = 1,
  SLOTS = 2,
  TEXT_GEN = 3,
  IMAGES = 4,
  TABLES = 5,
  DONE = 6,
}

// Framework Node
export interface FrameworkNode {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  order: number;
  children: FrameworkNode[];
  needsImage: boolean;
  needsTable: boolean;
  dataKeywords: string[];
}

// Image Slot
export interface ImageSlot {
  id: string;
  sectionId: string;
  position: 'before' | 'after' | 'inline';
  state: 'empty' | 'ai-generated' | 'user-imported';
  imageData?: string;
  aiPrompt?: string;
  caption: string;
}

// Table Data
export interface TableData {
  headers: string[];
  rows: string[][];
}

// Table Slot
export interface TableSlot {
  id: string;
  sectionId: string;
  position: 'before' | 'after' | 'inline';
  state: 'empty' | 'data-bound';
  tableData?: TableData;
  style: 'three-line' | 'custom';
  caption: string;
}

// Slot Configurations
export interface SlotConfig {
  sectionId: string;
  imageSlots: ImageSlot[];
  tableSlots: TableSlot[];
}

// Reference Material
export interface ReferenceMaterial {
  id: string;
  fileName: string;
  filePath: string;
  fileType: 'pdf' | 'docx';
  chunks: TextChunk[];
}

export interface TextChunk {
  id: string;
  text: string;
  embedding?: number[];
  metadata: { page?: number; section?: string };
}

export type ReferenceSourceType =
  | 'journal-article'
  | 'conference-paper'
  | 'thesis'
  | 'book'
  | 'book-chapter'
  | 'report'
  | 'webpage'
  | 'dataset'
  | 'standard'
  | 'patent'
  | 'legislation'
  | 'other';

export type ReferenceSourceProvider = 'crossref' | 'datacite' | 'manual' | 'local-import' | 'other';

export interface ReferenceAuthor {
  family?: string;
  given?: string;
  literal?: string;
  orcid?: string;
  affiliation?: string;
}

export interface ReferenceSource {
  id: string;
  type: ReferenceSourceType;
  title: string;
  subtitle?: string;
  authors: ReferenceAuthor[];
  editors: ReferenceAuthor[];
  year?: string;
  issuedDate?: string;
  publisher?: string;
  containerTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  isbn?: string;
  issn?: string;
  language?: string;
  abstract?: string;
  keywords: string[];
  sourceProvider: ReferenceSourceProvider;
  sourceRaw?: Record<string, unknown>;
  localAttachmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type CitationStyleMode = 'author-date' | 'numeric' | 'footnote';

export interface CitationOccurrence {
  id: string;
  documentAnchorId?: string;
  from: number;
  to: number;
  sourceIds: string[];
  styleMode: CitationStyleMode;
  prefix?: string;
  suffix?: string;
  locator?: string;
  noteNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CitationStyleProfile {
  styleId: string;
  styleLabel: string;
  locale: string;
  citationMode: CitationStyleMode;
  sortMode: 'citation-order' | 'author-year' | 'alphabetical';
  bibliographyTitle: string;
}

export type ClaimType = 'fact' | 'data' | 'definition' | 'quote' | 'image-source' | 'table-source';

export type EvidenceRelevance = 'primary' | 'secondary';

export interface ClaimEvidenceSourceLink {
  sourceId: string;
  relevance: EvidenceRelevance;
  locator?: string;
  excerpt?: string;
}

export interface ClaimEvidenceLink {
  id: string;
  from: number;
  to: number;
  claimType: ClaimType;
  sourceLinks: ClaimEvidenceSourceLink[];
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FigureTableSourceLink {
  id: string;
  targetType: 'figure' | 'table';
  targetAnchorId: string;
  sourceIds: string[];
  captionText?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type AiAuthorshipActionType = 'generate' | 'rewrite' | 'polish' | 'expand' | 'summarize';

export type AiAcceptedMode =
  | 'preview-only'
  | 'applied-directly'
  | 'human-revised-after-apply'
  | 'rejected';

export interface AiAuthorshipRecord {
  id: string;
  from: number;
  to: number;
  actionType: AiAuthorshipActionType;
  provider: string;
  model: string;
  promptDigest?: string;
  acceptedMode: AiAcceptedMode;
  createdAt: string;
}

export type WritingSnapshotEventType =
  | 'manual-save'
  | 'auto-save'
  | 'ai-apply'
  | 'import-outline'
  | 'open-draft'
  | 'milestone';

export interface WritingSnapshot {
  id: string;
  createdAt: string;
  wordCount: number;
  pageCount: number;
  sectionSummaries: Array<{
    sectionId: string;
    title: string;
    summary: string;
  }>;
  editorContentDigest?: string;
  eventType: WritingSnapshotEventType;
}

export type PaperSafetyIssueSeverity = 'info' | 'warning' | 'error';

export type PaperSafetyIssueCategory =
  | 'uncited-claim'
  | 'data-without-source'
  | 'figure-without-source'
  | 'table-without-source'
  | 'incomplete-reference'
  | 'unused-reference'
  | 'style-inconsistency'
  | 'ai-transparency'
  | 'terminology-inconsistency'
  | 'evidence-weakness';

export interface PaperSafetyIssue {
  id: string;
  severity: PaperSafetyIssueSeverity;
  category: PaperSafetyIssueCategory;
  message: string;
  from?: number;
  to?: number;
  relatedSourceIds: string[];
  suggestion?: string;
}

export interface PaperSafetyReport {
  generatedAt: string;
  overallRisk: 'low' | 'medium' | 'high';
  citationCoverage: number;
  uncitedClaimCount: number;
  dataWithoutSourceCount: number;
  figureWithoutSourceCount: number;
  tableWithoutSourceCount: number;
  aiAssistedParagraphCount: number;
  issues: PaperSafetyIssue[];
}

// AI Configuration
export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  apiKey?: string;
  model: string;
  baseURL?: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

// AI Generation Request
export interface TextGenRequest {
  sectionId: string;
  sectionTitle: string;
  headingPath: string[];
  referenceChunks: TextChunk[];
  neighborSummaries: string[];
  documentPlan: string;
  dataKeywords: string[];
  aiConfig: AIConfig;
  existingPaperSpineMemory?: PaperSpineSectionMemory;
}

export interface TextGenChunk {
  requestId?: string;
  content: string;
  done: boolean;
  provider?: string;
  model?: string;
  error?: string;
  paperSpineEnhancement?: PaperSpineEnhancement;
  paperSpineSource?: 'reused' | 'generated';
}

export interface AIChatRequest {
  message: string;
  selectedText?: string;
  activeSectionTitle?: string;
  headingPath?: string[];
  documentTitle?: string;
  documentPlan?: string;
  documentText?: string;
  aiConfig: AIConfig;
}

export type AIChatAction =
  | {
      type: 'replace-selection';
      text: string;
      reason?: string;
    }
  | {
      type: 'append-after-selection';
      text: string;
      reason?: string;
    }
  | {
      type: 'insert-text';
      text: string;
      reason?: string;
    }
  | {
      type: 'replace-document';
      text: string;
      reason?: string;
    }
  | {
      type: 'execute-command';
      command: string;
      payload?: Record<string, unknown>;
      reason?: string;
    };

export interface AIChatResponse {
  message: string;
  actions: AIChatAction[];
}

export interface TextGenerationResult {
  content: string;
  provider: string;
  model: string;
  paperSpineEnhancement?: PaperSpineEnhancement;
  paperSpineSource?: 'reused' | 'generated';
}

export interface PaperSpineCitationSupport {
  chunkId: string;
  excerpt: string;
  relevance: 'primary' | 'secondary';
}

export interface PaperSpineRationaleEntry {
  claim: string;
  purpose: 'background' | 'problem' | 'method' | 'evidence' | 'impact';
  support: PaperSpineCitationSupport[];
}

export interface PaperSpineSectionBlueprint {
  sectionTitle: string;
  rhetoricalGoal: string;
  requiredClaims: string[];
  evidencePlan: string[];
  continuityNotes: string[];
  cautionNotes: string[];
}

export interface PaperSpineEnhancement {
  blueprint: PaperSpineSectionBlueprint;
  rationaleMatrix: PaperSpineRationaleEntry[];
  citationSupportBank: PaperSpineCitationSupport[];
  enhancedPromptAddendum: string;
}

export interface PaperSpineSectionMemory {
  sectionId: string;
  sectionTitle: string;
  enhancement: PaperSpineEnhancement;
  generatedAt: string;
}

// Polish Request
export interface PolishRequest {
  originalText: string;
  style: 'formal' | 'academic' | 'concise' | 'expand';
  aiConfig: AIConfig;
}

// Image Gen Request
export interface ImageGenRequest {
  prompt: string;
  style?: string;
  aiConfig: AIConfig;
}

// Table Process Request
export interface TableProcessRequest {
  csvData: string;
  headers: string[];
  expectedColumns?: string[];
  aiConfig: AIConfig;
}

// Draft Metadata
export interface DraftMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentPhase: number;
  wordCount: number;
  pageCount: number;
}

export interface DocumentGlossaryEntry {
  id: string;
  term: string;
  definition: string;
}

export interface DocumentFact {
  id: string;
  label: string;
  value: string;
  sourceChunkIds: string[];
  sourceReferenceIds?: string[];
  status: 'draft' | 'verified' | 'needs-review';
}

export interface ReviewIssue {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  sectionId?: string;
}

export interface SectionMemory {
  sectionId: string;
  title: string;
  summary: string;
  updatedAt: string;
}

export interface DocumentWritingProfile {
  preferredAuthorModel: string;
  styleNotes: string[];
  terminologyRules: string[];
}

export type DocumentAuthoringSourceKind = 'tiptap-json' | 'docx-file' | 'html-file';

export interface DocumentAuthoringSource {
  kind: DocumentAuthoringSourceKind;
  label: string;
  path?: string;
  updatedAt?: string;
}

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface DocumentMetadata {
  author: string;
  subject: string;
  keywords: string[];
}

export interface PageColumnSettings {
  count: 1 | 2 | 3;
  gap: number;
  separator: boolean;
}

export interface PageWatermarkSettings {
  enabled: boolean;
  text: string;
  color: string;
  opacity: number;
  rotation: number;
}

export interface PageBorderSettings {
  mode: 'none' | 'box' | 'shadow';
  color: string;
  width: number;
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'double';
}

export interface PageLayoutSettings {
  pageSize: 'A4';
  orientation: 'portrait' | 'landscape';
  margins: PageMargins;
  preset: 'normal' | 'narrow' | 'wide' | 'custom';
  headerOffset: number;
  footerOffset: number;
  headerText: string;
  footerText: string;
  firstPageHeaderText: string;
  firstPageFooterText: string;
  oddHeaderText: string;
  oddFooterText: string;
  evenHeaderText: string;
  evenFooterText: string;
  differentFirstPage: boolean;
  differentOddEven: boolean;
  columns: PageColumnSettings;
  watermark: PageWatermarkSettings;
  pageBorder: PageBorderSettings;
}

export type PageHeaderFooterMode = 'header' | 'footer';

export type PageHeaderFooterVariant = 'default' | 'first' | 'odd' | 'even';

export interface DocumentState {
  version: number;
  outline: FrameworkNode[];
  editorContent: Record<string, unknown>;
  authoringSource: DocumentAuthoringSource;
  documentMeta: DocumentMetadata;
  pageCount: number;
  slotAssignments: Record<string, SlotConfig>;
  referenceMaterials: ReferenceMaterial[];
  referenceSources: ReferenceSource[];
  citationOccurrences: CitationOccurrence[];
  citationStyle: CitationStyleProfile;
  claimEvidenceLinks: ClaimEvidenceLink[];
  figureTableSourceLinks: FigureTableSourceLink[];
  aiAuthorshipRecords: AiAuthorshipRecord[];
  writingSnapshots: WritingSnapshot[];
  paperSafetyReport: PaperSafetyReport | null;
  documentPlan: string;
  sectionSummaries: SectionMemory[];
  glossary: DocumentGlossaryEntry[];
  facts: DocumentFact[];
  reviewIssues: ReviewIssue[];
  trackRevisions: boolean;
  writingProfile: DocumentWritingProfile;
  pageLayout: PageLayoutSettings;
  paperSpineMemories: PaperSpineSectionMemory[];
}

// Core Document Model
export interface QiuAiDocument {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentPhase: WritingPhase;
  framework: FrameworkNode[];
  slotAssignments: Record<string, SlotConfig>;
  editorContent: Record<string, unknown>;
  referenceMaterials: ReferenceMaterial[];
  documentPlan: string;
  documentState: DocumentState;
}

export interface ExportRequest {
  doc: QiuAiDocument;
  suggestedFileName?: string;
}

export interface DocumentEngineSelectionSnapshot {
  selectedText: string;
  activePage: number;
}

export interface DocumentEngineWriteResult {
  applied: boolean;
  selectedText: string;
}

function nodeHasMeaningfulEditorContent(node: unknown): boolean {
  if (!node || typeof node !== 'object') {
    return false;
  }

  const candidate = node as {
    type?: string;
    text?: string;
    attrs?: Record<string, unknown>;
    content?: unknown[];
  };

  if (candidate.type === 'text') {
    return typeof candidate.text === 'string' && candidate.text.trim().length > 0;
  }

  if (
    candidate.type === 'image' ||
    candidate.type === 'imagePlaceholder' ||
    candidate.type === 'table' ||
    candidate.type === 'tablePlaceholder' ||
    candidate.type === 'tocBlock' ||
    candidate.type === 'auxiliaryBlock'
  ) {
    return true;
  }

  if (Array.isArray(candidate.content) && candidate.content.some((child) => nodeHasMeaningfulEditorContent(child))) {
    return true;
  }

  if (
    candidate.type === 'paragraph' &&
    candidate.attrs &&
    Object.values(candidate.attrs).some((value) => typeof value === 'string' && value.trim().length > 0)
  ) {
    return true;
  }

  return false;
}

export function hasMeaningfulEditorContent(content: unknown): boolean {
  if (!content || typeof content !== 'object') {
    return false;
  }

  const candidate = content as { type?: string; content?: unknown[] };
  if (candidate.type !== 'doc' || !Array.isArray(candidate.content) || candidate.content.length === 0) {
    return false;
  }

  return candidate.content.some((node) => nodeHasMeaningfulEditorContent(node));
}

export function resolvePageVariant(
  pageLayout: PageLayoutSettings,
  pageNumber: number
): PageHeaderFooterVariant {
  if (pageLayout.differentFirstPage && pageNumber === 1) {
    return 'first';
  }

  if (pageLayout.differentOddEven) {
    return pageNumber % 2 === 0 ? 'even' : 'odd';
  }

  return 'default';
}

export function resolvePageSlotField(
  mode: PageHeaderFooterMode,
  variant: PageHeaderFooterVariant
): keyof Pick<
  PageLayoutSettings,
  | 'headerText'
  | 'footerText'
  | 'firstPageHeaderText'
  | 'firstPageFooterText'
  | 'oddHeaderText'
  | 'oddFooterText'
  | 'evenHeaderText'
  | 'evenFooterText'
> {
  if (mode === 'header') {
    switch (variant) {
      case 'first':
        return 'firstPageHeaderText';
      case 'odd':
        return 'oddHeaderText';
      case 'even':
        return 'evenHeaderText';
      default:
        return 'headerText';
    }
  }

  switch (variant) {
    case 'first':
      return 'firstPageFooterText';
    case 'odd':
      return 'oddFooterText';
    case 'even':
      return 'evenFooterText';
    default:
      return 'footerText';
  }
}

export function resolvePageSlotText(
  pageLayout: PageLayoutSettings,
  mode: PageHeaderFooterMode,
  page: number | PageHeaderFooterVariant,
  fallback = ''
): string {
  const variant = typeof page === 'number' ? resolvePageVariant(pageLayout, page) : page;
  const primaryField = resolvePageSlotField(mode, variant);
  const fallbackField = resolvePageSlotField(mode, 'default');
  const primaryText = pageLayout[primaryField].trim();
  const fallbackText = pageLayout[fallbackField].trim();

  if (primaryText) {
    return primaryText;
  }

  if (variant !== 'default' && fallbackText) {
    return fallbackText;
  }

  return fallback;
}

export function createEmptyDocumentState(): DocumentState {
  return {
    version: 1,
    outline: [],
    editorContent: {},
    authoringSource: {
      kind: 'tiptap-json',
      label: '内置富文本草稿',
    },
    documentMeta: {
      author: '',
      subject: '',
      keywords: [],
    },
    pageCount: 1,
    slotAssignments: {},
    referenceMaterials: [],
    referenceSources: [],
    citationOccurrences: [],
    citationStyle: {
      styleId: 'gb-t-7714-2015-numeric',
      styleLabel: 'GB/T 7714',
      locale: 'zh-CN',
      citationMode: 'numeric',
      sortMode: 'citation-order',
      bibliographyTitle: '参考文献',
    },
    claimEvidenceLinks: [],
    figureTableSourceLinks: [],
    aiAuthorshipRecords: [],
    writingSnapshots: [],
    paperSafetyReport: null,
    documentPlan: '',
    sectionSummaries: [],
    glossary: [],
    facts: [],
    reviewIssues: [],
    trackRevisions: false,
    writingProfile: {
      preferredAuthorModel: 'deepseek-chat',
      styleNotes: [],
      terminologyRules: [],
    },
    pageLayout: {
      pageSize: 'A4',
      orientation: 'portrait',
      margins: {
        top: 25.4,
        bottom: 25.4,
        left: 31.7,
        right: 31.7,
      },
      preset: 'normal',
      headerOffset: 12.7,
      footerOffset: 12.7,
      headerText: '',
      footerText: '',
      firstPageHeaderText: '',
      firstPageFooterText: '',
      oddHeaderText: '',
      oddFooterText: '',
      evenHeaderText: '',
      evenFooterText: '',
      differentFirstPage: false,
      differentOddEven: false,
      columns: {
        count: 1,
        gap: 12,
        separator: false,
      },
      watermark: {
        enabled: false,
        text: '鑽夌',
        color: '#d0d0d0',
        opacity: 0.15,
        rotation: -30,
      },
      pageBorder: {
        mode: 'none',
        color: '#000000',
        width: 1,
        lineStyle: 'solid',
      },
    },
    paperSpineMemories: [],
  };
}

export function syncDocumentWithState(doc: QiuAiDocument): QiuAiDocument {
  const state = doc.documentState ?? createEmptyDocumentState();
  const defaultPageLayout = createEmptyDocumentState().pageLayout;

  const outline = doc.framework?.length ? doc.framework : state.outline;
  const editorContent = hasMeaningfulEditorContent(doc.editorContent)
    ? doc.editorContent
    : hasMeaningfulEditorContent(state.editorContent)
      ? state.editorContent
      : {};
  const authoringSource = state.authoringSource ?? createEmptyDocumentState().authoringSource;
  const documentMeta = {
    ...createEmptyDocumentState().documentMeta,
    ...(state.documentMeta ?? {}),
  };
  const pageCount =
    typeof state.pageCount === 'number' && Number.isFinite(state.pageCount)
      ? Math.max(1, Math.round(state.pageCount))
      : 1;
  const slotAssignments =
    doc.slotAssignments && Object.keys(doc.slotAssignments).length > 0
      ? doc.slotAssignments
      : state.slotAssignments;
  const referenceMaterials =
    doc.referenceMaterials?.length > 0 ? doc.referenceMaterials : state.referenceMaterials;
  const referenceSources = doc.documentState?.referenceSources ?? state.referenceSources ?? [];
  const citationOccurrences =
    doc.documentState?.citationOccurrences ?? state.citationOccurrences ?? [];
  const citationStyle = {
    ...createEmptyDocumentState().citationStyle,
    ...(state.citationStyle ?? {}),
  };
  const claimEvidenceLinks =
    doc.documentState?.claimEvidenceLinks ?? state.claimEvidenceLinks ?? [];
  const figureTableSourceLinks =
    doc.documentState?.figureTableSourceLinks ?? state.figureTableSourceLinks ?? [];
  const aiAuthorshipRecords =
    doc.documentState?.aiAuthorshipRecords ?? state.aiAuthorshipRecords ?? [];
  const writingSnapshots =
    doc.documentState?.writingSnapshots ?? state.writingSnapshots ?? [];
  const paperSafetyReport =
    doc.documentState?.paperSafetyReport ?? state.paperSafetyReport ?? null;
  const documentPlan = doc.documentPlan || state.documentPlan;

  return {
    ...doc,
    framework: outline,
    editorContent,
    slotAssignments,
    referenceMaterials,
    documentPlan,
    documentState: {
      ...state,
      outline,
      editorContent,
      authoringSource,
      documentMeta,
      pageCount,
      slotAssignments,
      referenceMaterials,
      referenceSources,
      citationOccurrences,
      citationStyle,
      claimEvidenceLinks,
      figureTableSourceLinks,
      aiAuthorshipRecords,
      writingSnapshots,
      paperSafetyReport,
      documentPlan,
      pageLayout: {
        ...defaultPageLayout,
        ...(state.pageLayout ?? {}),
        margins: {
          ...defaultPageLayout.margins,
          ...(state.pageLayout?.margins ?? {}),
        },
        columns: {
          ...defaultPageLayout.columns,
          ...(state.pageLayout?.columns ?? {}),
        },
        watermark: {
          ...defaultPageLayout.watermark,
          ...(state.pageLayout?.watermark ?? {}),
        },
        pageBorder: {
          ...defaultPageLayout.pageBorder,
          ...(state.pageLayout?.pageBorder ?? {}),
        },
      },
      paperSpineMemories: state.paperSpineMemories ?? [],
    },
  };
}

// IPC Response wrapper
export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Re-export utility functions
export { generateId, countWords, countChineseChars, formatDate, clamp } from './utils/index';
export { frameworkTreeEquals, parseOutlineText } from './outlineParser';
