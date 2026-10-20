import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Acme Commerce Global', description: 'Updated workspace name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Europe/London', description: 'Updated timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'en-GB', description: 'Updated locale' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'GBP', description: 'Updated currency' })
  @IsOptional()
  @IsString()
  currency?: string;
}
