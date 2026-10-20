import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaFileController } from './media-file.controller';
import { MediaService } from './media.service';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [AuditModule, AuthModule, WorkspacesModule],
  controllers: [MediaController, MediaFileController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
