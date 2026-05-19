/**
 * FindReplacePanel — Word-like Find & Replace.
 * Supports: text search, batch replace, case-sensitive, whole-word matching,
 * result highlighting, Ctrl+F/Ctrl+H to open.
 */
import { useState, useCallback, useEffect } from 'react';
import { Input, Button, Checkbox, Space, message, Badge } from 'antd';
import { SearchOutlined, CloseOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useEditorStore } from '../../stores/useEditorStore';

interface FindReplacePanelProps {
  visible: boolean;
  onClose: () => void;
  replaceMode?: boolean;
}

export function FindReplacePanel({ visible, onClose, replaceMode = false }: FindReplacePanelProps) {
  const editor = useEditorStore((s) => s.editor);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<Array<{ from: number; to: number }>>([]);

  // Perform search
  const doSearch = useCallback(() => {
    if (!editor || !searchText) {
      setMatches([]); setMatchCount(0); return;
    }

    const results: Array<{ from: number; to: number }> = [];
    const doc = editor.state.doc;
    const content = doc.textContent;
    let searchStr = searchText;

    if (!caseSensitive) {
      searchStr = searchStr.toLowerCase();
      const lowerContent = content.toLowerCase();
      let pos = 0;
      while ((pos = lowerContent.indexOf(searchStr, pos)) !== -1) {
        if (wholeWord) {
          const before = pos > 0 ? content[pos - 1] : ' ';
          const after = pos + searchStr.length < content.length ? content[pos + searchStr.length] : ' ';
          if (/\w/.test(before) || /\w/.test(after)) { pos++; continue; }
        }
        results.push({ from: pos, to: pos + searchStr.length });
        pos++;
      }
    } else {
      let pos = 0;
      while ((pos = content.indexOf(searchStr, pos)) !== -1) {
        if (wholeWord) {
          const before = pos > 0 ? content[pos - 1] : ' ';
          const after = pos + searchStr.length < content.length ? content[pos + searchStr.length] : ' ';
          if (/\w/.test(before) || /\w/.test(after)) { pos++; continue; }
        }
        results.push({ from: pos, to: pos + searchStr.length });
        pos++;
      }
    }

    setMatches(results);
    setMatchCount(results.length);
    setCurrentIndex(0);

    if (results.length > 0) {
      // Navigate to first match
      const first = results[0];
      editor.commands.setTextSelection({ from: first.from + 1, to: first.to + 1 });
      editor.commands.scrollIntoView();
    }
  }, [editor, searchText, caseSensitive, wholeWord]);

  useEffect(() => {
    if (visible) doSearch();
  }, [visible, searchText, caseSensitive, wholeWord, doSearch]);

  // Navigate between matches
  const goToMatch = (index: number) => {
    if (!editor || matches.length === 0) return;
    const m = matches[index];
    editor.commands.setTextSelection({ from: m.from + 1, to: m.to + 1 });
    editor.commands.scrollIntoView();
    setCurrentIndex(index);
  };

  const findNext = () => {
    const next = (currentIndex + 1) % matches.length;
    goToMatch(next);
  };

  const findPrev = () => {
    const prev = (currentIndex - 1 + matches.length) % matches.length;
    goToMatch(prev);
  };

  // Replace
  const replaceOne = () => {
    if (!editor || matches.length === 0) return;
    const m = matches[currentIndex];
    editor.commands.setTextSelection({ from: m.from + 1, to: m.to + 1 });
    editor.commands.insertContent(replaceText);
    // Remove this match and update
    const newMatches = [...matches];
    newMatches.splice(currentIndex, 1);
    setMatches(newMatches);
    setMatchCount(newMatches.length);
    if (newMatches.length > 0) {
      const next = Math.min(currentIndex, newMatches.length - 1);
      goToMatch(next);
    }
  };

  const replaceAll = () => {
    if (!editor || matches.length === 0) return;
    // Replace from end to start to preserve positions
    const sorted = [...matches].sort((a, b) => b.from - a.from);
    for (const m of sorted) {
      editor.commands.setTextSelection({ from: m.from + 1, to: m.to + 1 });
      editor.commands.insertContent(replaceText);
    }
    message.success(`已替换 ${sorted.length} 处`);
    setMatches([]);
    setMatchCount(0);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute', top: 48, right: 16, zIndex: 500,
      background: '#fff', borderRadius: 8, padding: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)', border: '1px solid #e8e8e8',
      width: 340, fontSize: 13,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>
          <SearchOutlined /> {replaceMode ? '查找和替换' : '查找'}
        </span>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      {/* Find input */}
      <Input
        size="small"
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="查找内容..."
        style={{ marginBottom: 6 }}
        autoFocus
        suffix={
          <Badge count={matchCount} size="small" style={{ backgroundColor: matchCount > 0 ? '#1677ff' : '#d9d9d9' }} />
        }
      />

      {/* Replace input (if in replace mode) */}
      {replaceMode && (
        <Input
          size="small"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          placeholder="替换为..."
          style={{ marginBottom: 6 }}
        />
      )}

      {/* Options */}
      <div style={{ marginBottom: 8 }}>
        <Checkbox checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} style={{ fontSize: 12 }}>
          区分大小写
        </Checkbox>
        <Checkbox checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} style={{ fontSize: 12, marginLeft: 8 }}>
          全字匹配
        </Checkbox>
      </div>

      {/* Action buttons */}
      <Space size={4}>
        {replaceMode ? (
          <>
            <Button size="small" onClick={replaceOne} disabled={matches.length === 0}>替换</Button>
            <Button size="small" onClick={replaceAll} disabled={matches.length === 0}>全部替换</Button>
          </>
        ) : null}
        <Button size="small" icon={<ArrowUpOutlined />} onClick={findPrev} disabled={matches.length === 0} />
        <Button size="small" icon={<ArrowDownOutlined />} onClick={findNext} disabled={matches.length === 0} />
      </Space>

      {matchCount > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
          找到 {matchCount} 个结果{currentIndex >= 0 ? `，当前第 ${currentIndex + 1} 个` : ''}
        </div>
      )}
      {searchText && matchCount === 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>
          未找到"{searchText}"
        </div>
      )}
    </div>
  );
}
