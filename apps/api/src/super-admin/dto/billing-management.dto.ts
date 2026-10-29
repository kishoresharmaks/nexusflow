import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus } from '@commercepilot/database';

export class ListSubscriptionsQueryDto {
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
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class SuperAdminCancelSubscriptionDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsBoolean()
  immediate?: boolean = false;
}

export class CreatePlanDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsOptional()
  @IsString()
  billingInterval?: 'month' | 'year' = 'month';

  @IsInt()
  @Min(0)
  maxMonthlyPosts!: number;

  @IsInt()
  @Min(0)
  maxMonthlyAiWords!: number;

  @IsInt()
  @Min(0)
  maxSocialAccounts!: number;

  @IsInt()
  @Min(1)
  maxTeamMembers!: number;

  @IsArray()
  @IsString({ each: true })
  features!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  billingInterval?: 'month' | 'year';

  @IsOptional()
  @IsInt()
  @Min(0)
  maxMonthlyPosts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxMonthlyAiWords?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSocialAccounts?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTeamMembers?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

