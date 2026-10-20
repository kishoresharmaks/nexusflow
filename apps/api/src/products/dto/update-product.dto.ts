import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUrl,
  IsArray,
  IsBoolean,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'SKU-SHIRT-001' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @ApiPropertyOptional({ example: 'Updated Classic Cotton Crewneck' })
  @IsOptional()
  @IsString()
  @Length(1, 250)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiPropertyOptional({ example: 3499 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceCents?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  inventoryCount?: number;

  @ApiPropertyOptional({ example: 'https://example.com/products/crewneck' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({
    example: ['https://example.com/images/crewneck-front.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ example: ['apparel', 'tops'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: true, description: 'Active status in catalog' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
