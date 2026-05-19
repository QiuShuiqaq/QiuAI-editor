import type { ImageGenRequest } from '@qiuai/shared';

class ImageGenService {
  async generate(request: ImageGenRequest): Promise<{ base64: string }> {
    const { prompt, style } = request;

    // Placeholder: Will call DALL-E / Stable Diffusion API
    // Returns a placeholder 1x1 pixel PNG as base64
    const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    console.log(`[ImageGen] Prompt: ${prompt}, Style: ${style}`);

    return { base64: placeholderBase64 };
  }
}

export const imageGenService = new ImageGenService();
