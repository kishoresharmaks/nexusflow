import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { ContentGenerationService } from './content-generation.service';
import { UsageService } from './usage.service';
import { BrandProfilesService } from './brand-profiles.service';
import { ContentTemplatesService } from './content-templates.service';
import { AiProviderFactory } from './ai-provider.factory';
import { MockAiProvider } from './providers/mock-ai-provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [AuditModule, AuthModule, WorkspacesModule],
  controllers: [AiController],
  providers: [
    ContentGenerationService,
    UsageService,
    BrandProfilesService,
    ContentTemplatesService,
    AiProviderFactory,
    MockAiProvider,
  ],
  exports: [
    ContentGenerationService,
    UsageService,
    BrandProfilesService,
    ContentTemplatesService,
    AiProviderFactory,
  ],
})
export class AiModule {}
