import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsArray,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LinkedInConnectQueryDto {
  @ApiPropertyOptional({
    description: '24-character hex MongoDB ObjectId of the workspace to connect',
  })
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'workspaceId must be a 24-character hex string' })
  workspaceId?: string;

  @ApiPropertyOptional({
    description: 'Session or auth bearer token for direct browser redirects',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description: 'Optional OAuth callback URL override',
  })
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @ApiPropertyOptional({
    description: 'Set to true or 1 to return JSON payload instead of redirecting',
  })
  @IsOptional()
  json?: string;
}

export class LinkedInCallbackQueryDto {
  @ApiPropertyOptional({ description: 'LinkedIn authorization code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Signed OAuth state token' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'OAuth error code from LinkedIn' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ description: 'OAuth error description from LinkedIn' })
  @IsOptional()
  @IsString()
  error_description?: string;
}

export class LinkedInStatusQueryDto {
  @ApiProperty({ description: '24-character hex MongoDB ObjectId of the workspace' })
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'workspaceId must be a 24-character hex string' })
  workspaceId!: string;
}

export class LinkedInDisconnectDto {
  @ApiProperty({ description: '24-character hex MongoDB ObjectId of the workspace' })
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'workspaceId must be a 24-character hex string' })
  workspaceId!: string;

  @ApiPropertyOptional({ description: 'Optional specific account ID to disconnect' })
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'accountId must be a 24-character hex string' })
  accountId?: string;
}

export class LinkedInRefreshDto {
  @ApiProperty({ description: '24-character hex MongoDB ObjectId of the workspace' })
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'workspaceId must be a 24-character hex string' })
  workspaceId!: string;

  @ApiPropertyOptional({ description: 'Optional specific account ID to refresh' })
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'accountId must be a 24-character hex string' })
  accountId?: string;
}

export class LinkedInPostDto {
  @ApiProperty({ description: '24-character hex MongoDB ObjectId of the workspace' })
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'workspaceId must be a 24-character hex string' })
  workspaceId!: string;

  @ApiProperty({ description: 'Post text content (max 3,000 characters)' })
  @IsNotEmpty({ message: 'Post content cannot be empty' })
  @IsString()
  @MaxLength(3000, { message: 'Post content cannot exceed 3,000 characters' })
  content!: string;

  @ApiPropertyOptional({ description: 'List of media asset URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];
}
