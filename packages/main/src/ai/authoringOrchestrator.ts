import type {
  PaperSpineEnhancement,
  PolishRequest,
  TextGenRequest,
  TextGenerationResult,
} from '@qiuai/shared';
import { paperSpineAdapter } from './paperSpineAdapter';
import { polishService } from './polishService';
import { textGenerationService } from './textGenerationService';

class AuthoringOrchestrator {
  private enhanceWithPaperSpine(request: TextGenRequest): PaperSpineEnhancement {
    return paperSpineAdapter.enhance(request);
  }

  private resolvePaperSpineEnhancement(request: TextGenRequest): {
    enhancement: PaperSpineEnhancement;
    source: 'reused' | 'generated';
  } {
    if (request.existingPaperSpineMemory?.enhancement) {
      return {
        enhancement: request.existingPaperSpineMemory.enhancement,
        source: 'reused',
      };
    }

    return {
      enhancement: this.enhanceWithPaperSpine(request),
      source: 'generated',
    };
  }

  async generateSection(
    request: TextGenRequest,
    onChunk?: (chunk: string) => void
  ): Promise<TextGenerationResult> {
    let content = '';
    let provider = 'unknown';
    let model = request.aiConfig.model;
    const { enhancement, source } = this.resolvePaperSpineEnhancement(request);

    const generator = textGenerationService.generateSection(
      request,
      enhancement.enhancedPromptAddendum
    );

    while (true) {
      const next = await generator.next();
      if (next.done) {
        provider = next.value?.provider || provider;
        model = next.value?.model || model;
        break;
      }
      content += next.value;
      onChunk?.(next.value);
    }

    return {
      content,
      provider,
      model,
      paperSpineEnhancement: enhancement,
      paperSpineSource: source,
    };
  }

  async polishText(request: PolishRequest): Promise<string> {
    return polishService.polish(request);
  }
}

export const authoringOrchestrator = new AuthoringOrchestrator();
