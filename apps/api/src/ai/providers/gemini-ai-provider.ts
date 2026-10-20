import { Injectable, Logger } from '@nestjs/common';
import {
  AiTextProvider,
  GenerateTextOptions,
  GenerateTextResult,
} from '../interfaces/ai-text-provider.interface';

@Injectable()
export class GeminiAiProvider implements AiTextProvider {
  readonly providerName = 'gemini';
  private readonly logger = new Logger(GeminiAiProvider.name);

  constructor(private readonly apiKey: string) {}

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const model = options.model || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const promptTokensEst = Math.ceil(
      (options.prompt.length + (options.systemPrompt?.length || 0)) / 4,
    );

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: options.systemPrompt
            ? { parts: [{ text: options.systemPrompt }] }
            : undefined,
          contents: [
            {
              role: 'user',
              parts: [{ text: options.prompt }],
            },
          ],
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 800,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (HTTP ${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };

      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const promptTokens = data.usageMetadata?.promptTokenCount || promptTokensEst;
      const completionTokens =
        data.usageMetadata?.candidatesTokenCount || Math.ceil(candidateText.length / 4);
      const costEstimateMicrocents = Math.round(promptTokens * 0.05 + completionTokens * 0.15);

      return {
        text: candidateText,
        promptTokens,
        completionTokens,
        model,
        provider: this.providerName,
        costEstimateMicrocents,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Gemini error';
      this.logger.error(`Gemini request failed: ${message}`);
      throw err;
    }
  }
}
