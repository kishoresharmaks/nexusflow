import { IsOptional, IsString, IsInt, Min, Max, IsEnum, Length, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkspaceStatus } from '@commercepilot/database';

export class ListWorkspacesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  planTier?: string;
}

export class SuspendWorkspaceDto {
  @IsString()
  @Length(3, 500, { message: 'Suspension reason must be between 3 and 500 characters.' })
  reason!: string;
}

export class UpdateWorkspaceLimitsDto {
  @IsOptional()
  @IsString()
  planTier?: string;

  @IsOptional()
  @IsObject()
  customQuotas?: Record<string, any>;
}
