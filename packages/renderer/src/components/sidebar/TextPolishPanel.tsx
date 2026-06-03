import { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Collapse, Divider, Select, Space, message } from 'antd';
import { RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import {
  type FrameworkNode,
  type PolishRequest,
  type ReferenceMaterial,
  WritingPhase,
} from '@qiuai/shared';
import { generateText, polishText as aiPolish } from '../../services/aiClient';
import {
  chunkReferenceMaterial,
  contextFitsInWindow as ragContextFits,
  estimateContextTokens,
  generateDocumentPlan,
  getNeighborSummaries,
  retrieveRelevantChunks,
} from '../../services/ragService';
import {
  getCurrentSelectedText,
  insertDocumentHtml,
  insertDocumentText,
  replaceSelectionWithAgentTracking,
} from '../../services/documentEngineCommands';
import { generateAndApplyFullPaperFromOutline } from '../../services/fullPaperGeneration';
import { useEditorStore } from '../../stores/useEditorStore';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { usePhaseStore } from '../../stores/usePhaseStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { GenerationConfig } from '../phases/Phase3TextGen/GenerationConfig';
import {
  buildProgressFromFramework,
  GenerationProgress,
  type SectionProgress,
} from '../phases/Phase3TextGen/GenerationProgress';
import { GeneratedTextReview } from '../phases/Phase3TextGen/GeneratedTextReview';
import { MaterialUploader } from '../phases/Phase3TextGen/MaterialUploader';

const polishStyles = [
  { value: 'formal', label: '正式公文风格' },
  { value: 'academic', label: '学术论文风格' },
  { value: 'concise', label: '精简凝练' },
  { value: 'expand', label: '扩展详述' },
];

function flattenFrameworkNodes(nodes: FrameworkNode[]): FrameworkNode[] {
  return nodes.flatMap((node) => [node, ...flattenFrameworkNodes(node.children)]);
}

export function TextPolishPanel() {
  const phase = usePhaseStore((state) => state.currentPhase);
  const frameworkNodes = useFrameworkStore((state) => state.nodes);
  const selectedText = useEditorStore((state) => state.selectedText);
  const doc = useProjectStore((state) => state.doc);
  const setDoc = useProjectStore((state) => state.setDoc);
  const settings = useSettingsStore((state) => state.settings);
  const getWritingConfig = useSettingsStore((state) => state.getWritingConfig);
  const setPhase = usePhaseStore((state) => state.setPhase);

  const [polishStyle, setPolishStyle] = useState<string>('formal');
  const [polishing, setPolishing] = useState(false);
  const [polishStatus, setPolishStatus] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const [materials, setMaterials] = useState<ReferenceMaterial[]>([]);
  const [sections, setSections] = useState<SectionProgress[]>(buildProgressFromFramework(frameworkNodes));
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratedText, setLastGeneratedText] = useState('');
  const [lastSectionTitle, setLastSectionTitle] = useState('');
  const [isGeneratingFullPaper, setIsGeneratingFullPaper] = useState(false);
  const abortRef = useRef(false);

  const flattenedNodes = useMemo(() => flattenFrameworkNodes(frameworkNodes), [frameworkNodes]);

  const updateSectionStatus = useCallback((nodeId: string, patch: Partial<SectionProgress>) => {
    setSections((prev) =>
      prev.map((section) => (section.nodeId === nodeId ? { ...section, ...patch } : section))
    );
  }, []);

  const handleMaterialsChange = useCallback(
    (nextMaterials: ReferenceMaterial[]) => {
      setMaterials(nextMaterials);
      setDoc({
        ...doc,
        updatedAt: new Date().toISOString(),
        referenceMaterials: nextMaterials,
        documentState: {
          ...doc.documentState,
          referenceMaterials: nextMaterials,
        },
      });
    },
    [doc, setDoc]
  );

  const handlePolish = async () => {
    const selectedTextSnapshot = await getCurrentSelectedText();
    if (!selectedTextSnapshot.trim()) {
      message.warning('请先在编辑区选中需要润色的文本');
      return;
    }

    setPolishing(true);
    setPolishStatus({ type: 'info', text: '正在调用 AI 处理选中文本，请稍候...' });
    message.open({
      key: 'text-polish',
      type: 'loading',
      content: '正在调用 AI 处理选中文本...',
      duration: 0,
    });
    try {
      const writingConfig = getWritingConfig();
      const result = await aiPolish({
        originalText: selectedTextSnapshot,
        style: polishStyle as PolishRequest['style'],
        aiConfig: writingConfig,
      });

      const applyResult = await replaceSelectionWithAgentTracking({
        text: result,
        expectedSelectionText: selectedTextSnapshot,
        provider: writingConfig.provider,
        model: writingConfig.model,
        reason: `sidebar-${polishStyle}`,
      });

      if (applyResult.selectionChanged) {
        const warning = '当前选区在 AI 处理过程中发生了变化，为避免替换错位置，请重新选中文本后再试。';
        setPolishStatus({ type: 'error', text: warning });
        message.open({
          key: 'text-polish',
          type: 'warning',
          content: warning,
        });
        return;
      }

      if (!applyResult.applied) {
        throw new Error('AI 已返回结果，但未能写入当前选区');
      }

      setPolishStatus({
        type: 'success',
        text: applyResult.saveError
          ? '润色结果已直接替换当前选区，但自动保存失败，请手动保存一次。'
          : '润色结果已直接替换当前选区。',
      });
      message.open({
        key: 'text-polish',
        type: applyResult.saveError ? 'warning' : 'success',
        content: applyResult.saveError ? '润色结果已应用，但自动保存失败' : '润色结果已应用到当前选区',
      });
      if (applyResult.saveError) {
        message.warning(applyResult.saveError);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '润色请求失败';
      setPolishStatus({ type: 'error', text: errorMessage });
      message.open({
        key: 'text-polish',
        type: 'error',
        content: errorMessage,
      });
      message.error(errorMessage);
    } finally {
      setPolishing(false);
    }
  };

  const generateOneSection = async (node: FrameworkNode) => {
    updateSectionStatus(node.id, { status: 'generating', error: undefined });

    try {
      const aiConfig = getWritingConfig();
      await insertDocumentHtml(`<h${Math.min(node.level, 3)}>${node.title}</h${Math.min(node.level, 3)}><p></p>`);

      const allChunks = materials.flatMap((material) => chunkReferenceMaterial(material));
      const headingPath = [node.title];
      const relevantChunks = retrieveRelevantChunks(
        allChunks.length > 0 ? allChunks : materials.flatMap((material) => material.chunks),
        node.title,
        headingPath,
        settings.dataKeywords || [],
        8
      );

      const documentPlan =
        doc.documentPlan || generateDocumentPlan(useFrameworkStore.getState().nodes, doc.title);
      const neighborSummaries = getNeighborSummaries(new Map(), node.id, useFrameworkStore.getState().nodes, 2);
      const estimatedTokens = estimateContextTokens(node.title, relevantChunks, neighborSummaries, documentPlan);
      const maxTokens = aiConfig.maxTokens || 8192;
      const finalChunks =
        !ragContextFits(estimatedTokens, maxTokens) && relevantChunks.length > 3
          ? relevantChunks.slice(0, 3)
          : relevantChunks;

      const result = await generateText({
        sectionId: node.id,
        sectionTitle: node.title,
        headingPath,
        referenceChunks: finalChunks,
        neighborSummaries,
        documentPlan,
        dataKeywords: settings.dataKeywords || [],
        aiConfig,
        existingPaperSpineMemory: doc.documentState.paperSpineMemories.find((item) => item.sectionId === node.id),
      });

      const fullText = result.content || '';
      setLastGeneratedText(fullText);
      setLastSectionTitle(node.title);

      if (result.paperSpineEnhancement && result.paperSpineSource !== 'reused') {
        const currentDoc = useProjectStore.getState().doc;
        const nextMemories = [
          ...(currentDoc.documentState.paperSpineMemories || []).filter((item) => item.sectionId !== node.id),
          {
            sectionId: node.id,
            sectionTitle: node.title,
            enhancement: result.paperSpineEnhancement,
            generatedAt: new Date().toISOString(),
          },
        ];

        setDoc({
          ...currentDoc,
          updatedAt: new Date().toISOString(),
          documentState: {
            ...currentDoc.documentState,
            paperSpineMemories: nextMemories,
          },
        });
      }

      if (fullText && !fullText.startsWith('[错误]') && !fullText.startsWith('[提示]')) {
        await insertDocumentText(fullText);
      }

      updateSectionStatus(node.id, { status: 'done' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : '生成失败';
      updateSectionStatus(node.id, { status: 'error', error: detail });
      message.error(`生成“${node.title}”失败：${detail}`);
    }
  };

  const handleGenerateAll = async () => {
    if (flattenedNodes.length === 0) {
      message.warning('请先导入文档大纲');
      return;
    }

    abortRef.current = false;
    setIsGenerating(true);
    setSections(
      flattenedNodes.map((node) => ({
        nodeId: node.id,
        title: node.title,
        status: 'pending' as const,
      }))
    );

    for (const node of flattenedNodes) {
      if (abortRef.current) {
        break;
      }
      await generateOneSection(node);
    }

    setIsGenerating(false);
    message.success('全部章节生成完成');
  };

  const handleGenerateFullPaper = async () => {
    if (flattenedNodes.length === 0) {
      message.warning('请先导入文档大纲');
      return;
    }

    setIsGeneratingFullPaper(true);
    setIsGenerating(true);
    setSections(
      flattenedNodes.map((node) => ({
        nodeId: node.id,
        title: node.title,
        status: 'pending' as const,
      }))
    );

    try {
      await generateAndApplyFullPaperFromOutline({
        aiConfig: getWritingConfig(),
        referenceMaterials: materials,
        dataKeywords: settings.dataKeywords || [],
        shouldAbort: () => abortRef.current,
        onProgress: (progress) => {
          if (!progress.nodeId) {
            return;
          }

          if (progress.stage === 'section-start') {
            updateSectionStatus(progress.nodeId, { status: 'generating', error: undefined });
          }

          if (progress.stage === 'section-done') {
            updateSectionStatus(progress.nodeId, { status: 'done', error: undefined });
          }
        },
      });

      setPhase(WritingPhase.TEXT_GEN);
      message.success('已根据当前大纲和内置论文规范生成完整论文');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '整篇论文生成失败');
    } finally {
      setIsGeneratingFullPaper(false);
      setIsGenerating(false);
    }
  };

  const handleGenerateSection = async (nodeId: string) => {
    const node = flattenedNodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    await generateOneSection(node);
  };

  const renderPhase3Content = () => (
    <>
      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        <RobotOutlined /> AI 文本生成
      </h4>

      <Collapse
        size="small"
        defaultActiveKey={['materials', 'config']}
        items={[
          {
            key: 'materials',
            label: '上传参考资料',
            children: <MaterialUploader materials={materials} onMaterialsChange={handleMaterialsChange} />,
          },
          {
            key: 'config',
            label: 'AI 模型设置',
            children: (
              <GenerationConfig
                config={getWritingConfig()}
                onChange={(cfg) => {
                  useSettingsStore.getState().updateProviderConfig('deepseek', cfg);
                }}
              />
            ),
          },
        ]}
      />

      <Divider style={{ margin: '12px 0' }} />

      <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }} size={8}>
        <Button
          type="primary"
          block
          size="small"
          loading={isGeneratingFullPaper}
          disabled={isGenerating}
          onClick={() => void handleGenerateFullPaper()}
        >
          {isGeneratingFullPaper ? '正在生成整篇论文...' : '按论文规范生成全文'}
        </Button>
        <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6 }}>
          导入大纲后可直接生成完整论文。未上传参考资料时也可以生成；上传资料后，AI 会优先结合材料提升正文质量。
        </div>
      </Space>

      <GenerationProgress
        sections={sections}
        onGenerateAll={handleGenerateAll}
        onGenerateSection={handleGenerateSection}
        isGenerating={isGenerating}
      />

      <GeneratedTextReview
        lastGeneratedText={lastGeneratedText}
        sectionTitle={lastSectionTitle}
        onAccept={() => {
          setLastGeneratedText('');
          setLastSectionTitle('');
        }}
        onRegenerate={() => {
          const currentSection = flattenedNodes.find((item) => item.title === lastSectionTitle);
          if (currentSection) {
            void generateOneSection(currentSection);
          }
        }}
        onClear={() => {
          setLastGeneratedText('');
          setLastSectionTitle('');
        }}
      />
    </>
  );

  const renderPolishContent = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>润色风格</label>
        <Select
          value={polishStyle}
          onChange={setPolishStyle}
          options={polishStyles}
          style={{ width: '100%' }}
          size="small"
        />
      </div>

      <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
        {selectedText
          ? `已选中 ${selectedText.length} 个字符`
          : '提示：请先在编辑区选中需要润色的文本'}
      </div>

      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        loading={polishing}
        onClick={() => void handlePolish()}
        block
        size="small"
        style={{ marginBottom: 8 }}
      >
        开始润色
      </Button>

      {polishStatus ? (
        <div
          style={{
            marginBottom: 8,
            padding: '8px 10px',
            borderRadius: 6,
            border:
              polishStatus.type === 'error'
                ? '1px solid #ffccc7'
                : polishStatus.type === 'success'
                  ? '1px solid #b7eb8f'
                  : '1px solid #91caff',
            background:
              polishStatus.type === 'error'
                ? '#fff2f0'
                : polishStatus.type === 'success'
                  ? '#f6ffed'
                  : '#f0f8ff',
            fontSize: 12,
            color:
              polishStatus.type === 'error'
                ? '#a8071a'
                : polishStatus.type === 'success'
                  ? '#237804'
                  : '#0958d9',
          }}
        >
          {polishStatus.text}
        </div>
      ) : null}

    </>
  );

  return (
    <div style={{ padding: '12px 8px' }}>
      {phase === WritingPhase.TEXT_GEN || phase === WritingPhase.SLOTS ? (
        renderPhase3Content()
      ) : (
        <>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            <ThunderboltOutlined /> 文本润色
          </h4>
          {renderPolishContent()}
        </>
      )}
    </div>
  );
}
