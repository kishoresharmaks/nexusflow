import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUrl,
  IsArray,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiPropertyOptional({ example: 'SKU-SHIRT-001', description: 'Stock keeping unit identifier' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @ApiProperty({ example: 'Classic Cotton Crewneck T-Shirt', description: 'Product title' })
  @IsString()
  @IsNotEmpty({ message: 'Product title cannot be empty.' })
  @Length(1, 250)
  title!: string;

  @ApiPropertyOptional({
    example: 'Breathable 100% organic cotton everyday tee with tailored fit.',
    description: 'Detailed product description',
  })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiProperty({
    example: 2999,
    description: 'Price in smallest currency unit (e.g. 2999 = $29.99)',
  })
  @Type(() => Number)
  @IsInt({ message: 'Price in cents must be an integer.' })
  @Min(0, { message: 'Price cannot be negative.' })
  @Max(100_000_000, { message: 'Price exceeds maximum supported threshold.' })
  priceCents!: number;

  @ApiPropertyOptional({
    example: 'USD',
    default: 'USD',
    description: '3-letter ISO 4217 currency code',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    example: 45,
    default: 0,
    description: 'Current available inventory units',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Inventory count must be an integer.' })
  @Min(0, { message: 'Inventory count cannot be negative.' })
  inventoryCount?: number;

  @ApiPropertyOptional({
    example: 'https://example.com/products/crewneck',
    description: 'Canonical storefront URL',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Product URL must be a valid HTTP or HTTPS URL.' })
  url?: string;

  @ApiPropertyOptional({
    example: ['https://example.com/images/crewneck-front.jpg'],
    type: [String],
    description: 'List of product image URLs',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    example: ['apparel', 'tops', 'summer-collection'],
    type: [String],
    description: 'Classification tags or categories',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: 'MANUAL',
    default: 'MANUAL',
    description: 'Catalog origin source',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'shopify_prod_123', description: 'External platform record ID' })
  @IsOptional()
  @IsString()
  sourceId?: string;
}
