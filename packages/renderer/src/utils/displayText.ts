export function normalizeStyleLabel(label: string): string {
  if (!label) return '\u6b63\u6587';
  if (label.includes('\u6b63\u6587') || label.includes('\u59dd\uff44\u67c3')) return '\u6b63\u6587';
  if (label.includes('\u6807\u9898 1') || label.includes('\u93cd\u56ee\ue57d 1')) return '\u6807\u9898 1';
  if (label.includes('\u6807\u9898 2') || label.includes('\u93cd\u56ee\ue57d 2')) return '\u6807\u9898 2';
  if (label.includes('\u6807\u9898 3') || label.includes('\u93cd\u56ee\ue57d 3')) return '\u6807\u9898 3';
  if (label.includes('\u56fe\u6ce8') || label.includes('\u935b\u747e\u6549')) return '\u56fe\u6ce8';
  if (label.includes('\u8868\u6ce8') || label.includes('\u741b\u64b3\u6549')) return '\u8868\u6ce8';
  if (label.includes('\u5f15\u7528') || label.includes('\u5bee\u66ef\u6549')) return '\u5f15\u7528';
  if (label.includes('\u526f\u6807\u9898') || label.includes('\u9353\ue7d3\u7228\u98a8')) return '\u526f\u6807\u9898';
  return label;
}

export const DISPLAY_ALIGN_LABELS = {
  left: '\u5de6\u5bf9\u9f50',
  center: '\u5c45\u4e2d',
  right: '\u53f3\u5bf9\u9f50',
  justify: '\u4e24\u7aef\u5bf9\u9f50',
} as const;

export const DISPLAY_TASK_PANE_LABELS = {
  properties: '\u5c5e\u6027',
  strategy: '\u5199\u4f5c\u7b56\u7565',
  assistant: 'AI \u52a9\u624b',
  review: '\u5ba1\u9605',
  references: '\u53c2\u8003\u8d44\u6599',
} as const;

export const DISPLAY_ACTIVE_OBJECT_LABELS = {
  text: '\u6587\u672c',
  image: '\u56fe\u7247',
  table: '\u8868\u683c',
  header: '\u9875\u7709',
  footer: '\u9875\u811a',
} as const;

export const DISPLAY_REVISION_LABELS = {
  insert: '\u63d2\u5165\u4fee\u8ba2',
  delete: '\u5220\u9664\u4fee\u8ba2',
} as const;
