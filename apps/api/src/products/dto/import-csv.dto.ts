import { IsString, IsNotEmpty, Length, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportCsvDto {
  @ApiProperty({ example: 'catalog_export_2026.csv', description: 'Original uploaded filename' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  fileName!: string;

  @ApiProperty({
    example: 'sku,title,price\nSKU-1,T-Shirt,19.99',
    description: 'Raw CSV file text content',
  })
  @IsString()
  @IsNotEmpty({ message: 'CSV content cannot be empty.' })
  csvContent!: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD', description: 'Fallback currency' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  defaultCurrency?: string;
}
