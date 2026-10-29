import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AiProviderFactory } from './ai-provider.factory';
import { UsageService } from './usage.service';
import { GenerateContentDto } from './dto/generate-content.dto';
import { PostStatus, Product, Post } from '@commercepilot/database';

export interface GroundedMarketingDraft {
  caption: string;
  hashtags: string[];
  callToAction: string;
  characterCount: number;
  groundedFacts: {
    productId: string;
    title: string;
    priceFormatted: string;
    stockStatus: string;
    url?: string | null | undefined;
  };
  staleWarning?: string | undefined;
  draftPost?: Post | undefined;
  usage: {
    promptTokens: number;
    completionTokens: number;
    costEstimateMicrocents: number;
    model: string;
    provider: string;
  };
}

@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly usageService: UsageService,
  ) {}

  private validateObjectId(id: string, label = 'ID'): void {
    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw new BadRequestException(`Invalid ${label} format.`);
    }
  }

  private isProductStale(product: Pick<Product, 'freshnessCheckedAt' | 'updatedAt'>): boolean {
    const timestamp = product.freshnessCheckedAt ?? product.updatedAt;
    if (!timestamp) return true;
    const ageMs = Date.now() - new Date(timestamp).getTime();
    return ageMs > 48 * 60 * 60 * 1000; // 48 hours
  }

  private cleanseProhibitedWords(
    text: string,
    prohibitedWords: string[],
  ): { text: string; violationsFound: string[] } {
    let cleaned = text;
    const violationsFound: string[] = [];

    for (const word of prohibitedWords) {
      if (!word.trim()) continue;
      const regex = new RegExp(`\\b${word.trim()}\\b`, 'gi');
      if (regex.test(cleaned)) {
        violationsFound.push(word);
        cleaned = cleaned.replace(regex, '[redacted]');
      }
    }

    return { text: cleaned, violationsFound };
  }

  async generate(
    workspaceId: string,
    dto: GenerateContentDto,
    userId: string,
    clientIp?: string,
  ): Promise<GroundedMarketingDraft> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(dto.productId, 'product ID');

    // 1. Fetch grounded product facts from catalog
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, workspaceId },
    });

    if (!product) {
      throw new NotFoundException('Product not found in this workspace.');
    }

    // 2. Check product freshness
    const isStale = this.isProductStale(product);
    const staleWarning = isStale
      ? 'Product data was last verified >48 hours ago. Price, inventory, or product claims may be outdated. Review before publishing.'
      : undefined;

    // 3. Format product facts
    const formattedPrice = `$${(product.priceCents / 100).toFixed(2)} ${product.currency}`;
    const stockStatus =
      product.inventoryCount > 0 ? `${product.inventoryCount} units available` : 'Out of stock';

    // 4. Retrieve brand voice & content template if specified
    let brandVoiceInstructions = '';
    let prohibitedWords: string[] = [];
    let preferredHashtags: string[] = [];

    if (dto.brandProfileId) {
      this.validateObjectId(dto.brandProfileId, 'brand profile ID');
      const brand = await this.prisma.brandProfile.findFirst({
        where: { id: dto.brandProfileId, workspaceId },
      });
      if (brand) {
        if (brand.toneOfVoice) brandVoiceInstructions += `\nTone of Voice: ${brand.toneOfVoice}`;
        if (brand.targetAudience)
          brandVoiceInstructions += `\nTarget Audience: ${brand.targetAudience}`;
        prohibitedWords = brand.prohibitedWords || [];
        preferredHashtags = brand.preferredHashtags || [];
      }
    }

    let templatePrompt = '';
    if (dto.templateId) {
      this.validateObjectId(dto.templateId, 'template ID');
      const tmpl = await this.prisma.contentTemplate.findFirst({
        where: { id: dto.templateId, workspaceId },
      });
      if (tmpl) {
        templatePrompt = `\nTemplate Structure:\n${tmpl.promptTemplate}`;
      }
    }

    // 5. Construct Grounding Prompt
    const channel = (dto.channel || 'INSTAGRAM').toUpperCase();
    const systemPrompt =
      `You are an expert commerce marketing copywriter for NexusFlow.\n` +
      `Your task is to write engaging, high-converting social media marketing copy strictly grounded in verified product facts.\n` +
      `CRITICAL INTEGRITY RULES:\n` +
      `1. Rely ONLY on the product title, price, description, and stock status provided.\n` +
      `2. NEVER invent discounts, coupons, false certifications, or fabricated customer reviews.\n` +
      `3. Return valid JSON only with this structure: { "caption": string, "hashtags": string[], "callToAction": string }.\n` +
      `4. Do not include markdown code block ticks (\`\`\`json) outside the JSON.`;

    const userPrompt =
      `Generate marketing post for channel: ${channel}\n` +
      `Product Facts:\n` +
      `- Title: ${product.title}\n` +
      `- Price: ${formattedPrice}\n` +
      `- Stock Status: ${stockStatus}\n` +
      `- Description: ${product.description || 'Quality product'}\n` +
      `- Store URL: ${product.url || 'Link in bio'}\n` +
      `${brandVoiceInstructions}\n` +
      `${templatePrompt}\n` +
      (dto.customInstructions ? `Special Instructions: ${dto.customInstructions}\n` : '') +
      `Generate the response as JSON.`;

    // 6. Check Token Quota Availability
    await this.usageService.assertQuotaAvailable(workspaceId, 500);

    // 7. Invoke Provider-Agnostic AI Adapter
    const provider = this.aiProviderFactory.getTextProvider();
    const aiResult = await provider.generateText({
      prompt: userPrompt,
      systemPrompt,
      temperature: 0.7,
      maxTokens: 600,
    });

    // 8. Parse JSON response
    let parsed: { caption?: string; hashtags?: string[]; callToAction?: string };
    try {
      const cleanJson = aiResult.text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      // Fallback if model returned plain string
      parsed = {
        caption: aiResult.text,
        hashtags: ['#ShopNow', '#Trending'],
        callToAction: 'Check the link in bio to shop!',
      };
    }

    let caption =
      parsed.caption || `Discover the ${product.title}. Available now for ${formattedPrice}.`;
    let callToAction = parsed.callToAction || 'Shop now through the link in our bio!';
    const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];

    // Append preferred brand hashtags if not already present
    if (preferredHashtags.length > 0) {
      for (const tag of preferredHashtags) {
        const formattedTag = tag.startsWith('#') ? tag : `#${tag}`;
        if (!hashtags.includes(formattedTag)) {
          hashtags.push(formattedTag);
        }
      }
    }

    // Cleanse prohibited words if specified
    if (prohibitedWords.length > 0) {
      caption = this.cleanseProhibitedWords(caption, prohibitedWords).text;
      callToAction = this.cleanseProhibitedWords(callToAction, prohibitedWords).text;
    }

    // 9. Meter AI Usage in Ledger
    await this.usageService.recordUsage(workspaceId, {
      provider: aiResult.provider,
      model: aiResult.model,
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      costEstimateMicrocents: aiResult.costEstimateMicrocents,
      feature: 'CONTENT_GENERATION',
    });

    // 10. Persist as an editable draft Post (Strictly PostStatus.DRAFT, never auto-published)
    let draftPost: Post | undefined = undefined;
    const shouldCreateDraft = dto.createDraftPost ?? true;

    if (shouldCreateDraft) {
      const fullPostContent = `${caption}\n\n${callToAction}\n\n${hashtags.join(' ')}`.trim();
      draftPost = await this.prisma.post.create({
        data: {
          workspaceId,
          productId: product.id,
          content: fullPostContent,
          mediaUrls: product.images,
          status: PostStatus.DRAFT, // Strictly editable draft
        },
      });
    }

    // 11. Record Audit Event
    await this.auditService.record({
      workspaceId,
      userId,
      action: 'AI_CONTENT_GENERATED',
      resourceType: 'Product',
      resourceId: product.id,
      metadata: {
        channel,
        provider: aiResult.provider,
        model: aiResult.model,
        tokensUsed: aiResult.promptTokens + aiResult.completionTokens,
        draftPostId: draftPost?.id,
        isStale,
      },
      ipAddress: clientIp,
    });

    const characterCount = caption.length + callToAction.length + hashtags.join(' ').length;

    return {
      caption,
      hashtags,
      callToAction,
      characterCount,
      groundedFacts: {
        productId: product.id,
        title: product.title,
        priceFormatted: formattedPrice,
        stockStatus,
        url: product.url,
      },
      staleWarning,
      draftPost,
      usage: {
        promptTokens: aiResult.promptTokens,
        completionTokens: aiResult.completionTokens,
        costEstimateMicrocents: aiResult.costEstimateMicrocents,
        model: aiResult.model,
        provider: aiResult.provider,
      },
    };
  }
}
