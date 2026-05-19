/**
 * SymbolPanel — Insert special characters (math, Greek, punctuation, units).
 * Research proposal writing needs: ℃ ± × ÷ ≥ ≤ → ← ↑ ↓ ① ② ③ α β γ etc.
 */
import { useState } from 'react';
import { Modal, Tabs, Button, message } from 'antd';
import { useEditorStore } from '../../stores/useEditorStore';

interface Props { open: boolean; onClose: () => void; }

const SYMBOLS: Record<string, string[]> = {
  '数学': ['±','×','÷','=','≠','≈','≡','≤','≥','＜','＞','∞','√','∑','∏','∫','∂','∇','∈','∉','⊂','⊃','∪','∩','∧','∨','¬','⇒','⇔','∀','∃','%','‰','′','″','°','∠','⊥','∥'],
  '希腊': ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','ο','π','ρ','σ','τ','υ','φ','χ','ψ','ω','Α','Β','Γ','Δ','Ε','Ζ','Η','Θ','Ι','Κ','Λ','Μ','Ν','Ξ','Ο','Π','Ρ','Σ','Τ','Υ','Φ','Χ','Ψ','Ω'],
  '单位': ['℃','℉','㎎','㎏','㎜','㎝','㎞','㎡','㎥','㏄','㎖','㎧','㎨','㎩','㎫','㎭','㏉','㏊','㎐','㎑','㎒','㎓','㎔','Å','ppm','ppb'],
  '序号': ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑴','⑵','⑶','⑷','⑸','⒈','⒉','⒊','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ'],
  '标点': ['「」','『』','【】','《》','〈〉','“”','‘’','…','—','～','·','、','：','；','！','？','（','）'],
  '箭头': ['→','←','↑','↓','↔','⇒','⇐','⇑','⇓','⇔','↗','↘','↙','↖','➔','➤','⏎','↵'],
  '货币': ['¥','$','€','£','₹','₽','₩','₿','₫'],
  '特殊': ['©','®','™','†','‡','§','¶','•','◉','○','●','□','■','△','▲','☆','★','♦','✓','✗','☐','☑','☒','♻','⚡','⚠'],
};

export function SymbolPanel({ open, onClose }: Props) {
  const editor = useEditorStore((s) => s.editor);
  const [activeTab, setActiveTab] = useState('数学');

  const insert = (sym: string) => {
    editor?.commands.insertContent(sym);
    message.success(`已插入 ${sym}`);
  };

  return (
    <Modal title="插入符号" open={open} onCancel={onClose} footer={null} width={520}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} size="small"
        items={Object.entries(SYMBOLS).map(([cat, syms]) => ({
          key: cat, label: cat,
          children: (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 300, overflow: 'auto' }}>
              {syms.map((s, i) => (
                <Button key={i} size="small" type="text"
                  style={{ minWidth: 36, height: 36, fontSize: 16, fontFamily: 'serif' }}
                  onClick={() => insert(s)} title={s}
                >{s}</Button>
              ))}
            </div>
          ),
        }))}
      />
    </Modal>
  );
}
