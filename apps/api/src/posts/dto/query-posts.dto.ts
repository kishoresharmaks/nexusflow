import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PostStatus } from '@commercepilot/database';

export class QueryPostsDto {
  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus | undefined;

  @IsString()
  @IsOptional()
  productId?: string | undefined;

  @IsString()
  @IsOptional()
  campaignId?: string | undefined;

  @IsString()
  @IsOptional()
  socialAccountId?: string | undefined;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number | undefined;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number | undefined;
}
