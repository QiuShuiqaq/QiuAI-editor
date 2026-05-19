// IPC Channel Names
export const IPC_CHANNELS = {
  FILE_OPEN_DRAFT: 'file:open-draft',
  FILE_SAVE_DRAFT: 'file:save-draft',
  FILE_LIST_DRAFTS: 'file:list-drafts',
  FILE_DELETE_DRAFT: 'file:delete-draft',
  FILE_IMPORT_REFERENCE: 'file:import-reference',
  AI_GENERATE_TEXT: 'ai:generate-text',
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

// AI Configuration
export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  apiKey?: string;
  model: string;
  baseURL?: string;
  temperature: number;
  maxTokens: number;
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
}

export interface TextGenChunk {
  content: string;
  done: boolean;
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
}

// IPC Response wrapper
export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Re-export utility functions
export { generateId, countWords, countChineseChars, formatDate, clamp } from './utils/index';
