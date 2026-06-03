import { generateId, type FrameworkNode } from './index';

type DisplayLevel = 1 | 2 | 3;

interface ParsedOutlineLine {
  displayLevel: DisplayLevel;
  hierarchyDepth: number;
  title: string;
  order: number;
}

const CHINESE_DIGITS: Record<string, number> = {
  '\u96f6': 0,
  '\u4e00': 1,
  '\u4e8c': 2,
  '\u4e09': 3,
  '\u56db': 4,
  '\u4e94': 5,
  '\u516d': 6,
  '\u4e03': 7,
  '\u516b': 8,
  '\u4e5d': 9,
};

const CHINESE_UNITS: Record<string, number> = {
  '\u5341': 10,
  '\u767e': 100,
  '\u5343': 1000,
};

function normalizeLine(line: string): string {
  return line
    .replace(/\u3000/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseChineseNumeral(raw: string): number {
  const value = raw.trim();
  if (!value) {
    return 0;
  }

  if (value === '\u5341') {
    return 10;
  }

  let total = 0;
  let current = 0;

  for (const char of value) {
    if (char in CHINESE_DIGITS) {
      current = CHINESE_DIGITS[char];
      continue;
    }

    if (char in CHINESE_UNITS) {
      total += (current || 1) * CHINESE_UNITS[char];
      current = 0;
    }
  }

  return total + current;
}

function mapDepthToDisplayLevel(depth: number): DisplayLevel {
  if (depth <= 1) {
    return 1;
  }
  if (depth === 2) {
    return 2;
  }
  return 3;
}

function detectLevel(line: string): ParsedOutlineLine | null {
  const normalized = normalizeLine(line);
  if (!normalized) {
    return null;
  }

  const chineseTopLevel = /^([\u4e00-\u9fff]+)[\u3001]\s*(.+)$/u.exec(normalized);
  if (chineseTopLevel) {
    return {
      displayLevel: 1,
      hierarchyDepth: 1,
      title: normalized,
      order: parseChineseNumeral(chineseTopLevel[1]) || 1,
    };
  }

  const chineseParenLevel = /^[\uff08(]([\u4e00-\u9fff]+)[\uff09)]\s*(.+)$/u.exec(normalized);
  if (chineseParenLevel) {
    return {
      displayLevel: 2,
      hierarchyDepth: 2,
      title: normalized,
      order: parseChineseNumeral(chineseParenLevel[1]) || 1,
    };
  }

  const dottedMultiLevel = /^(\d+(?:\.\d+)+)\s*(.+)$/u.exec(normalized);
  if (dottedMultiLevel) {
    const segments = dottedMultiLevel[1].split('.');
    return {
      displayLevel: mapDepthToDisplayLevel(2 + segments.length),
      hierarchyDepth: 2 + segments.length,
      title: normalized,
      order: Number(segments[segments.length - 1]) || 1,
    };
  }

  const singleDigitLevel = /^(\d+)\.\s*(.+)$/u.exec(normalized);
  if (singleDigitLevel) {
    return {
      displayLevel: 3,
      hierarchyDepth: 3,
      title: normalized,
      order: Number(singleDigitLevel[1]) || 1,
    };
  }

  const parenDigitLevel = /^[\uff08(](\d+)[\uff09)]\s*(.+)$/u.exec(normalized);
  if (parenDigitLevel) {
    return {
      displayLevel: 3,
      hierarchyDepth: 4,
      title: normalized,
      order: Number(parenDigitLevel[1]) || 1,
    };
  }

  const firstCode = normalized.codePointAt(0) ?? 0;
  if (firstCode >= 0x2460 && firstCode <= 0x2473) {
    return {
      displayLevel: 3,
      hierarchyDepth: 4,
      title: normalized,
      order: firstCode - 0x2460 + 1,
    };
  }

  const alphaLevel = /^([a-zA-Z])\.\s*(.+)$/u.exec(normalized);
  if (alphaLevel) {
    return {
      displayLevel: 3,
      hierarchyDepth: 5,
      title: normalized,
      order: alphaLevel[1].toLowerCase().charCodeAt(0) - 96,
    };
  }

  return {
    displayLevel: 1,
    hierarchyDepth: 1,
    title: normalized,
    order: 99,
  };
}

export function parseOutlineText(text: string): FrameworkNode[] {
  const lines = text.split(/[\r\n]+/).map(normalizeLine).filter(Boolean);
  const root: FrameworkNode[] = [];
  const stack: Array<{ depth: number; node: FrameworkNode }> = [];

  for (const line of lines) {
    const parsed = detectLevel(line);
    if (!parsed) {
      continue;
    }

    const nextNode: FrameworkNode = {
      id: generateId(),
      title: parsed.title,
      level: parsed.displayLevel,
      order: parsed.order,
      children: [],
      needsImage: false,
      needsTable: false,
      dataKeywords: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].depth >= parsed.hierarchyDepth) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(nextNode);
    } else {
      stack[stack.length - 1].node.children.push(nextNode);
    }

    stack.push({ depth: parsed.hierarchyDepth, node: nextNode });
  }

  return root;
}

export function frameworkTreeEquals(left: FrameworkNode[], right: FrameworkNode[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
