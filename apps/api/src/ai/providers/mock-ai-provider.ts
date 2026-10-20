import { Injectable, Logger } from '@nestjs/common';
import {
  AiTextProvider,
  GenerateTextOptions,
  GenerateTextResult,
} from '../interfaces/ai-text-provider.interface';

@Injectable()
export class MockAiProvider implements AiTextProvider {
  readonly providerName = 'mock';
  private readonly logger = new Logger(MockAiProvider.name);

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    this.logger.debug(
      `MockAiProvider generating copy for prompt of length ${options.prompt.length}`,
    );

    // Extract product facts if present in the prompt to ensure grounded output
    const titleMatch = options.prompt.match(/Title:\s*(.+?)(?:\n|$)/i);
    const priceMatch = options.prompt.match(/Price:\s*(.+?)(?:\n|$)/i);
    const stockMatch = options.prompt.match(/Stock Status:\s*(.+?)(?:\n|$)/i);
    const channelMatch = options.prompt.match(/Channel:\s*(.+?)(?:\n|$)/i);

    const title = titleMatch ? titleMatch[1]?.trim() : 'Featured Product';
    const price = priceMatch ? priceMatch[1]?.trim() : 'Available now';
    const channel = channelMatch ? channelMatch[1]?.trim().toUpperCase() : 'INSTAGRAM';
    const isOutOfStock = stockMatch && /out of stock/i.test(stockMatch[1] || '');

    let caption: string;
    let hashtags: string[];
    let cta: string;

    if (isOutOfStock) {
      caption = `✨ Coming back soon! Our popular ${title} is currently restocked for pre-orders. Reserve yours today at ${price}.`;
      cta = 'Tap the link in bio to join the waitlist!';
      hashtags = ['#BackInStockSoon', '#PreOrder', '#ComingSoon', '#StyleEssentials'];
    } else {
      switch (channel) {
        case 'TWITTER':
          caption = `Upgrade your collection with the ${title}. Starting at ${price}. Crafted for everyday excellence.`;
          cta = 'Shop now via link below 👇';
          hashtags = ['#StyleUpdate', '#MustHave'];
          break;
        case 'LINKEDIN':
          caption = `Delivering quality craftsmanship and everyday utility: introducing the ${title}. Now available in our catalog at ${price}.`;
          cta = 'Explore the full collection at the link in comments.';
          hashtags = ['#Ecommerce', '#ProductSpotlight', '#Retail'];
          break;
        default: // Instagram & Facebook
          caption = `✨ Meet your new everyday essential: the ${title}.\n\nDesigned with premium attention to detail and everyday comfort. Get yours now for ${price}.`;
          cta = 'Tap the link in our bio to shop the drop!';
          hashtags = ['#StyleEssentials', '#DailyDrop', '#MustHave', '#ShopNow'];
          break;
      }
    }

    const fullResponse = JSON.stringify({
      caption,
      hashtags,
      callToAction: cta,
    });

    const promptTokens = Math.ceil(options.prompt.length / 4);
    const completionTokens = Math.ceil(fullResponse.length / 4);
    // Cost estimate: ~0.15 microcents per token
    const costEstimateMicrocents = Math.round((promptTokens + completionTokens) * 0.15);

    return {
      text: fullResponse,
      promptTokens,
      completionTokens,
      model: options.model || 'mock-gpt-4o-mini',
      provider: this.providerName,
      costEstimateMicrocents,
      isSimulated: true,
    };
  }
}
