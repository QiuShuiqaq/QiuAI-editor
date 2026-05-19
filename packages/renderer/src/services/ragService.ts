import type { TextChunk, ReferenceMaterial, FrameworkNode } from '@qiuai/shared';
import { generateId } from '@qiuai/shared';

// Simple token estimation (Chinese: ~1 char = 1 token, English: ~4 chars = 1 token)
export function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    if (/[一-鿿㐀-䶿]/.test(char)) {
      tokens += 1; // CJK characters
    } else if (/[a-zA-Z]/.test(char)) {
      tokens += 0.25; // English letters
    } else {
      tokens += 0.5;
    }
  }
  return Math.ceil(tokens);
}

// Chunk text into pieces of targetTokenSize
export function chunkText(text: string, targetTokenSize = 512, overlap = 64): TextChunk[] {
  const chunks: TextChunk[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  let currentChunk = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > targetTokenSize && currentChunk) {
      chunks.push({
        id: generateId(),
        text: currentChunk.trim(),
        metadata: {},
      });

      // Overlap: keep last portion of previous chunk
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 4));
      currentChunk = overlapWords.join(' ') + '\n\n' + para;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: generateId(),
      text: currentChunk.trim(),
      metadata: {},
    });
  }

  return chunks;
}

// Chunk reference materials
export function chunkReferenceMaterial(material: ReferenceMaterial): TextChunk[] {
  return chunkText(
    material.chunks.map((c) => c.text).join('\n\n')
  );
}

// Simple TF-IDF-like keyword scoring for retrieval
function computeKeywordScore(chunkText: string, queryTokens: string[]): number {
  const lowerText = chunkText.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    // Count occurrences
    const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      score += matches.length;
    }
    // Bonus for exact phrase match
    if (lowerText.includes(token)) {
      score += 2;
    }
  }

  return score;
}

// Extract query tokens from section info
function extractQueryTokens(sectionTitle: string, headingPath: string[], dataKeywords: string[]): string[] {
  const tokens = new Set<string>();

  // From section title
  sectionTitle.split(/[，,、\s]+/).forEach((t) => {
    if (t.length >= 2) tokens.add(t.toLowerCase());
  });

  // From heading path
  headingPath.forEach((h) => {
    h.split(/[，,、\s]+/).forEach((t) => {
      if (t.length >= 2) tokens.add(t.toLowerCase());
    });
  });

  // Data keywords
  dataKeywords.forEach((k) => tokens.add(k.toLowerCase()));

  return Array.from(tokens);
}

// Retrieve top-K relevant chunks for a section
export function retrieveRelevantChunks(
  chunks: TextChunk[],
  sectionTitle: string,
  headingPath: string[],
  dataKeywords: string[],
  topK = 5
): TextChunk[] {
  const queryTokens = extractQueryTokens(sectionTitle, headingPath, dataKeywords);

  if (queryTokens.length === 0) {
    // No query tokens, return first K chunks
    return chunks.slice(0, topK);
  }

  const scored = chunks.map((chunk) => ({
    chunk,
    score: computeKeywordScore(chunk.text, queryTokens),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter((s) => s.score > 0)
    .slice(0, topK)
    .map((s) => s.chunk);
}

// Generate section summaries for rolling context
export function generateSectionSummary(
  sectionTitle: string,
  generatedText: string,
  maxLength = 200
): string {
  // Take first maxLength chars + add section title context
  const text = generatedText.replace(/\s+/g, ' ').trim();
  const summary = text.length > maxLength
    ? text.slice(0, maxLength) + '...'
    : text;
  return `[${sectionTitle}] ${summary}`;
}

// Build neighbor summaries for context
export function getNeighborSummaries(
  summaries: Map<string, string>,
  sectionId: string,
  frameworkNodes: FrameworkNode[],
  windowSize = 3
): string[] {
  // Flatten and find position
  const flat: { id: string; title: string }[] = [];
  function walk(nodes: FrameworkNode[]) {
    for (const n of nodes) {
      flat.push({ id: n.id, title: n.title });
      walk(n.children);
    }
  }
  walk(frameworkNodes);

  const idx = flat.findIndex((n) => n.id === sectionId);
  if (idx === -1) return [];

  const result: string[] = [];
  const start = Math.max(0, idx - windowSize);
  const end = Math.min(flat.length, idx + windowSize + 1);

  for (let i = start; i < end; i++) {
    if (i === idx) continue; // Skip current section
    const summary = summaries.get(flat[i].id);
    if (summary) {
      result.push(summary);
    }
  }

  return result;
}

// Generate document plan from framework
export function generateDocumentPlan(
  frameworkNodes: FrameworkNode[],
  projectTitle: string
): string {
  const parts: string[] = [];

  function walk(nodes: FrameworkNode[], depth: number) {
    for (const node of nodes) {
      const indent = '  '.repeat(depth);
      parts.push(`${indent}${node.title}`);
      if (node.children.length > 0) {
        walk(node.children, depth + 1);
      }
    }
  }

  walk(frameworkNodes, 0);

  return `申报书"${projectTitle}"的结构规划如下：

${parts.join('\n')}

请严格按照上述结构撰写每个章节，确保各章节之间逻辑连贯、层级清晰。`;
}

// Estimate total context token usage for a generation request
export function estimateContextTokens(
  sectionTitle: string,
  referenceChunks: TextChunk[],
  neighborSummaries: string[],
  documentPlan: string
): number {
  let total = 0;
  total += 300; // System prompt overhead
  total += estimateTokens(sectionTitle);
  total += referenceChunks.reduce((sum, c) => sum + estimateTokens(c.text), 0);
  total += neighborSummaries.reduce((sum, s) => sum + estimateTokens(s), 0);
  total += estimateTokens(documentPlan);
  total += 1000; // Output buffer
  return total;
}

// Check if context fits within model's max tokens
export function contextFitsInWindow(
  estimatedTokens: number,
  maxContextTokens: number
): boolean {
  return estimatedTokens <= maxContextTokens * 0.8; // 80% safety margin
}
