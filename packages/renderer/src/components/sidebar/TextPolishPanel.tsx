import { useState, useCallback, useRef } from 'react';
import { Select, Button, Space, Divider, message, Input, Collapse } from 'antd';
import {
  RobotOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { IPC_CHANNELS, type IPCResponse, type PolishRequest, type AIConfig, type ReferenceMaterial, type FrameworkNode } from '@qiuai/shared';
import { usePhaseStore } from '../../stores/usePhaseStore';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { ipcClient } from '../../services/ipcClient';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { streamGenerateText, polishText as aiPolish } from '../../services/aiClient';
import { retrieveRelevantChunks, generateDocumentPlan, getNeighborSummaries, generateSectionSummary, estimateContextTokens, contextFitsInWindow as ragContextFits, chunkReferenceMaterial } from '../../services/ragService';
import { MaterialUploader } from '../phases/Phase3TextGen/MaterialUploader';
import { GenerationConfig } from '../phases/Phase3TextGen/GenerationConfig';
import { GenerationProgress, type SectionProgress, buildProgressFromFramework } from '../phases/Phase3TextGen/GenerationProgress';
import { GeneratedTextReview } from '../phases/Phase3TextGen/GeneratedTextReview';
import { WritingPhase } from '@qiuai/shared';

const polishStyles = [
  { value: 'formal', label: '正式公文风格' },
  { value: 'academic', label: '学术论文风格' },
  { value: 'concise', label: '精简凝练' },
  { value: 'expand', label: '扩展详述' },
];

export function TextPolishPanel() {
  const phase = usePhaseStore((s) => s.currentPhase);
  const frameworkNodes = useFrameworkStore((s) => s.nodes);
  const editor = useEditorStore((s) => s.editor);
  const selectedText = useEditorStore((s) => s.selectedText);
  const doc = useProjectStore((s) => s.doc);
  const setDoc = useProjectStore((s) => s.setDoc);
  const settings = useSettingsStore((s) => s.settings);
  const getActiveConfig = useSettingsStore((s) => s.getActiveConfig);

  // Polish state
  const [polishStyle, setPolishStyle] = useState<string>('formal');
  const [polishing, setPolishing] = useState(false);
  const [polishResult, setPolishResult] = useState<string>('');

  // Text generation state (Phase 3)
  const [materials, setMaterials] = useState<ReferenceMaterial[]>([]);
  const [sections, setSections] = useState<SectionProgress[]>(
    buildProgressFromFramework(frameworkNodes)
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratedText, setLastGeneratedText] = useState('');
  const [lastSectionTitle, setLastSectionTitle] = useState('');
  const abortRef = useRef(false);

  // Polish handler
  const handlePolish = async () => {
    const text = selectedText || editor?.getText() || '';
    if (!text.trim()) {
      message.warning('请先在编辑区选中需要润色的文本');
      return;
    }

    setPolishing(true);
    try {
      const aiConfig = getActiveConfig();

      // Use real AI client if API key is set, otherwise fall back to IPC/mock
      const result = await aiPolish({
        originalText: text,
        style: polishStyle as PolishRequest['style'],
        aiConfig,
      });

      setPolishResult(result);
    } catch {
      message.error('润色请求失败');
    } finally {
      setPolishing(false);
    }
  };

  const handleApplyPolish = () => {
    if (polishResult && editor) {
      editor.commands.insertContent(polishResult);
      setPolishResult('');
      message.success('润色结果已应用');
    }
  };

  // Text generation handlers (Phase 3)
  const flattenNodes = useCallback((nodes: FrameworkNode[]): FrameworkNode[] => {
    const result: FrameworkNode[] = [];
    for (const node of nodes) {
      result.push(node);
      result.push(...flattenNodes(node.children));
    }
    return result;
  }, []);

  const generateOneSection = async (node: FrameworkNode) => {
    if (!editor) return;

    // Update section status to generating
    setSections((prev) =>
      prev.map((s) =>
        s.nodeId === node.id ? { ...s, status: 'generating' as const } : s
      )
    );

    try {
      const aiConfig = getActiveConfig();

      // Insert heading into editor first
      editor.commands.insertContent(
        `<h${Math.min(node.level, 3)}>${node.title}</h${Math.min(node.level, 3)}><p></p>`
      );

      // === RAG Context Building ===
      // 1. Chunk all reference materials
      const allChunks = materials.flatMap((m) => chunkReferenceMaterial(m));

      // 2. Retrieve relevant chunks for this section
      const headingPath = [node.title];
      const relevantChunks = retrieveRelevantChunks(
        allChunks.length > 0 ? allChunks : materials.flatMap((m) => m.chunks),
        node.title,
        headingPath,
        settings.dataKeywords || [],
        8 // top-K
      );

      // 3. Build document plan from framework
      const documentPlan = doc.documentPlan || generateDocumentPlan(
        useFrameworkStore.getState().nodes,
        doc.title
      );

      // 4. Get neighbor summaries for context continuity
      const neighborSummaries = getNeighborSummaries(
        new Map(), // Will be populated after each section generation
        node.id,
        useFrameworkStore.getState().nodes,
        2
      );

      // 5. Check context token budget
      const estimatedTokens = estimateContextTokens(
        node.title,
        relevantChunks,
        neighborSummaries,
        documentPlan
      );

      const maxTokens = aiConfig.maxTokens || 8192;
      const fitsInWindow = ragContextFits(estimatedTokens, maxTokens);

      // If too many tokens, trim chunks to fit
      let finalChunks = relevantChunks;
      if (!fitsInWindow && relevantChunks.length > 3) {
        // Reduce to top 3 most relevant chunks
        finalChunks = relevantChunks.slice(0, 3);
      }

      // Use real AI streaming client with RAG context
      let fullText = '';
      const generator = streamGenerateText({
        sectionId: node.id,
        sectionTitle: node.title,
        headingPath,
        referenceChunks: finalChunks,
        neighborSummaries,
        documentPlan,
        dataKeywords: settings.dataKeywords || [],
        aiConfig,
      });

      for await (const chunk of generator) {
        fullText += chunk;
        // Update the review panel in real-time
        setLastGeneratedText(fullText);
        setLastSectionTitle(node.title);
      }

      // Insert generated content into editor
      if (fullText && !fullText.startsWith('[错误]') && !fullText.startsWith('[提示]')) {
        editor.commands.insertContent(fullText);
      }

      setSections((prev) =>
        prev.map((s) =>
          s.nodeId === node.id ? { ...s, status: 'done' as const } : s
        )
      );
    } catch (err: any) {
      setSections((prev) =>
        prev.map((s) =>
          s.nodeId === node.id
            ? { ...s, status: 'error' as const, error: err.message }
            : s
        )
      );
      message.error(`生成"${node.title}"失败: ${err.message}`);
    }
  };

  const handleGenerateAll = async () => {
    if (materials.length === 0) {
      message.warning('请先上传参考资料');
      return;
    }

    abortRef.current = false;
    setIsGenerating(true);
    const allNodes = flattenNodes(frameworkNodes);

    // Reset all sections to pending
    setSections(allNodes.map((n) => ({ nodeId: n.id, title: n.title, status: 'pending' as const })));

    for (const node of allNodes) {
      if (abortRef.current) break;
      await generateOneSection(node);
    }

    setIsGenerating(false);
    message.success('全部章节生成完成');
  };

  const handleGenerateSection = async (nodeId: string) => {
    const allNodes = flattenNodes(frameworkNodes);
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node) return;
    await generateOneSection(node);
  };

  // Render different content based on phase
  const renderPhase3Content = () => (
    <>
      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        <RobotOutlined /> AI文本生成
      </h4>

      <Collapse
        size="small"
        defaultActiveKey={['materials', 'config']}
        items={[
          {
            key: 'materials',
            label: '上传参考资料',
            children: (
              <MaterialUploader
                materials={materials}
                onMaterialsChange={setMaterials}
              />
            ),
          },
          {
            key: 'config',
            label: 'AI模型设置',
            children: (
              <GenerationConfig
                config={getActiveConfig()}
                onChange={(cfg) => {
                  useSettingsStore.getState().updateProviderConfig(
                    settings.activeProvider,
                    cfg
                  );
                }}
              />
            ),
          },
        ]}
      />

      <Divider style={{ margin: '12px 0' }} />

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
          const allNodes = flattenNodes(frameworkNodes);
          const currentSection = allNodes.find(
            (n) => n.title === lastSectionTitle
          );
          if (currentSection) {
            generateOneSection(currentSection);
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
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
          润色风格
        </label>
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
          : '提示：在编辑区选中需润色的文本'}
      </div>

      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        loading={polishing}
        onClick={handlePolish}
        block
        size="small"
        style={{ marginBottom: 8 }}
      >
        开始润色
      </Button>

      {polishResult && (
        <>
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 500 }}>润色结果：</label>
            <div
              style={{
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 4,
                padding: 8,
                fontSize: 12,
                maxHeight: 200,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {polishResult}
            </div>
          </div>
          <Space>
            <Button size="small" onClick={handleApplyPolish} type="primary">
              应用到编辑区
            </Button>
            <Button size="small" onClick={() => setPolishResult('')}>
              放弃
            </Button>
          </Space>
        </>
      )}
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
