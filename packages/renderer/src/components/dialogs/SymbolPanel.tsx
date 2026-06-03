import { useState } from 'react';
import { Button, Modal, Tabs, message } from 'antd';
import { insertDocumentText } from '../../services/documentEngineCommands';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SYMBOLS: Record<string, string[]> = {
  数学: ['±', '×', '÷', '=', '≠', '≈', '≤', '≥', '∑', '∏', '√', '∞', '∫', '∂'],
  希腊: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'σ', 'φ', 'ω'],
  单位: ['℃', '℉', 'μm', 'nm', 'mm', 'cm', 'kg', 'g', 'mg', 'mL', 'L', 'Pa'],
  标点: ['、', '。', '；', '：', '（', '）', '《', '》', '“', '”', '‘', '’'],
};

export function SymbolPanel({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState('数学');

  const insert = async (symbol: string) => {
    const applied = await insertDocumentText(symbol);
    if (!applied) {
      message.warning('当前插入位置无法加入符号，请调整光标位置后重试。');
      return;
    }
    message.success(`已插入 ${symbol}`);
  };

  return (
    <Modal title="插入符号" open={open} onCancel={onClose} footer={null} width={520}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        items={Object.entries(SYMBOLS).map(([category, values]) => ({
          key: category,
          label: category,
          children: (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 300, overflow: 'auto' }}>
              {values.map((symbol) => (
                <Button
                  key={symbol}
                  size="small"
                  type="text"
                  style={{ minWidth: 40, height: 36, fontSize: 16, fontFamily: 'serif' }}
                  onClick={() => void insert(symbol)}
                >
                  {symbol}
                </Button>
              ))}
            </div>
          ),
        }))}
      />
    </Modal>
  );
}
