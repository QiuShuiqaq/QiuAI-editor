import type {
  PaperSpineCitationSupport,
  PaperSpineEnhancement,
  PaperSpineRationaleEntry,
  PaperSpineSectionBlueprint,
  TextGenRequest,
} from '@qiuai/shared';

function detectRhetoricalGoal(sectionTitle: string): string {
  if (/背景|现状|意义/.test(sectionTitle)) return '说明研究背景、问题来源和立项意义';
  if (/目标|内容|任务/.test(sectionTitle)) return '明确研究目标、工作内容和任务边界';
  if (/方法|方案|技术路线/.test(sectionTitle)) return '分步骤阐述技术方案、实施路径和可行性';
  if (/基础|条件|保障/.test(sectionTitle)) return '展示既有基础、团队能力和资源保障';
  if (/预期|成果|指标/.test(sectionTitle)) return '说明预期成果、考核指标和应用价值';
  return '围绕本节主题形成结构完整、证据充分的申报文本';
}

function buildCitationSupportBank(request: TextGenRequest): PaperSpineCitationSupport[] {
  return request.referenceChunks.slice(0, 6).map((chunk, index) => ({
    chunkId: chunk.id,
    excerpt: chunk.text.slice(0, 180),
    relevance: index < 3 ? 'primary' : 'secondary',
  }));
}

function buildRationaleMatrix(
  request: TextGenRequest,
  supports: PaperSpineCitationSupport[]
): PaperSpineRationaleEntry[] {
  const primary = supports.filter((item) => item.relevance === 'primary');
  const fallback = supports.slice(0, 2);

  return [
    {
      claim: `本节需要围绕“${request.sectionTitle}”建立清晰的问题或任务边界`,
      purpose: 'problem',
      support: primary.length > 0 ? primary : fallback,
    },
    {
      claim: '本节中的关键论断应优先复用参考材料中已有事实与术语',
      purpose: 'evidence',
      support: supports.length > 0 ? supports : fallback,
    },
    {
      claim: '本节行文应与相邻章节保持术语一致、目标一致和论证节奏一致',
      purpose: 'method',
      support: fallback,
    },
  ];
}

function buildBlueprint(
  request: TextGenRequest,
  supports: PaperSpineCitationSupport[]
): PaperSpineSectionBlueprint {
  return {
    sectionTitle: request.sectionTitle,
    rhetoricalGoal: detectRhetoricalGoal(request.sectionTitle),
    requiredClaims: [
      `解释“${request.sectionTitle}”在整篇申报书中的作用`,
      '优先使用可追溯的事实、数据和术语',
      '避免脱离参考资料自由发挥关键结论',
    ],
    evidencePlan: supports.map((item) => `优先吸收材料片段 ${item.chunkId} 中的有效信息`),
    continuityNotes:
      request.neighborSummaries.length > 0
        ? request.neighborSummaries.map((summary) => `与相邻章节保持连续：${summary}`)
        : ['本节需要自行补足与整篇结构的衔接句'],
    cautionNotes: [
      '不要编造数据或实验结果',
      '对不确定信息使用审慎措辞',
      '优先保持申报语境下的正式、克制和可审查风格',
    ],
  };
}

function buildPromptAddendum(
  blueprint: PaperSpineSectionBlueprint,
  rationaleMatrix: PaperSpineRationaleEntry[],
  supports: PaperSpineCitationSupport[]
): string {
  const rationaleLines = rationaleMatrix
    .map(
      (entry, index) =>
        `${index + 1}. 论断：${entry.claim}\n   用途：${entry.purpose}\n   证据：${
          entry.support.map((item) => item.chunkId).join(', ') || '无'
        }`
    )
    .join('\n');

  const supportLines = supports
    .map((item) => `- ${item.chunkId} (${item.relevance})：${item.excerpt}`)
    .join('\n');

  return `
## PaperSpine Section Blueprint
写作目标：${blueprint.rhetoricalGoal}

必达论点：
${blueprint.requiredClaims.map((item) => `- ${item}`).join('\n')}

证据使用计划：
${blueprint.evidencePlan.map((item) => `- ${item}`).join('\n')}

衔接要求：
${blueprint.continuityNotes.map((item) => `- ${item}`).join('\n')}

风险提醒：
${blueprint.cautionNotes.map((item) => `- ${item}`).join('\n')}

## PaperSpine Rationale Matrix
${rationaleLines}

## PaperSpine Citation Support Bank
${supportLines}
`;
}

class PaperSpineAdapter {
  enhance(request: TextGenRequest): PaperSpineEnhancement {
    const citationSupportBank = buildCitationSupportBank(request);
    const rationaleMatrix = buildRationaleMatrix(request, citationSupportBank);
    const blueprint = buildBlueprint(request, citationSupportBank);

    return {
      blueprint,
      rationaleMatrix,
      citationSupportBank,
      enhancedPromptAddendum: buildPromptAddendum(
        blueprint,
        rationaleMatrix,
        citationSupportBank
      ),
    };
  }
}

export const paperSpineAdapter = new PaperSpineAdapter();
