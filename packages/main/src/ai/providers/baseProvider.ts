import type { AIConfig, TextGenRequest, PolishRequest } from '@qiuai/shared';

export interface TextGenerationProvider {
  name: string;
  generateText(prompt: string, config: AIConfig): AsyncGenerator<string, void, unknown>;
  maxContextTokens: number;
}

export interface ImageGenerationProvider {
  name: string;
  generateImage(prompt: string, options: { style?: string }): Promise<{ url?: string; base64?: string }>;
}

export interface TableProcessingProvider {
  name: string;
  processTable(csvData: string, headers: string[], expectedColumns?: string[]): Promise<{ headers: string[]; rows: string[][] }>;
}
