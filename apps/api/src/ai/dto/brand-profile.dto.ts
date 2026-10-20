import { IsString, IsNotEmpty, IsOptional, IsArray, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBrandProfileDto {
  @ApiProperty({ example: 'EcoStyle Default Voice' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ example: 'Warm, minimalist, and sustainably conscious.' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  toneOfVoice?: string;

  @ApiPropertyOptional({ example: 'Conscious millennial shoppers and design enthusiasts.' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  targetAudience?: string;

  @ApiPropertyOptional({ example: ['cheap', 'miracle', 'guaranteed'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prohibitedWords?: string[];

  @ApiPropertyOptional({ example: ['#EcoStyle', '#SustainableLiving'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredHashtags?: string[];
}

export class UpdateBrandProfileDto {
  @ApiPropertyOptional({ example: 'EcoStyle Updated Voice' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ example: 'Casual, energetic, and witty.' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  toneOfVoice?: string;

  @ApiPropertyOptional({ example: 'Gen-Z streetwear community.' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  targetAudience?: string;

  @ApiPropertyOptional({ example: ['cheap', 'discount'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prohibitedWords?: string[];

  @ApiPropertyOptional({ example: ['#StreetwearDaily'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredHashtags?: string[];
}
