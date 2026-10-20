import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
