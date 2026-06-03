import { describe, expect, it } from 'vitest';
import { parseOutlineText } from '@qiuai/shared';

const SAMPLE_OUTLINE = `人工智能主题标准大纲
一、人工智能概述
（一）人工智能定义
（二）人工智能核心内涵
（三）人工智能发展背景
1. 时代技术背景
2. 产业发展背景
3. 社会需求背景
二、人工智能发展历程
（一）萌芽探索阶段
（二）初步发展阶段
四、人工智能核心技术体系
（一）机器学习技术
1. 传统机器学习
2. 深度学习技术
1.1 卷积神经网络技术
1.2 循环神经网络技术
1.3 Transformer大模型技术
（二）自然语言处理技术
1. 文本理解与生成
2. 机器翻译与对话系统
（四）多模态生成技术
1. 文本、图像、视频跨模态融合
2. AIGC全链路创作技术
（1）AI写作技术
（2）AI论文辅助技术
（3）AI生图技术
（4）AI视频与漫剧生成技术
（5）AI编程辅助技术
九、结语`;

function findByTitle(title: string, nodes: Array<{ title: string; children: any[] }>): any {
  for (const node of nodes) {
    if (node.title === title) {
      return node;
    }
    const found = findByTitle(title, node.children);
    if (found) {
      return found;
    }
  }
  return null;
}

describe('parseOutlineText', () => {
  it('preserves original numbering text and top-level order', () => {
    const result = parseOutlineText(SAMPLE_OUTLINE);

    expect(result[0].title).toBe('人工智能主题标准大纲');
    expect(result[1].title).toBe('一、人工智能概述');
    expect(result[2].title).toBe('二、人工智能发展历程');
    expect(result[result.length - 1].title).toBe('九、结语');
  });

  it('keeps （1） items under the nearest numbered subsection instead of promoting them', () => {
    const result = parseOutlineText(SAMPLE_OUTLINE);
    const aigcChain = findByTitle('2. AIGC全链路创作技术', result);

    expect(aigcChain).not.toBeNull();
    expect(aigcChain.children.map((node: { title: string }) => node.title)).toEqual([
      '（1）AI写作技术',
      '（2）AI论文辅助技术',
      '（3）AI生图技术',
      '（4）AI视频与漫剧生成技术',
      '（5）AI编程辅助技术',
    ]);
  });

  it('keeps 1.1 style headings nested under the preceding 1./2. subsection', () => {
    const result = parseOutlineText(SAMPLE_OUTLINE);
    const deepLearning = findByTitle('2. 深度学习技术', result);

    expect(deepLearning).not.toBeNull();
    expect(deepLearning.children.map((node: { title: string }) => node.title)).toEqual([
      '1.1 卷积神经网络技术',
      '1.2 循环神经网络技术',
      '1.3 Transformer大模型技术',
    ]);
  });
});
