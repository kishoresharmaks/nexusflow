import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsArray,
  Matches,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InstagramConnectQueryDto {
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

export class InstagramCallbackQueryDto {
  @ApiPropertyOptional({ description: 'Meta / Instagram authorization code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Signed OAuth state token' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'OAuth error code from Meta' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ description: 'OAuth error reason from Meta' })
  @IsOptional()
  @IsString()
  error_reason?: string;

  @ApiPropertyOptional({ description: 'OAuth error description from Meta' })
  @IsOptional()
  @IsString()
  error_description?: string;
}

export class InstagramStatusQueryDto {
  @ApiProperty({ description: '24-character hex MongoDB ObjectId of the workspace' })
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'workspaceId must be a 24-character hex string' })
  workspaceId!: string;
}

export class InstagramDisconnectDto {
  @ApiProperty({ description: '24-character hex MongoDB ObjectId of the workspace' })
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'workspaceId must be a 24-character hex string' })
  workspaceId!: string;

  @ApiPropertyOptional({ description: 'Optional specific account ID to disconnect' })
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'accountId must be a 24-character hex string' })
  accountId?: string;
}

export class InstagramRefreshDto {
  @ApiProperty({ description: '24-character hex MongoDB ObjectId of the workspace' })
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'workspaceId must be a 24-character hex string' })
  workspaceId!: string;

  @ApiPropertyOptional({ description: 'Optional specific account ID to refresh' })
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'accountId must be a 24-character hex string' })
  accountId?: string;
}

export class InstagramPostDto {
  @ApiProperty({ description: '24-character hex MongoDB ObjectId of the workspace' })
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'workspaceId must be a 24-character hex string' })
  workspaceId!: string;

  @ApiProperty({ description: 'Post caption content (max 2,200 characters)' })
  @IsNotEmpty({ message: 'Post caption cannot be empty' })
  @IsString()
  @MaxLength(2200, { message: 'Post caption exceeds Instagram limit of 2,200 characters' })
  content!: string;

  @ApiProperty({
    description: 'List of media asset URLs (Instagram feed requires at least 1 image or video)',
    type: [String],
  })
  @IsArray({ message: 'mediaUrls must be an array' })
  @ArrayMinSize(1, { message: 'Instagram requires at least one image or video media URL to publish' })
  @IsString({ each: true, message: 'Each media URL must be a valid string' })
  mediaUrls!: string[];
}
