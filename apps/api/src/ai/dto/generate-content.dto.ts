import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateContentDto {
  @ApiProperty({
    example: '60b8d29f1c9d440000a11111',
    description: 'Product ID in workspace to ground generation upon',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({
    example: 'INSTAGRAM',
    enum: ['INSTAGRAM', 'FACEBOOK', 'TWITTER', 'PINTEREST', 'LINKEDIN'],
    default: 'INSTAGRAM',
  })
  @IsOptional()
  @IsString()
  @IsIn(['INSTAGRAM', 'FACEBOOK', 'TWITTER', 'PINTEREST', 'LINKEDIN'])
  channel?: string;

  @ApiPropertyOptional({
    example: '60b8d29f1c9d440000a22222',
    description: 'Optional brand profile for tone & prohibited words',
  })
  @IsOptional()
  @IsString()
  brandProfileId?: string;

  @ApiPropertyOptional({
    example: '60b8d29f1c9d440000a33333',
    description: 'Optional content template ID',
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    example: 'Emphasize summer holiday style and limited pre-season batch.',
    description: 'Custom creative guidance',
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  customInstructions?: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Persist output as an editable draft Post',
  })
  @IsOptional()
  @IsBoolean()
  createDraftPost?: boolean;
}
