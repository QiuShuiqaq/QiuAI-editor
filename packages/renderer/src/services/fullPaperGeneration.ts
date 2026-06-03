import {
  generateId,
  syncDocumentWithState,
  WritingPhase,
  type AIConfig,
  type AiAuthorshipRecord,
  type FrameworkNode,
  type PaperSpineSectionMemory,
  type ReferenceMaterial,
  type SectionMemory,
} from '@qiuai/shared';
import { useDocumentEngineStore } from '../stores/useDocumentEngineStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useFrameworkStore } from '../stores/useFrameworkStore';
import { usePhaseStore } from '../stores/usePhaseStore';
import { useProjectStore } from '../stores/useProjectStore';
import { supportsDocumentCommands } from '../utils/documentEngineCapabilities';
import { streamGenerateText } from './aiClient';
import {
  chunkReferenceMaterial,
  contextFitsInWindow,
  estimateContextTokens,
  generateDocumentPlan,
  generateSectionSummary,
  getNeighborSummaries,
  retrieveRelevantChunks,
} from './ragService';

const PAPER_AUTHORING_PROFILE = [
  '以正式中文学术论文风格写作，适合科研人员与项目工作者提交正式稿件。',
  '段落要完整、自然衔接，避免口语化、营销化和模板腔。',
  '优先依据提纲展开论述，不偏题，不跳层级，不改变章节逻辑。',
  '没有可靠依据时用审慎表述，不虚构数据、实验结果、政策条文和参考文献。',
  '定义、背景、方法、问题、趋势、结语等部分要符合论文常见表达方式。',
  '结论性表述要克制，尽量给出依据、条件和适用范围。',
].join('\n');

export interface FullPaperGenerationProgress {
  stage: 'preparing' | 'section-start' | 'typing' | 'section-done' | 'applying' | 'completed';
  nodeId?: string;
  title?: string;
  completedSections: number;
  totalSections: number;
  typedChunks?: number;
  totalChunks?: number;
  percent: number;
  statusText: string;
}

export interface FullPaperGenerationOptions {
  aiConfig: AIConfig;
  referenceMaterials?: ReferenceMaterial[];
  dataKeywords?: string[];
  onProgress?: (progress: FullPaperGenerationProgress) => void;
  shouldAbort?: () => boolean;
}

export interface FullPaperGenerationResult {
  html: string;
  documentPlan: string;
  sectionSummaries: SectionMemory[];
  paperSpineMemories: PaperSpineSectionMemory[];
  aiAuthorshipRecords: AiAuthorshipRecord[];
}

interface GeneratedSection {
  node: FrameworkNode;
  bodyText: string;
  provider: string;
  model: string;
}

interface StreamedSectionGeneration {
  bodyText: string;
  provider: string;
  model: string;
  paperSpineEnhancement?: PaperSpineSectionMemory['enhancement'];
}

interface SectionGenerationBudget {
  maxChars: number;
  hardStopChars: number;
  maxParagraphs: number;
  maxTokens: number;
}

export const FULL_PAPER_PROGRESS_EVENT = 'qiuai:full-paper-progress';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function flattenFrameworkNodes(nodes: FrameworkNode[]): FrameworkNode[] {
  return nodes.flatMap((node) => [node, ...flattenFrameworkNodes(node.children)]);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripRepeatedHeading(text: string, title: string): string {
  const cleaned = text
    .trim()
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\*\*(.+?)\*\*$/gm, '$1')
    .trim();

  const lines = cleaned.split(/\r?\n/);
  if (lines[0]?.trim() === title.trim()) {
    return lines.slice(1).join('\n').trim();
  }

  return cleaned;
}

function renderBodyHtml(text: string, fallbackTitle: string): string {
  const normalized = stripRepeatedHeading(text, fallbackTitle);
  if (!normalized) {
    return '<p>待补充。</p>';
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    )
    .filter((lines) => lines.length > 0);

  if (blocks.length === 0) {
    return '<p>待补充。</p>';
  }

  return blocks
    .map((lines) => `<p>${lines.map((line) => escapeHtml(line)).join('<br />')}</p>`)
    .join('');
}

function splitTextForTyping(text: string): string[] {
  const normalized = stripRepeatedHeading(text, '').replace(/\r/g, '').trim();
  if (!normalized) {
    return ['待补充。'];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    const compact = paragraph.replace(/\n+/g, ' ').trim();
    if (!compact) {
      continue;
    }

    if (compact.length <= 120) {
      chunks.push(compact);
      continue;
    }

    const sentenceLike = compact
      .split(/(?<=[。！？；])/u)
      .map((item) => item.trim())
      .filter(Boolean);

    if (sentenceLike.length <= 1) {
      for (let index = 0; index < compact.length; index += 120) {
        chunks.push(compact.slice(index, index + 120));
      }
      continue;
    }

    let currentChunk = '';
    for (const sentence of sentenceLike) {
      if (!currentChunk) {
        currentChunk = sentence;
        continue;
      }

      if (`${currentChunk}${sentence}`.length > 120) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }
  }

  return chunks.length > 0 ? chunks : [normalized];
}

function getSectionGenerationBudget(node: FrameworkNode): SectionGenerationBudget {
  const hasChildren = node.children.length > 0;

  if (node.level <= 1) {
    return hasChildren
      ? { maxChars: 180, hardStopChars: 240, maxParagraphs: 1, maxTokens: 420 }
      : { maxChars: 260, hardStopChars: 320, maxParagraphs: 2, maxTokens: 520 };
  }

  if (node.level === 2) {
    return hasChildren
      ? { maxChars: 240, hardStopChars: 320, maxParagraphs: 2, maxTokens: 520 }
      : { maxChars: 420, hardStopChars: 520, maxParagraphs: 2, maxTokens: 700 };
  }

  if (node.level === 3) {
    return hasChildren
      ? { maxChars: 320, hardStopChars: 420, maxParagraphs: 2, maxTokens: 700 }
      : { maxChars: 560, hardStopChars: 680, maxParagraphs: 3, maxTokens: 900 };
  }

  return hasChildren
    ? { maxChars: 360, hardStopChars: 460, maxParagraphs: 2, maxTokens: 760 }
    : { maxChars: 620, hardStopChars: 760, maxParagraphs: 3, maxTokens: 960 };
}

function truncateAtSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text.trim();
  }

  const slice = text.slice(0, maxChars);
  const punctuationMatches = [...slice.matchAll(/[。！？；.!?;](?=[^。！？；.!?;]*$)/gu)];
  const lastMatch = punctuationMatches.at(-1);
  if (lastMatch?.index !== undefined) {
    return slice.slice(0, lastMatch.index + 1).trim();
  }

  const commaMatches = [...slice.matchAll(/[，,](?=[^，,]*$)/gu)];
  const lastCommaMatch = commaMatches.at(-1);
  if (lastCommaMatch?.index !== undefined && lastCommaMatch.index > Math.floor(maxChars * 0.7)) {
    return slice.slice(0, lastCommaMatch.index + 1).trim();
  }

  return slice.trim();
}

function trimGeneratedSectionText(text: string, budget: SectionGenerationBudget, title: string): string {
  const normalized = stripRepeatedHeading(text, title).replace(/\r/g, '').trim();
  if (!normalized) {
    return '';
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, budget.maxParagraphs);

  if (paragraphs.length === 0) {
    return truncateAtSentenceBoundary(normalized.replace(/\s+/g, ' ').trim(), budget.maxChars);
  }

  const kept: string[] = [];
  let remainingChars = budget.maxChars;

  for (const paragraph of paragraphs) {
    if (remainingChars <= 0) {
      break;
    }

    const nextParagraph = truncateAtSentenceBoundary(paragraph, remainingChars);
    if (!nextParagraph) {
      break;
    }

    kept.push(nextParagraph);
    remainingChars -= nextParagraph.length;
  }

  return kept.join('\n\n').trim();
}

function buildSectionLengthGuidance(node: FrameworkNode, budget: SectionGenerationBudget): string {
  const paragraphHint = budget.maxParagraphs <= 1 ? '1 段以内' : `不超过 ${budget.maxParagraphs} 段`;
  return [
    '【当前章节篇幅要求】',
    `章节标题：${node.title}`,
    `请只写本章节需要的正式正文，控制在 ${paragraphHint}。`,
    `总字数控制在约 ${budget.maxChars} 字以内，不要展开成过长综述。`,
    node.children.length > 0
      ? '如果本章节下还有子章节，只写承上启下的简短导语，不要把子章节内容提前写完。'
      : '如果本章节是末级标题，请直接写可用于正式文稿的主体内容，但仍保持克制和紧凑。',
  ].join('\n');
}

function findHeadingPath(nodes: FrameworkNode[], targetId: string, trail: string[] = []): string[] {
  for (const node of nodes) {
    const nextTrail = [...trail, node.title];
    if (node.id === targetId) {
      return nextTrail;
    }

    const child = findHeadingPath(node.children, targetId, nextTrail);
    if (child.length > 0) {
      return child;
    }
  }

  return [];
}

function buildDocumentPlan(title: string, framework: FrameworkNode[]): string {
  const basePlan = generateDocumentPlan(framework, title);
  return `${basePlan}\n\n【内置论文写作规范】\n${PAPER_AUTHORING_PROFILE}`;
}

function getSectionPath(nodes: FrameworkNode[], targetId: string, parentPath = ''): string {
  for (const node of nodes) {
    const nextPath = parentPath ? `${parentPath}.${node.order}` : String(node.order);
    if (node.id === targetId) {
      return nextPath;
    }

    const childPath = getSectionPath(node.children, targetId, nextPath);
    if (childPath) {
      return childPath;
    }
  }

  return '';
}

function renderImagePlaceholderHtml(node: FrameworkNode, sectionPath: string, imageIndex: number): string {
  return `<div data-type="image-placeholder" class="image-placeholder-node" contenteditable="false"><div class="image-placeholder-box"><div class="image-placeholder-icon">🖼</div><div class="image-placeholder-hint">双击或拖放图片到此处</div></div><div class="image-placeholder-caption" contenteditable="true">图 ${sectionPath}.${imageIndex} 图片标题</div></div><p class="image-text">上图展示了 ${escapeHtml(
    node.title
  )} 的相关内容。</p>`;
}

function renderTablePlaceholderHtml(node: FrameworkNode, sectionPath: string, tableIndex: number): string {
  return `<div data-type="table-placeholder" class="table-placeholder-node" contenteditable="false"><table class="three-line-placeholder-table"><thead><tr><th>列 1</th><th>列 2</th><th>列 3</th></tr></thead><tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><div class="table-placeholder-caption" contenteditable="true">表 ${sectionPath}.${tableIndex} 表格标题</div></div><p class="table-text">上表列出了 ${escapeHtml(
    node.title
  )} 的相关数据。</p>`;
}

function createSectionDecorationHtml(
  node: FrameworkNode,
  sectionPath: string,
  counters: { image: number; table: number }
): string {
  let html = '';

  if (node.needsImage) {
    counters.image += 1;
    html += renderImagePlaceholderHtml(node, sectionPath, counters.image);
  }

  if (node.needsTable) {
    counters.table += 1;
    html += renderTablePlaceholderHtml(node, sectionPath, counters.table);
  }

  return html;
}

function createProgressPayload(
  stage: FullPaperGenerationProgress['stage'],
  completedSections: number,
  totalSections: number,
  patch: Partial<FullPaperGenerationProgress> = {}
): FullPaperGenerationProgress {
  const typedChunks = patch.typedChunks ?? 0;
  const totalChunks = patch.totalChunks ?? 0;

  const percent =
    stage === 'completed'
      ? 100
      : stage === 'applying'
      ? 98
      : stage === 'typing' && totalSections > 0
      ? Math.min(
          97,
          Math.round((((completedSections + (totalChunks > 0 ? typedChunks / totalChunks : 0)) / totalSections) * 100))
        )
      : totalSections > 0
      ? Math.min(95, Math.round((completedSections / totalSections) * 100))
      : 0;

  const statusText =
    patch.statusText ||
    (stage === 'preparing'
      ? '正在准备大纲、论文规范与参考材料'
      : stage === 'section-start'
      ? `正在生成章节：${patch.title || ''}`.trim()
      : stage === 'typing'
      ? `正在写入章节：${patch.title || ''}`.trim()
      : stage === 'section-done'
      ? `已完成章节：${patch.title || ''}`.trim()
      : stage === 'applying'
      ? '正在整理最终排版并写入文档'
      : '完整论文已生成');

  return {
    stage,
    completedSections,
    totalSections,
    typedChunks,
    totalChunks,
    percent,
    statusText,
    ...patch,
  };
}

function emitFullPaperProgress(progress: FullPaperGenerationProgress): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(FULL_PAPER_PROGRESS_EVENT, {
      detail: progress,
    })
  );
}

async function replaceDocumentContent(content: string): Promise<boolean> {
  const adapter = useDocumentEngineStore.getState().adapter;
  if (adapter && supportsDocumentCommands(adapter) && adapter.executeCommand) {
    return adapter.executeCommand('replace-document-content', { content });
  }

  const editor = useEditorStore.getState().editor;
  if (!editor) {
    return false;
  }

  editor.commands.setContent(content);
  return true;
}

function createAuthorshipRecord(section: GeneratedSection, createdAt: string): AiAuthorshipRecord {
  return {
    id: generateId(),
    from: 0,
    to: 0,
    actionType: 'generate',
    provider: section.provider,
    model: section.model,
    acceptedMode: 'applied-directly',
    createdAt,
  };
}

function assembleDocumentHtml(title: string, sections: GeneratedSection[]): string {
  const titleHtml =
    title.trim() && title.trim() !== '未命名文档'
      ? `<h1>${escapeHtml(title.trim())}</h1>`
      : '';

  const sectionsHtml = sections
    .map((section) => {
      const level = Math.min(Math.max(section.node.level, 1), 3);
      return `<h${level}>${escapeHtml(section.node.title)}</h${level}>${renderBodyHtml(
        section.bodyText,
        section.node.title
      )}`;
    })
    .join('');

  return `${titleHtml}${sectionsHtml}`;
}

function assemblePreviewDocumentHtml(title: string, sectionsHtml: string): string {
  const titleHtml =
    title.trim() && title.trim() !== '未命名文档'
      ? `<h1>${escapeHtml(title.trim())}</h1>`
      : '';
  return `${titleHtml}${sectionsHtml}`;
}

async function generateSectionWithVisibleStreaming(args: {
  currentDoc: ReturnType<typeof useProjectStore.getState>['doc'];
  framework: FrameworkNode[];
  node: FrameworkNode;
  finalChunks: ReturnType<typeof retrieveRelevantChunks>;
  neighborSummaries: string[];
  documentPlan: string;
  aiConfig: AIConfig;
  budget: SectionGenerationBudget;
  finalizedSectionsHtml: string[];
  decorationHtml: string;
  completedSections: number;
  totalSections: number;
  dataKeywords: string[];
  notifyProgress: (progress: FullPaperGenerationProgress) => void;
}): Promise<StreamedSectionGeneration> {
  const {
    currentDoc,
    framework,
    node,
    finalChunks,
    neighborSummaries,
    documentPlan,
    aiConfig,
    budget,
    finalizedSectionsHtml,
    decorationHtml,
    completedSections,
    totalSections,
    dataKeywords,
    notifyProgress,
  } = args;

  const request = {
    sectionId: node.id,
    sectionTitle: node.title,
    headingPath: findHeadingPath(framework, node.id),
    referenceChunks: finalChunks,
    neighborSummaries,
    documentPlan,
    dataKeywords,
    aiConfig,
    existingPaperSpineMemory: currentDoc.documentState.paperSpineMemories.find((item) => item.sectionId === node.id),
  };

  const streamedParts: string[] = [];
  const sectionTitleLevel = Math.min(Math.max(node.level, 1), 3);
  let typedChunks = 0;

  let provider = aiConfig.provider;
  let model = aiConfig.model;
  let paperSpineEnhancement: PaperSpineSectionMemory['enhancement'] | undefined;

  for await (const streamChunk of streamGenerateText(request)) {
    if (streamChunk.done) {
      provider = (streamChunk.provider as AIConfig['provider'] | undefined) || provider;
      model = streamChunk.model || model;
      paperSpineEnhancement = streamChunk.paperSpineEnhancement;
      break;
    }

    const chunk = streamChunk.content;
    if (!chunk.trim()) {
      continue;
    }

    streamedParts.push(chunk);
    typedChunks += 1;
    const rawBodyText = stripRepeatedHeading(streamedParts.join(''), node.title);
    const liveBodyText = trimGeneratedSectionText(rawBodyText, budget, node.title);
    const liveSectionHtml = `<h${sectionTitleLevel}>${escapeHtml(node.title)}</h${sectionTitleLevel}>${renderBodyHtml(
      liveBodyText,
      node.title
    )}${decorationHtml}`;

    await replaceDocumentContent(
      assemblePreviewDocumentHtml(currentDoc.title, `${finalizedSectionsHtml.join('')}${liveSectionHtml}`)
    );

    notifyProgress(
      createProgressPayload('typing', completedSections, totalSections, {
        nodeId: node.id,
        title: node.title,
        typedChunks,
        totalChunks: typedChunks,
        statusText: `正在写入章节：${node.title}（第 ${typedChunks} 段）`,
      })
    );
    if (rawBodyText.replace(/\s+/g, '').length >= budget.hardStopChars) {
      break;
    }
  }

  return {
    bodyText: trimGeneratedSectionText(streamedParts.join(''), budget, node.title),
    provider,
    model,
    paperSpineEnhancement,
  };
}

export async function generateAndApplyFullPaperFromOutline(
  options: FullPaperGenerationOptions
): Promise<FullPaperGenerationResult> {
  const currentDoc = useProjectStore.getState().doc;
  const framework = useFrameworkStore.getState().nodes;
  const sections = flattenFrameworkNodes(framework);

  if (sections.length === 0) {
    throw new Error('请先导入文档大纲，再生成完整论文。');
  }

  const referenceMaterials =
    options.referenceMaterials ??
    (currentDoc.documentState.referenceMaterials.length > 0
      ? currentDoc.documentState.referenceMaterials
      : currentDoc.referenceMaterials);
  const dataKeywords = options.dataKeywords ?? [];
  const totalSections = sections.length;
  const sectionSummariesMap = new Map<string, string>();
  const nextMemories = [...(currentDoc.documentState.paperSpineMemories || [])];
  const allChunks = referenceMaterials.flatMap((material) => chunkReferenceMaterial(material));
  const generatedSections: GeneratedSection[] = [];
  const documentPlan = buildDocumentPlan(currentDoc.title, framework);
  const finalizedSectionsHtml: string[] = [];
  const decorationCounters = {
    image: 0,
    table: 0,
  };

  const notifyProgress = (progress: FullPaperGenerationProgress) => {
    options.onProgress?.(progress);
    emitFullPaperProgress(progress);
  };

  notifyProgress(createProgressPayload('preparing', 0, totalSections));
  await replaceDocumentContent(assemblePreviewDocumentHtml(currentDoc.title, ''));

  for (const node of sections) {
    if (options.shouldAbort?.()) {
      throw new Error('生成已取消。');
    }

    notifyProgress(
      createProgressPayload('section-start', generatedSections.length, totalSections, {
        nodeId: node.id,
        title: node.title,
      })
    );

    const headingPath = findHeadingPath(framework, node.id);
    const relevantChunks = retrieveRelevantChunks(allChunks, node.title, headingPath, dataKeywords, 8);
    const neighborSummaries = getNeighborSummaries(sectionSummariesMap, node.id, framework, 2);
    const budget = getSectionGenerationBudget(node);
    const sectionPlan = `${documentPlan}\n\n${buildSectionLengthGuidance(node, budget)}`;
    const estimatedTokens = estimateContextTokens(node.title, relevantChunks, neighborSummaries, sectionPlan);
    const maxTokens = Math.min(options.aiConfig.maxTokens || 8192, budget.maxTokens);
    const finalChunks =
      !contextFitsInWindow(estimatedTokens, maxTokens) && relevantChunks.length > 3
        ? relevantChunks.slice(0, 3)
        : relevantChunks;

    const sectionPath = getSectionPath(framework, node.id);
    const decorationHtml = createSectionDecorationHtml(node, sectionPath, decorationCounters);
    const streamedResult = await generateSectionWithVisibleStreaming({
      currentDoc,
      framework,
      node,
      finalChunks,
      neighborSummaries,
      documentPlan: sectionPlan,
      aiConfig: {
        ...options.aiConfig,
        maxTokens,
      },
      budget,
      finalizedSectionsHtml,
      decorationHtml,
      completedSections: generatedSections.length,
      totalSections,
      dataKeywords,
      notifyProgress,
    });
    const bodyText = stripRepeatedHeading(streamedResult.bodyText || '', node.title);

    generatedSections.push({
      node,
      bodyText,
      provider: streamedResult.provider,
      model: streamedResult.model,
    });

    sectionSummariesMap.set(node.id, generateSectionSummary(node.title, bodyText));

    if (streamedResult.paperSpineEnhancement) {
      const memory: PaperSpineSectionMemory = {
        sectionId: node.id,
        sectionTitle: node.title,
        enhancement: streamedResult.paperSpineEnhancement,
        generatedAt: new Date().toISOString(),
      };
      const existingIndex = nextMemories.findIndex((item) => item.sectionId === node.id);
      if (existingIndex >= 0) {
        nextMemories.splice(existingIndex, 1, memory);
      } else {
        nextMemories.push(memory);
      }
    }

    finalizedSectionsHtml.push(
      `<h${Math.min(Math.max(node.level, 1), 3)}>${escapeHtml(node.title)}</h${Math.min(Math.max(node.level, 1), 3)}>${renderBodyHtml(
        bodyText,
        node.title
      )}${decorationHtml}`
    );

    notifyProgress(
      createProgressPayload('section-done', generatedSections.length, totalSections, {
        nodeId: node.id,
        title: node.title,
      })
    );
  }

  const html = assemblePreviewDocumentHtml(currentDoc.title, finalizedSectionsHtml.join(''));
  notifyProgress(createProgressPayload('applying', generatedSections.length, totalSections));

  const applied = await replaceDocumentContent(html);
  if (!applied) {
    throw new Error('生成完成，但未能写入当前编辑器。');
  }

  const editor = useEditorStore.getState().editor;
  const createdAt = new Date().toISOString();
  const sectionSummaries: SectionMemory[] = generatedSections.map((section) => ({
    sectionId: section.node.id,
    title: section.node.title,
    summary: sectionSummariesMap.get(section.node.id) || '',
    updatedAt: createdAt,
  }));
  const aiAuthorshipRecords = generatedSections.map((section) => createAuthorshipRecord(section, createdAt));

  const nextDoc = syncDocumentWithState({
    ...currentDoc,
    currentPhase: WritingPhase.TEXT_GEN,
    updatedAt: createdAt,
    referenceMaterials,
    editorContent: editor?.getJSON() || currentDoc.editorContent,
    documentPlan,
    documentState: {
      ...currentDoc.documentState,
      editorContent: editor?.getJSON() || currentDoc.editorContent,
      referenceMaterials,
      documentPlan,
      sectionSummaries,
      paperSpineMemories: nextMemories,
      aiAuthorshipRecords: [...currentDoc.documentState.aiAuthorshipRecords, ...aiAuthorshipRecords],
    },
  });

  useProjectStore.getState().setDoc(nextDoc);
  useFrameworkStore.getState().setNodes(nextDoc.framework || []);
  usePhaseStore.getState().setPhase(WritingPhase.TEXT_GEN);
  useEditorStore.getState().setDirty(true);

  notifyProgress(createProgressPayload('completed', generatedSections.length, totalSections));

  return {
    html,
    documentPlan,
    sectionSummaries,
    paperSpineMemories: nextMemories,
    aiAuthorshipRecords,
  };
}
