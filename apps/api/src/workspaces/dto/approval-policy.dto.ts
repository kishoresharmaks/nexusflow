import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { WorkspaceRole } from '@commercepilot/database';

export class UpdateApprovalPolicyDto {
  @ApiPropertyOptional({
    description: 'Whether a post requires explicit approval before it can be scheduled',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresApprovalBeforeSchedule?: boolean;

  @ApiPropertyOptional({
    description: 'Whether a post requires explicit approval before it can be published immediately',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  requiresApprovalBeforePublish?: boolean;

  @ApiPropertyOptional({
    description: 'List of workspace roles eligible to approve posts',
    enum: WorkspaceRole,
    isArray: true,
    example: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(WorkspaceRole, { each: true })
  allowedApproverRoles?: WorkspaceRole[];
}
