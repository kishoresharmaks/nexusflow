import { IsEmail, IsEnum, IsOptional, IsArray, IsString, IsNotEmpty } from 'class-validator';
import { PlatformRole, PlatformAdminStatus } from '@commercepilot/database';

export class GrantAdminDto {
  @IsEmail()
  email!: string;

  @IsEnum(PlatformRole)
  role!: PlatformRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateAdminDto {
  @IsOptional()
  @IsEnum(PlatformRole)
  role?: PlatformRole;

  @IsOptional()
  @IsEnum(PlatformAdminStatus)
  status?: PlatformAdminStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  suspensionReason?: string;
}

export class ListQueryDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
