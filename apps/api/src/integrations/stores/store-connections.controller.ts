import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { RolesGuard } from '../../workspaces/guards/roles.guard';
import { Roles } from '../../workspaces/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { StoreConnectionsService } from './store-connections.service';
import { ConnectStoreDto } from './dto/connect-store.dto';
import type { User } from '@commercepilot/database';

@Controller('workspaces/:workspaceId/integrations/stores')
@UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
export class StoreConnectionsController {
  constructor(private readonly storeService: StoreConnectionsService) {}

  @Post()
  @Roles('OWNER', 'ADMIN')
  async connectStore(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ConnectStoreDto,
    @CurrentUser() user: User,
  ) {
    return this.storeService.connectStore(workspaceId, dto, user.id);
  }

  @Get()
  async listStores(@Param('workspaceId') workspaceId: string) {
    return this.storeService.listStores(workspaceId);
  }

  @Get(':id')
  async getStore(@Param('workspaceId') workspaceId: string, @Param('id') connectionId: string) {
    return this.storeService.getStore(workspaceId, connectionId);
  }

  @Post(':id/sync')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async syncStore(
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectionId: string,
    @CurrentUser() user: User,
  ) {
    return this.storeService.syncStore(workspaceId, connectionId, user.id);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  async disconnectStore(
    @Param('workspaceId') workspaceId: string,
    @Param('id') connectionId: string,
    @CurrentUser() user: User,
  ) {
    return this.storeService.disconnectStore(workspaceId, connectionId, user.id);
  }
}
