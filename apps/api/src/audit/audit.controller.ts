import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService, PaginatedAuditLogs } from './audit.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../workspaces/guards/roles.guard';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { WorkspaceRole } from '@commercepilot/database';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
@Controller('workspaces/:workspaceId/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'View workspace audit logs (Restricted to OWNER and ADMIN roles)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ObjectId' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'resourceType', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of immutable workspace audit events' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient role permissions' })
  async getAuditLogs(
    @Param('workspaceId') workspaceId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
  ): Promise<PaginatedAuditLogs> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const filters: { action?: string; resourceType?: string } = {};
    if (action) filters.action = action;
    if (resourceType) filters.resourceType = resourceType;
    return this.auditService.getWorkspaceAuditLogs(
      workspaceId,
      safePage,
      safeLimit,
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }
}
