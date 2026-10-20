import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Acme Commerce', description: 'Workspace name' })
  @IsString()
  @IsNotEmpty({ message: 'Workspace name is required.' })
  name!: string;

  @ApiPropertyOptional({
    example: 'acme-commerce',
    description: 'URL slug (auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens.',
  })
  @MaxLength(48)
  slug?: string;

  @ApiPropertyOptional({ example: 'America/New_York', description: 'Primary timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Default currency code' })
  @IsOptional()
  @IsString()
  currency?: string;
}
