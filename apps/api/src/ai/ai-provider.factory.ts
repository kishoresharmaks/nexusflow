import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiTextProvider } from './interfaces/ai-text-provider.interface';
import { MockAiProvider } from './providers/mock-ai-provider';
import { GeminiAiProvider } from './providers/gemini-ai-provider';

@Injectable()
export class AiProviderFactory {
  private readonly logger = new Logger(AiProviderFactory.name);
  private textProvider: AiTextProvider;

  constructor(private readonly configService: ConfigService) {
    const providerName = (
      this.configService.get<string>('AI_TEXT_PROVIDER') ||
      process.env['AI_TEXT_PROVIDER'] ||
      'mock'
    ).toLowerCase();

    const apiKey =
      this.configService.get<string>('AI_TEXT_API_KEY') || process.env['AI_TEXT_API_KEY'] || '';

    const nodeEnv = (
      this.configService.get<string>('NODE_ENV') ||
      process.env['NODE_ENV'] ||
      'development'
    ).toLowerCase();

    const isProduction = nodeEnv === 'production' || nodeEnv === 'staging';

    if (isProduction) {
      if (providerName !== 'gemini' || !apiKey || apiKey === 'replace-me') {
        throw new Error(
          `Production / Staging startup failed: A live verified AI provider (e.g. Gemini with valid AI_TEXT_API_KEY) must be configured. Mock AI is strictly prohibited in production and staging environments.`,
        );
      }
    }

    if (providerName === 'gemini' && apiKey && apiKey !== 'replace-me') {
      this.logger.log('Initializing live Gemini AI Provider');
      this.textProvider = new GeminiAiProvider(apiKey);
    } else {
      this.logger.warn('Initializing Mock AI Provider (development / test draft mode only)');
      this.textProvider = new MockAiProvider();
    }
  }

  getTextProvider(): AiTextProvider {
    return this.textProvider;
  }
}
