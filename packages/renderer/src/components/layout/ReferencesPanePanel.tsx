import { useMemo, useState } from 'react';
import { Alert, Button, Empty, Input, List, Select, Space, Tag, message } from 'antd';
import { DeleteOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import {
  IPC_CHANNELS,
  generateId,
  type CitationOccurrence,
  type CitationStyleProfile,
  type ClaimEvidenceLink,
  type DocumentFact,
  type DocumentGlossaryEntry,
  type FigureTableSourceLink,
  type PaperSafetyIssue,
  type PaperSafetyReport,
  type ReferenceMaterial,
  type ReferenceSource,
} from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import {
  appendTextAfterCurrentSelection,
  insertDocumentHtml,
  insertDocumentText,
} from '../../services/documentEngineCommands';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { extractDocumentReferences, type CaptionReferenceTarget } from '../editor/documentReferenceUtils';
import { MaterialUploader } from '../phases/Phase3TextGen/MaterialUploader';

function SectionBlock({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        margin: 16,
        marginBottom: 0,
        padding: 12,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1f1f1f' }}>{title}</div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        minWidth: 88,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid #dbeafe',
        background: '#f8fbff',
      }}
    >
      <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0958d9' }}>{value}</div>
    </div>
  );
}

const FACT_STATUS_OPTIONS: Array<{ value: DocumentFact['status']; label: string }> = [
  { value: 'needs-review', label: '待核查' },
  { value: 'draft', label: '草稿' },
  { value: 'verified', label: '已核验' },
];

const CITATION_STYLE_OPTIONS: Array<{
  value: string;
  label: string;
  profile: CitationStyleProfile;
}> = [
  {
    value: 'gb-t-7714-2015-numeric',
    label: 'GB/T 7714（顺序编码）',
    profile: {
      styleId: 'gb-t-7714-2015-numeric',
      styleLabel: 'GB/T 7714',
      locale: 'zh-CN',
      citationMode: 'numeric',
      sortMode: 'citation-order',
      bibliographyTitle: '参考文献',
    },
  },
  {
    value: 'apa-7-author-date',
    label: 'APA 7（作者-年份）',
    profile: {
      styleId: 'apa-7-author-date',
      styleLabel: 'APA 7',
      locale: 'en-US',
      citationMode: 'author-date',
      sortMode: 'author-year',
      bibliographyTitle: 'References',
    },
  },
  {
    value: 'chicago-footnote',
    label: 'Chicago（脚注）',
    profile: {
      styleId: 'chicago-footnote',
      styleLabel: 'Chicago',
      locale: 'en-US',
      citationMode: 'footnote',
      sortMode: 'citation-order',
      bibliographyTitle: 'Bibliography',
    },
  },
];

function normalizeDoi(value?: string): string | undefined {
  if (!value) return undefined;
  return value.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase() || undefined;
}

function describeAuthors(source: ReferenceSource): string {
  if (!source.authors.length) {
    return '作者待补充';
  }

  const names = source.authors
    .map((author) => author.literal || [author.family, author.given].filter(Boolean).join(' '))
    .filter(Boolean);

  if (!names.length) {
    return '作者待补充';
  }

  return names.length <= 3 ? names.join(' / ') : `${names.slice(0, 3).join(' / ')} 等`;
}

function describeType(type: ReferenceSource['type']): string {
  switch (type) {
    case 'journal-article':
      return '期刊';
    case 'conference-paper':
      return '会议';
    case 'thesis':
      return '学位论文';
    case 'book':
      return '图书';
    case 'book-chapter':
      return '章节';
    case 'report':
      return '报告';
    case 'dataset':
      return '数据集';
    case 'standard':
      return '标准';
    case 'webpage':
      return '网页';
    case 'patent':
      return '专利';
    case 'legislation':
      return '法规';
    default:
      return '其他';
  }
}

function buildCitationText(source: ReferenceSource, style: CitationStyleProfile, occurrenceIndex: number): string {
  if (style.citationMode === 'numeric') {
    return `[${occurrenceIndex}]`;
  }

  if (style.citationMode === 'footnote') {
    return `[注${occurrenceIndex}]`;
  }

  const firstAuthor = source.authors[0];
  const authorLabel =
    firstAuthor?.family || firstAuthor?.literal || firstAuthor?.given || source.title.slice(0, 12);
  const yearLabel = source.year || 'n.d.';
  return `(${authorLabel}, ${yearLabel})`;
}

function buildBibliographyEntry(source: ReferenceSource, style: CitationStyleProfile, index: number): string {
  const authors = describeAuthors(source);
  const year = source.year ? `(${source.year})` : '';
  const container = source.containerTitle ? ` ${source.containerTitle}.` : '';
  const doi = source.doi ? ` DOI: ${source.doi}.` : '';

  if (style.citationMode === 'numeric') {
    return `[${index}] ${authors}. ${source.title}.${container}${doi}`.trim();
  }

  if (style.citationMode === 'footnote') {
    return `${index}. ${authors}, ${source.title}.${container}${doi}`.trim();
  }

  return `${authors}. ${year} ${source.title}.${container}${doi}`.trim();
}

function escapeInlineHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getIssueColor(issue: PaperSafetyIssue['severity']) {
  if (issue === 'error') return 'red';
  if (issue === 'warning') return 'gold';
  return 'blue';
}

export function ReferencesPanePanel() {
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const editor = useEditorStore((state) => state.editor);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const selectedText = useEditorStore((state) => state.selectedText);
  const activeSectionTitle = useEditorStore((state) => state.activeSectionTitle);

  const [doiInput, setDoiInput] = useState('');
  const [importingDoi, setImportingDoi] = useState(false);
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [factLabel, setFactLabel] = useState('');
  const [factValue, setFactValue] = useState('');
  const [factStatus, setFactStatus] = useState<DocumentFact['status']>('needs-review');
  const [selectedFactId, setSelectedFactId] = useState<string>();
  const [selectedReferenceId, setSelectedReferenceId] = useState<string>();
  const [selectedFigureAnchorId, setSelectedFigureAnchorId] = useState<string>();
  const [selectedTableAnchorId, setSelectedTableAnchorId] = useState<string>();

  const documentState = doc.documentState;
  const glossary = documentState.glossary;
  const facts = documentState.facts;
  const referenceMaterials = documentState.referenceMaterials;
  const referenceSources = documentState.referenceSources;
  const citationOccurrences = documentState.citationOccurrences;
  const citationStyle = documentState.citationStyle;
  const claimEvidenceLinks = documentState.claimEvidenceLinks;
  const figureTableSourceLinks = documentState.figureTableSourceLinks;
  const paperSafetyReport = documentState.paperSafetyReport;
  const sectionSummaries = documentState.sectionSummaries;
  const isPageMode = Boolean(documentEngineAdapter && !editor);

  const referenceSummary = useMemo(
    () => (editor ? extractDocumentReferences(editor.state.doc) : { headings: [], images: [], tables: [] }),
    [editor, documentState.editorContent]
  );

  const sortedReferenceSources = useMemo(() => {
    const deduped = referenceSources.filter((source, index, list) => {
      const sourceDoi = normalizeDoi(source.doi);
      if (!sourceDoi) {
        return index === list.findIndex((item) => item.id === source.id);
      }
      return index === list.findIndex((item) => normalizeDoi(item.doi) === sourceDoi);
    });

    if (citationStyle.sortMode === 'alphabetical' || citationStyle.sortMode === 'author-year') {
      return [...deduped].sort((a, b) => {
        const authorA = describeAuthors(a);
        const authorB = describeAuthors(b);
        const byAuthor = authorA.localeCompare(authorB, 'zh-CN');
        if (byAuthor !== 0) return byAuthor;
        return (a.year || '').localeCompare(b.year || '', 'zh-CN');
      });
    }

    return deduped;
  }, [citationStyle.sortMode, referenceSources]);

  const figureOptions = referenceSummary.images.map((item) => ({
    value: item.anchorId,
    label: item.label,
  }));

  const tableOptions = referenceSummary.tables.map((item) => ({
    value: item.anchorId,
    label: item.label,
  }));

  const updateDocState = (patch: {
    glossary?: DocumentGlossaryEntry[];
    facts?: DocumentFact[];
    referenceMaterials?: ReferenceMaterial[];
    referenceSources?: ReferenceSource[];
    citationOccurrences?: CitationOccurrence[];
    citationStyle?: CitationStyleProfile;
    claimEvidenceLinks?: ClaimEvidenceLink[];
    figureTableSourceLinks?: FigureTableSourceLink[];
    paperSafetyReport?: PaperSafetyReport | null;
  }) => {
    setDoc({
      ...doc,
      updatedAt: new Date().toISOString(),
      referenceMaterials: patch.referenceMaterials ?? referenceMaterials,
      documentState: {
        ...documentState,
        glossary: patch.glossary ?? glossary,
        facts: patch.facts ?? facts,
        referenceMaterials: patch.referenceMaterials ?? referenceMaterials,
        referenceSources: patch.referenceSources ?? referenceSources,
        citationOccurrences: patch.citationOccurrences ?? citationOccurrences,
        citationStyle: patch.citationStyle ?? citationStyle,
        claimEvidenceLinks: patch.claimEvidenceLinks ?? claimEvidenceLinks,
        figureTableSourceLinks: patch.figureTableSourceLinks ?? figureTableSourceLinks,
        paperSafetyReport:
          patch.paperSafetyReport === undefined ? paperSafetyReport : patch.paperSafetyReport,
      },
    });
  };

  const importReferenceByDoi = async () => {
    const nextDoi = doiInput.trim();
    if (!nextDoi) {
      message.warning('请先输入 DOI 或 DOI 链接。');
      return;
    }

    setImportingDoi(true);
    try {
      const result = await ipcClient.invoke<{
        success: boolean;
        data?: ReferenceSource;
        error?: string;
      }>(IPC_CHANNELS.REFERENCE_IMPORT_DOI, nextDoi);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'DOI 导入失败');
      }

      const imported = result.data;
      const importedDoi = normalizeDoi(imported.doi);
      const existed = importedDoi
        ? referenceSources.find((item) => normalizeDoi(item.doi) === importedDoi)
        : undefined;

      if (existed) {
        message.info('这条 DOI 已经在本地参考文献库中。');
        setDoiInput('');
        return;
      }

      updateDocState({
        referenceSources: [imported, ...referenceSources],
      });
      setDoiInput('');
      message.success('参考文献已导入到当前文档。');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'DOI 导入失败';
      message.error(detail);
    } finally {
      setImportingDoi(false);
    }
  };

  const changeCitationStyle = (styleId: string) => {
    const nextStyle = CITATION_STYLE_OPTIONS.find((item) => item.value === styleId)?.profile;
    if (!nextStyle) return;
    updateDocState({ citationStyle: nextStyle });
    message.success(`已切换为 ${nextStyle.styleLabel} 引用样式。`);
  };

  const insertCitation = async (source: ReferenceSource) => {
    const nextIndex = citationOccurrences.length + 1;
    const citationText = buildCitationText(source, citationStyle, nextIndex);
    const selection = editor?.state.selection;
    const hasSelectedRange = Boolean(selection && selection.from !== selection.to);
    const applied = hasSelectedRange
      ? await appendTextAfterCurrentSelection(citationText)
      : await insertDocumentText(citationText);

    if (!applied) {
      message.warning('当前插入位置无法加入引用，请调整光标位置后重试。');
      return;
    }

    updateDocState({
      citationOccurrences: [
        ...citationOccurrences,
        {
          id: generateId(),
          documentAnchorId: !editor ? activeSectionTitle || undefined : undefined,
          from: selection?.to ?? 0,
          to: (selection?.to ?? 0) + citationText.length,
          sourceIds: [source.id],
          styleMode: citationStyle.citationMode,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      claimEvidenceLinks:
        selectedText.trim() && selection && selection.from !== selection.to
          ? [
              ...claimEvidenceLinks,
              {
                id: generateId(),
                from: selection.from,
                to: selection.to,
                claimType: 'fact',
                sourceLinks: [{ sourceId: source.id, relevance: 'primary' }],
                confidence: 'medium',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } satisfies ClaimEvidenceLink,
            ]
          : claimEvidenceLinks,
    });
    message.success(selectedText.trim() ? '已插入引用，并记录了当前选区的证据绑定。' : '已插入引用。');
  };

  const insertBibliography = async () => {
    if (!sortedReferenceSources.length) {
      message.warning('请先导入参考文献条目。');
      return;
    }

    const lines = sortedReferenceSources.map((source, index) =>
      buildBibliographyEntry(source, citationStyle, index + 1)
    );

    const headingTag = citationStyle.locale === 'zh-CN' ? 'h2' : 'h1';
    const bibliographyHtml = [
      `<${headingTag}>${escapeInlineHtml(citationStyle.bibliographyTitle)}</${headingTag}>`,
      ...lines.map((line) => `<p>${escapeInlineHtml(line)}</p>`),
    ].join('');

    const htmlApplied = await insertDocumentHtml(bibliographyHtml);
    if (htmlApplied) {
      message.success('已插入参考文献表。');
      return;
    }

    const plainBibliography = `${citationStyle.bibliographyTitle}\n${lines.join('\n')}`;
    const textApplied = await insertDocumentText(plainBibliography);
    if (!textApplied) {
      message.warning('当前插入位置无法加入参考文献表，请调整光标位置后重试。');
      return;
    }
    message.success('已插入参考文献表文本。');
  };

  const addGlossary = () => {
    const nextTerm = term.trim();
    const nextDefinition = definition.trim();
    if (!nextTerm || !nextDefinition) {
      message.warning('请完整填写术语和解释。');
      return;
    }

    updateDocState({
      glossary: [{ id: generateId(), term: nextTerm, definition: nextDefinition }, ...glossary],
    });
    setTerm('');
    setDefinition('');
  };

  const addFact = () => {
    const nextLabel = factLabel.trim();
    const nextValue = factValue.trim();
    if (!nextLabel || !nextValue) {
      message.warning('请完整填写事实名称和值。');
      return;
    }

    updateDocState({
      facts: [
        {
          id: generateId(),
          label: nextLabel,
          value: nextValue,
          status: factStatus,
          sourceChunkIds: [],
          sourceReferenceIds: selectedReferenceId ? [selectedReferenceId] : [],
        },
        ...facts,
      ],
    });
    setFactLabel('');
    setFactValue('');
    setFactStatus('needs-review');
    message.success(selectedReferenceId ? '事实已添加，并绑定了当前来源。' : '事实已添加。');
  };

  const bindFactSource = () => {
    if (!selectedFactId || !selectedReferenceId) {
      message.warning('请先选择事实和参考来源。');
      return;
    }

    updateDocState({
      facts: facts.map((item) =>
        item.id === selectedFactId
          ? {
              ...item,
              sourceReferenceIds: Array.from(
                new Set([...(item.sourceReferenceIds ?? []), selectedReferenceId])
              ),
            }
          : item
      ),
    });
    message.success('事实来源已绑定。');
  };

  const upsertFigureTableSourceLink = (
    targetType: FigureTableSourceLink['targetType'],
    target: CaptionReferenceTarget,
    sourceId: string
  ) => {
    const existing = figureTableSourceLinks.find(
      (item) => item.targetType === targetType && item.targetAnchorId === target.anchorId
    );

    const nextLinks = existing
      ? figureTableSourceLinks.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                sourceIds: Array.from(new Set([...item.sourceIds, sourceId])),
                captionText: target.label,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      : [
          ...figureTableSourceLinks,
          {
            id: generateId(),
            targetType,
            targetAnchorId: target.anchorId,
            sourceIds: [sourceId],
            captionText: target.label,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

    updateDocState({ figureTableSourceLinks: nextLinks });
  };

  const bindFigureSource = () => {
    if (!selectedFigureAnchorId || !selectedReferenceId) {
      message.warning('请先选择图题和参考来源。');
      return;
    }

    const target = referenceSummary.images.find((item) => item.anchorId === selectedFigureAnchorId);
    if (!target) {
      message.warning('没有找到对应的图题。');
      return;
    }

    upsertFigureTableSourceLink('figure', target, selectedReferenceId);
    message.success('图题来源已绑定。');
  };

  const bindTableSource = () => {
    if (!selectedTableAnchorId || !selectedReferenceId) {
      message.warning('请先选择表题和参考来源。');
      return;
    }

    const target = referenceSummary.tables.find((item) => item.anchorId === selectedTableAnchorId);
    if (!target) {
      message.warning('没有找到对应的表题。');
      return;
    }

    upsertFigureTableSourceLink('table', target, selectedReferenceId);
    message.success('表题来源已绑定。');
  };

  const buildPaperSafetyPreview = (): PaperSafetyReport => {
    const issues: PaperSafetyIssue[] = [];
    const docText = editor?.getText().trim() || '';
    const hasBodyContent =
      docText.length > 0 ||
      documentState.pageCount > 1 ||
      sectionSummaries.length > 0 ||
      doc.framework.length > 0;

    if (hasBodyContent && citationOccurrences.length === 0) {
      issues.push({
        id: generateId(),
        severity: 'warning',
        category: 'uncited-claim',
        message: '正文已经有内容，但还没有任何文中引用记录。',
        relatedSourceIds: [],
        suggestion: '建议为关键结论、数据和定义补充文中引用。',
      });
    }

    facts
      .filter((item) => !item.sourceReferenceIds?.length)
      .forEach((item) => {
        issues.push({
          id: generateId(),
          severity: 'warning',
          category: 'data-without-source',
          message: `事实“${item.label}”缺少来源绑定。`,
          relatedSourceIds: [],
          suggestion: '请为该事实补充参考来源或核验依据。',
        });
      });

    const incompleteReferences = referenceSources.filter(
      (item) => !item.title || item.authors.length === 0 || (!item.year && !item.issuedDate)
    );
    incompleteReferences.forEach((item) => {
      issues.push({
        id: generateId(),
        severity: 'info',
        category: 'incomplete-reference',
        message: `参考条目“${item.title || '未命名条目'}”的元数据不完整。`,
        relatedSourceIds: [item.id],
        suggestion: '建议补充作者、年份或来源信息，避免引用格式不完整。',
      });
    });

    const citedSourceIds = new Set(citationOccurrences.flatMap((item) => item.sourceIds));
    referenceSources
      .filter((item) => !citedSourceIds.has(item.id))
      .forEach((item) => {
        issues.push({
          id: generateId(),
          severity: 'info',
          category: 'unused-reference',
          message: `参考条目“${item.title}”尚未在正文中使用。`,
          relatedSourceIds: [item.id],
          suggestion: '如果该条目最终不使用，可以考虑移出当前文档的参考文献库。',
        });
      });

    const figureAnchorsWithSource = new Set(
      figureTableSourceLinks.filter((item) => item.targetType === 'figure').map((item) => item.targetAnchorId)
    );
    const tableAnchorsWithSource = new Set(
      figureTableSourceLinks.filter((item) => item.targetType === 'table').map((item) => item.targetAnchorId)
    );

    referenceSummary.images
      .filter((item) => !figureAnchorsWithSource.has(item.anchorId))
      .forEach((item) => {
        issues.push({
          id: generateId(),
          severity: 'warning',
          category: 'figure-without-source',
          message: `图题“${item.label}”缺少来源绑定。`,
          relatedSourceIds: [],
          suggestion: '请为该图绑定来源文献或数据来源。',
        });
      });

    referenceSummary.tables
      .filter((item) => !tableAnchorsWithSource.has(item.anchorId))
      .forEach((item) => {
        issues.push({
          id: generateId(),
          severity: 'warning',
          category: 'table-without-source',
          message: `表题“${item.label}”缺少来源绑定。`,
          relatedSourceIds: [],
          suggestion: '请为该表绑定来源文献或数据来源。',
        });
      });

    const citationCoverage = hasBodyContent
      ? Math.min(100, Math.round((citationOccurrences.length / Math.max(1, referenceSources.length || 1)) * 100))
      : 100;

    return {
      generatedAt: new Date().toISOString(),
      overallRisk: issues.some((item) => item.severity === 'error')
        ? 'high'
        : issues.some((item) => item.severity === 'warning')
          ? 'medium'
          : 'low',
      citationCoverage,
      uncitedClaimCount: issues.filter((item) => item.category === 'uncited-claim').length,
      dataWithoutSourceCount: issues.filter((item) => item.category === 'data-without-source').length,
      figureWithoutSourceCount: issues.filter((item) => item.category === 'figure-without-source').length,
      tableWithoutSourceCount: issues.filter((item) => item.category === 'table-without-source').length,
      aiAssistedParagraphCount: documentState.aiAuthorshipRecords.length,
      issues,
    };
  };

  const runPaperSafetyCheck = () => {
    updateDocState({
      paperSafetyReport: buildPaperSafetyPreview(),
    });
    message.success('已生成论文安全检查结果。');
  };

  const removeReferenceSource = (id: string) => {
    updateDocState({
      referenceSources: referenceSources.filter((item) => item.id !== id),
      facts: facts.map((item) => ({
        ...item,
        sourceReferenceIds: (item.sourceReferenceIds ?? []).filter((sourceId) => sourceId !== id),
      })),
      figureTableSourceLinks: figureTableSourceLinks.map((item) => ({
        ...item,
        sourceIds: item.sourceIds.filter((sourceId) => sourceId !== id),
      })),
    });
  };

  const factStatusColorMap: Record<DocumentFact['status'], string> = {
    draft: 'default',
    verified: 'green',
    'needs-review': 'gold',
  };

  const factStatusLabelMap: Record<DocumentFact['status'], string> = {
    draft: '草稿',
    verified: '已核验',
    'needs-review': '待核查',
  };

  const getSourceTitle = (sourceId: string) =>
    referenceSources.find((item) => item.id === sourceId)?.title || '未命名来源';

  return (
    <div style={{ paddingBottom: 16 }}>
      {isPageMode ? (
        <SectionBlock title="页面模式说明">
          <Alert
            type="info"
            showIcon
            message="当前页面模式已支持 DOI 导入、事实与术语管理、论文安全检查。"
            description="参考资料、事实表和论文安全检查可以直接使用；图表来源绑定建议结合标准编辑区域完成。"
          />
        </SectionBlock>
      ) : null}

      <SectionBlock title="参考资料总览">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SummaryPill label="参考材料" value={referenceMaterials.length} />
          <SummaryPill label="文献条目" value={referenceSources.length} />
          <SummaryPill label="文中引用" value={citationOccurrences.length} />
          <SummaryPill label="事实表" value={facts.length} />
        </div>
      </SectionBlock>

      <SectionBlock title="参考材料">
        <MaterialUploader
          materials={referenceMaterials}
          onMaterialsChange={(materials) => updateDocState({ referenceMaterials: materials })}
        />
      </SectionBlock>

      <SectionBlock title="DOI 导入">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input
            value={doiInput}
            onChange={(event) => setDoiInput(event.target.value)}
            onPressEnter={() => void importReferenceByDoi()}
            placeholder="输入 DOI 或 https://doi.org/... 链接"
          />
          <Button type="primary" onClick={() => void importReferenceByDoi()} loading={importingDoi}>
            导入元数据
          </Button>
          <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.6 }}>
            导入后会保存到当前文档的本地文献库，可直接用于文中引用、参考文献表和来源绑定。
          </div>
        </div>
      </SectionBlock>

      <SectionBlock
        title="引用样式"
        extra={
          <Space size={8}>
            <Button size="small" onClick={runPaperSafetyCheck}>
              安全检查
            </Button>
            <Button size="small" onClick={() => void insertBibliography()} disabled={sortedReferenceSources.length === 0}>
              插入参考文献表
            </Button>
          </Space>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Select
            value={citationStyle.styleId}
            options={CITATION_STYLE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            onChange={changeCitationStyle}
          />
          <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.6 }}>
            {selectedText.trim()
              ? `当前已选中 ${selectedText.length} 个字符，插入引用时会优先作用于当前选区。`
              : '当前没有选中文本，插入引用会落在光标位置。'}
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.6 }}>
            当前样式：{citationStyle.styleLabel} / {citationStyle.citationMode}，已记录 {citationOccurrences.length} 条文中引用。
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="本地参考文献库">
        {sortedReferenceSources.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有导入参考文献条目。" />
        ) : (
          <List
            dataSource={sortedReferenceSources}
            renderItem={(item) => (
              <List.Item
                style={{ padding: '10px 0' }}
                actions={[
                  <Button key="cite" type="text" size="small" onClick={() => void insertCitation(item)}>
                    插入引用
                  </Button>,
                  <Button
                    key="select"
                    type="text"
                    size="small"
                    icon={<LinkOutlined />}
                    onClick={() => setSelectedReferenceId(item.id)}
                  >
                    设为当前来源
                  </Button>,
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeReferenceSource(item.id)}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.5 }}>
                        {item.title}
                      </div>
                      <Space size={[6, 6]} wrap>
                        <Tag color="blue">{item.sourceProvider}</Tag>
                        <Tag>{describeType(item.type)}</Tag>
                        {item.year ? <Tag>{item.year}</Tag> : null}
                        {selectedReferenceId === item.id ? <Tag color="green">当前来源</Tag> : null}
                      </Space>
                    </div>
                  }
                  description={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, lineHeight: 1.6 }}>
                      <span>{describeAuthors(item)}</span>
                      {item.containerTitle ? <span>{item.containerTitle}</span> : null}
                      {item.doi ? <span>DOI: {item.doi}</span> : null}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </SectionBlock>

      <SectionBlock title="事实与来源绑定">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input value={factLabel} onChange={(event) => setFactLabel(event.target.value)} placeholder="事实名称，例如：项目周期" />
          <Input value={factValue} onChange={(event) => setFactValue(event.target.value)} placeholder="事实值，例如：12 个月" />
          <div style={{ display: 'flex', gap: 8 }}>
            <Select style={{ width: 140 }} value={factStatus} onChange={(value) => setFactStatus(value)} options={FACT_STATUS_OPTIONS} />
            <Button type="primary" icon={<PlusOutlined />} onClick={addFact}>
              添加事实
            </Button>
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            {selectedReferenceId
              ? `新建事实会默认绑定当前来源：${getSourceTitle(selectedReferenceId)}`
              : '如需同时绑定来源，请先在上方文献库中设为当前来源。'}
          </div>
        </div>

        {facts.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 12 }}>当前还没有事实记录。</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Select
                style={{ flex: 1 }}
                placeholder="选择事实"
                value={selectedFactId}
                onChange={setSelectedFactId}
                options={facts.map((item) => ({ value: item.id, label: item.label }))}
              />
              <Button onClick={bindFactSource} disabled={!selectedFactId || !selectedReferenceId}>
                绑定来源
              </Button>
            </div>
            <List
              style={{ marginTop: 12 }}
              dataSource={facts}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="delete"
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() =>
                        updateDocState({ facts: facts.filter((entry) => entry.id !== item.id) })
                      }
                    />,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space size={6} wrap>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</span>
                        <Tag color={factStatusColorMap[item.status]}>{factStatusLabelMap[item.status]}</Tag>
                      </Space>
                    }
                    description={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                        <span>{item.value}</span>
                        <span style={{ color: '#8c8c8c' }}>
                          来源：
                          {item.sourceReferenceIds?.length
                            ? item.sourceReferenceIds.map(getSourceTitle).join('；')
                            : '未绑定'}
                        </span>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </>
        )}
      </SectionBlock>

      <SectionBlock title="图表来源绑定">
        {isPageMode ? (
          <Alert
            type="info"
            showIcon
            message="当前页面可继续管理图表来源"
            description="如果暂时没有识别到图题或表题，建议先在标准编辑区域完成绑定，已有来源仍会参与论文安全检查。"
          />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Select
                  style={{ flex: 1 }}
                  placeholder="选择图题"
                  value={selectedFigureAnchorId}
                  onChange={setSelectedFigureAnchorId}
                  options={figureOptions}
                />
                <Button onClick={bindFigureSource} disabled={!selectedFigureAnchorId || !selectedReferenceId}>
                  绑定图来源
                </Button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Select
                  style={{ flex: 1 }}
                  placeholder="选择表题"
                  value={selectedTableAnchorId}
                  onChange={setSelectedTableAnchorId}
                  options={tableOptions}
                />
                <Button onClick={bindTableSource} disabled={!selectedTableAnchorId || !selectedReferenceId}>
                  绑定表来源
                </Button>
              </div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                适合专业报告里追踪每张图、每张表的数据出处。
              </div>
            </div>
          </>
        )}

        {figureTableSourceLinks.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 12 }}>当前还没有图表来源绑定。</div>
        ) : (
          <List
            style={{ marginTop: 12 }}
            dataSource={figureTableSourceLinks}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space size={6} wrap>
                      <Tag color={item.targetType === 'figure' ? 'geekblue' : 'purple'}>
                        {item.targetType === 'figure' ? '图' : '表'}
                      </Tag>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{item.captionText || item.targetAnchorId}</span>
                    </Space>
                  }
                  description={
                    <span style={{ fontSize: 12 }}>
                      来源：{item.sourceIds.length ? item.sourceIds.map(getSourceTitle).join('；') : '未绑定'}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </SectionBlock>

      <SectionBlock
        title="论文安全检查"
        extra={
          <Button size="small" onClick={runPaperSafetyCheck}>
            生成检查结果
          </Button>
        }
      >
        {paperSafetyReport ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <SummaryPill label="总体风险" value={paperSafetyReport.overallRisk} />
              <SummaryPill label="引用覆盖" value={`${paperSafetyReport.citationCoverage}%`} />
              <SummaryPill label="图缺来源" value={paperSafetyReport.figureWithoutSourceCount} />
              <SummaryPill label="表缺来源" value={paperSafetyReport.tableWithoutSourceCount} />
            </div>
            {paperSafetyReport.issues.length === 0 ? (
              <div style={{ fontSize: 12, color: '#389e0d' }}>当前未发现明显的引用与来源问题。</div>
            ) : (
              <List
                size="small"
                dataSource={paperSafetyReport.issues}
                renderItem={(item) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <List.Item.Meta
                      title={
                        <Space size={6} wrap>
                          <Tag color={getIssueColor(item.severity)}>{item.severity}</Tag>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{item.message}</span>
                        </Space>
                      }
                      description={<span style={{ fontSize: 12 }}>{item.suggestion || '建议人工复核。'}</span>}
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: 1.7 }}>
            还没有生成论文安全检查结果。建议先完成引用插入、事实来源绑定和图表来源绑定，再执行检查。
          </div>
        )}
      </SectionBlock>

      <SectionBlock title="术语表">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="术语，例如：技术路线" />
          <Input.TextArea value={definition} onChange={(event) => setDefinition(event.target.value)} placeholder="术语说明" rows={2} />
          <Button type="primary" icon={<PlusOutlined />} onClick={addGlossary}>
            添加术语
          </Button>
        </div>
        {glossary.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 12 }}>当前还没有术语记录。</div>
        ) : (
          <List
            style={{ marginTop: 12 }}
            dataSource={glossary}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() =>
                      updateDocState({ glossary: glossary.filter((entry) => entry.id !== item.id) })
                    }
                  />,
                ]}
              >
                <List.Item.Meta
                  title={<span style={{ fontSize: 12, fontWeight: 700 }}>{item.term}</span>}
                  description={<span style={{ fontSize: 12 }}>{item.definition}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </SectionBlock>

      <SectionBlock title="章节摘要">
        {sectionSummaries.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={activeSectionTitle ? `当前章节“${activeSectionTitle}”还没有摘要。` : '当前还没有章节摘要。'}
          />
        ) : (
          <List
            dataSource={sectionSummaries}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={<span style={{ fontSize: 12, fontWeight: 700 }}>{item.title}</span>}
                  description={<span style={{ fontSize: 12, lineHeight: 1.6 }}>{item.summary}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </SectionBlock>
    </div>
  );
}
