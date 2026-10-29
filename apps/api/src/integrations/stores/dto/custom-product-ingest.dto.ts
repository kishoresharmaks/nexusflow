import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomProductItemDto {
  @ApiProperty({ description: 'Unique external identifier for the product in the source system', example: 'SKU-1004' })
  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @ApiProperty({ description: 'Product title / name', example: 'Pro Wireless Studio Headphones' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'Price in cents (e.g. 19999 for $199.99)', example: 19999 })
  @IsNumber()
  @Min(0)
  priceCents!: number;

  @ApiPropertyOptional({ description: '3-letter currency code', example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Stock keeping unit', example: 'WH-1000XM4' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ description: 'Current available stock inventory count', example: 45, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  inventoryCount?: number;

  @ApiPropertyOptional({ description: 'Detailed product marketing description', example: 'Active noise cancellation headphones with 30h battery.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Direct web URL to product page on the custom storefront', example: 'https://store.example.com/headphones' })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ description: 'List of product image URLs', example: ['https://images.example.com/item1.jpg'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ description: 'Product category or search tags', example: ['audio', 'wireless', 'accessories'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Whether the product is currently active for marketing publishing', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CustomProductBatchDto {
  @ApiProperty({
    description: 'Array of products to upsert into the workspace catalog (1 to 500 items per batch)',
    type: [CustomProductItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CustomProductItemDto)
  products!: CustomProductItemDto[];

  @ApiPropertyOptional({
    description: 'Optional custom store or integration label',
    example: 'Headless Medusa Store',
  })
  @IsString()
  @IsOptional()
  storeName?: string;
}

export class ValidateCustomPayloadDto {
  @ApiProperty({
    description: 'Arbitrary raw JSON payload to validate against the custom catalog ingestion schema',
  })
  @IsNotEmpty()
  payload!: unknown;
}
