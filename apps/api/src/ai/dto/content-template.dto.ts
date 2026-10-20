import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContentTemplateDto {
  @ApiProperty({ example: 'Product Launch Announcement' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name!: string;

  @ApiProperty({
    example:
      'Write an engaging announcement for {product_title} highlighting {price} and {description}.',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  promptTemplate!: string;

  @ApiPropertyOptional({ example: 'INSTAGRAM' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ example: 'promotional' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateContentTemplateDto {
  @ApiPropertyOptional({ example: 'Updated Launch Template' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({
    example: 'Focus on seasonal lifestyle benefits of {product_title}.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  promptTemplate?: string;

  @ApiPropertyOptional({ example: 'FACEBOOK' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ example: 'seasonal' })
  @IsOptional()
  @IsString()
  category?: string;
}
