import { IsOptional, IsString, IsInt, Min, Max, IsBoolean, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryProductsDto {
  @ApiPropertyOptional({ description: 'Text search matching SKU, title, or tags' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter active or archived products' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by source (e.g. MANUAL, CSV, SHOPIFY)' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: ['createdAt', 'updatedAt', 'title', 'priceCents', 'inventoryCount'],
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'title', 'priceCents', 'inventoryCount'])
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'], description: 'Sort direction' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
