import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { PublicTrackingController } from './public-tracking.controller';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule],
  controllers: [TrackingController, PublicTrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
