import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { Badge, Button, Checkbox, Input, Space, message } from 'antd';
import { replaceCurrentSelection } from '../../services/documentEngineCommands';
import { useDocumentEngineStore } from '../../stores/useDocumentEngineStore';
import { useEditorStore } from '../../stores/useEditorStore';
import type {
  DocumentEngineFindResult,
  DocumentEngineReplaceResult,
} from '../../types/documentEngine';
import { supportsDocumentFindReplace } from '../../utils/documentEngineCapabilities';

interface FindReplacePanelProps {
  visible: boolean;
  onClose: () => void;
  replaceMode?: boolean;
}

interface TipTapMatch {
  from: number;
  to: number;
}

function buildTipTapMatches(
  content: string,
  query: string,
  caseSensitive: boolean,
  wholeWord: boolean
): TipTapMatch[] {
  if (!query) {
    return [];
  }

  const keyword = caseSensitive ? query : query.toLowerCase();
  const source = caseSensitive ? content : content.toLowerCase();
  const results: TipTapMatch[] = [];
  let position = 0;

  while ((position = source.indexOf(keyword, position)) !== -1) {
    if (wholeWord) {
      const before = position > 0 ? content[position - 1] : ' ';
      const after = position + query.length < content.length ? content[position + query.length] : ' ';
      if (/\w/.test(before) || /\w/.test(after)) {
        position += 1;
        continue;
      }
    }

    results.push({ from: position, to: position + query.length });
    position += Math.max(1, query.length);
  }

  return results;
}

export function FindReplacePanel({
  visible,
  onClose,
  replaceMode = false,
}: FindReplacePanelProps) {
  const editor = useEditorStore((state) => state.editor);
  const documentEngineAdapter = useDocumentEngineStore((state) => state.adapter);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [matches, setMatches] = useState<TipTapMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const panelTitle = useMemo(() => (replaceMode ? '查找和替换' : '导航查找'), [replaceMode]);
  const usingEngineFindReplace = supportsDocumentFindReplace(documentEngineAdapter);

  const syncPreviewResult = useCallback((result: DocumentEngineFindResult | DocumentEngineReplaceResult) => {
    setMatchCount(result.matchCount);
    setCurrentIndex(result.currentIndex);
  }, []);

  const doTipTapSearch = useCallback(() => {
    if (!editor || !searchText) {
      setMatches([]);
      setMatchCount(0);
      setCurrentIndex(-1);
      return;
    }

    const results = buildTipTapMatches(editor.state.doc.textContent, searchText, caseSensitive, wholeWord);
    setMatches(results);
    setMatchCount(results.length);
    setCurrentIndex(results.length > 0 ? 0 : -1);

    if (results.length > 0) {
      const first = results[0];
      editor.commands.setTextSelection({ from: first.from + 1, to: first.to + 1 });
      editor.commands.scrollIntoView();
    }
  }, [caseSensitive, editor, searchText, wholeWord]);

  const doPreviewSearch = useCallback(
    async (direction: 'current' | 'next' | 'prev' = 'current') => {
      if (!usingEngineFindReplace || !documentEngineAdapter?.findInDocument) {
        return;
      }

      if (!searchText.trim()) {
        setMatchCount(0);
        setCurrentIndex(-1);
        return;
      }

      setLoading(true);
      try {
        const result = await documentEngineAdapter.findInDocument({
          query: searchText,
          caseSensitive,
          wholeWord,
          direction,
        });
        syncPreviewResult(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '查找失败';
        message.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [caseSensitive, documentEngineAdapter, searchText, syncPreviewResult, usingEngineFindReplace, wholeWord]
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (usingEngineFindReplace) {
      void doPreviewSearch('current');
      return;
    }

    doTipTapSearch();
  }, [visible, searchText, caseSensitive, wholeWord, doPreviewSearch, doTipTapSearch, usingEngineFindReplace]);

  const goToTipTapMatch = (index: number) => {
    if (!editor || matches.length === 0) return;
    const normalizedIndex = ((index % matches.length) + matches.length) % matches.length;
    const target = matches[normalizedIndex];
    editor.commands.setTextSelection({ from: target.from + 1, to: target.to + 1 });
    editor.commands.scrollIntoView();
    setCurrentIndex(normalizedIndex);
  };

  const findNext = () => {
    if (usingEngineFindReplace) {
      void doPreviewSearch('next');
      return;
    }
    if (matches.length === 0) return;
    goToTipTapMatch(currentIndex + 1);
  };

  const findPrev = () => {
    if (usingEngineFindReplace) {
      void doPreviewSearch('prev');
      return;
    }
    if (matches.length === 0) return;
    goToTipTapMatch(currentIndex - 1);
  };

  const replaceOne = async () => {
    if (usingEngineFindReplace && documentEngineAdapter?.replaceInDocument) {
      if (!searchText.trim()) return;
      setLoading(true);
      try {
        const result = await documentEngineAdapter.replaceInDocument({
          query: searchText,
          replaceText,
          caseSensitive,
          wholeWord,
          mode: 'current',
          direction: 'current',
        });
        syncPreviewResult(result);
        if (result.replacedCount > 0) {
          message.success('已替换当前结果');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '替换失败';
        message.error(errorMessage);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!editor || matches.length === 0 || currentIndex < 0) return;
    const target = matches[currentIndex];
    editor.commands.setTextSelection({ from: target.from + 1, to: target.to + 1 });
    await replaceCurrentSelection(replaceText);
    doTipTapSearch();
  };

  const replaceAll = async () => {
    if (usingEngineFindReplace && documentEngineAdapter?.replaceInDocument) {
      if (!searchText.trim()) return;
      setLoading(true);
      try {
        const result = await documentEngineAdapter.replaceInDocument({
          query: searchText,
          replaceText,
          caseSensitive,
          wholeWord,
          mode: 'all',
          direction: 'current',
        });
        syncPreviewResult(result);
        message.success(`已替换 ${result.replacedCount} 处内容`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '全部替换失败';
        message.error(errorMessage);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!editor || matches.length === 0) return;

    const sorted = [...matches].sort((a, b) => b.from - a.from);
    for (const target of sorted) {
      editor.commands.setTextSelection({ from: target.from + 1, to: target.to + 1 });
      await replaceCurrentSelection(replaceText);
    }

    message.success(`已替换 ${sorted.length} 处内容`);
    doTipTapSearch();
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 24,
        right: 20,
        zIndex: 500,
        background: '#fff',
        borderRadius: 12,
        padding: 14,
        boxShadow: '0 16px 36px rgba(0,0,0,0.16)',
        border: '1px solid #e5e7eb',
        width: 392,
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, color: '#1f1f1f' }}>
            <SearchOutlined /> {panelTitle}
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
            固定停靠在编辑区右上角，便于连续浏览和替换结果。
          </div>
        </div>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input
          size="small"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="输入要查找的内容"
          autoFocus
          suffix={
            <Badge
              count={matchCount}
              size="small"
              style={{ backgroundColor: matchCount > 0 ? '#1677ff' : '#d9d9d9' }}
            />
          }
        />

        {replaceMode ? (
          <Input
            size="small"
            value={replaceText}
            onChange={(event) => setReplaceText(event.target.value)}
            placeholder="输入替换后的内容"
          />
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <Checkbox
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
              style={{ fontSize: 12 }}
            >
              区分大小写
            </Checkbox>
            <Checkbox
              checked={wholeWord}
              onChange={(event) => setWholeWord(event.target.checked)}
              style={{ fontSize: 12, marginLeft: 8 }}
            >
              全字匹配
            </Checkbox>
          </div>
          <Space size={4}>
            <Button size="small" icon={<ArrowUpOutlined />} onClick={findPrev} disabled={matchCount === 0} loading={loading} />
            <Button size="small" icon={<ArrowDownOutlined />} onClick={findNext} disabled={matchCount === 0} loading={loading} />
          </Space>
        </div>

        {replaceMode ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" onClick={() => void replaceOne()} disabled={matchCount === 0} loading={loading}>
              替换
            </Button>
            <Button size="small" onClick={() => void replaceAll()} disabled={matchCount === 0} loading={loading}>
              全部替换
            </Button>
          </div>
        ) : null}
      </div>

      {matchCount > 0 ? (
        <div style={{ marginTop: 12, fontSize: 11, color: '#666' }}>
          找到 {matchCount} 处结果，当前第 {currentIndex + 1} 处。
        </div>
      ) : searchText ? (
        <div style={{ marginTop: 12, fontSize: 11, color: '#999' }}>
          未找到“{searchText}”。
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 11, color: '#999' }}>
          输入关键词后会在当前文档中实时定位。
        </div>
      )}
    </div>
  );
}
