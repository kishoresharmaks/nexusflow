import { IsOptional, IsString, IsInt, Min, Max, IsEnum, Length } from 'class-validator';
import { Type } from 'class-transformer';

export enum UserStatusFilter {
  ALL = 'all',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export class ListUsersQueryDto {
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
  @IsEnum(UserStatusFilter)
  status?: UserStatusFilter = UserStatusFilter.ALL;
}

export class SuspendUserDto {
  @IsString()
  @Length(3, 500, { message: 'Suspension reason must be between 3 and 500 characters.' })
  reason!: string;
}
