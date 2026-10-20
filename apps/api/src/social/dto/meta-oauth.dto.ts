import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialProvider } from '@commercepilot/database';

export class MetaOAuthStartDto {
  @ApiPropertyOptional({
    example: 'https://app.commercepilot.com/settings/social/callback',
    description: 'OAuth redirect URI registered in Meta Developer App',
  })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}

export class MetaOAuthCallbackDto {
  @ApiProperty({
    example: 'AQBz...code...',
    description: 'Authorization code returned from Meta OAuth dialog',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    example: 'ey...signedState...',
    description: 'Signed state token originally provided to Meta OAuth dialog',
  })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiPropertyOptional({
    example: 'https://app.commercepilot.com/settings/social/callback',
    description: 'Matching OAuth redirect URI used in initial authorization',
  })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}

export class DiscoveredMetaAccountDto {
  @ApiProperty({ enum: SocialProvider })
  @IsEnum(SocialProvider)
  provider!: SocialProvider;

  @ApiProperty({ example: '1092837465' })
  @IsString()
  @IsNotEmpty()
  providerAccountId!: string;

  @ApiProperty({ example: 'My Brand Official' })
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @ApiPropertyOptional({ example: 'mybrand_official' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'EAAB...' })
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @ApiPropertyOptional({ example: ['pages_show_list', 'instagram_basic'] })
  @IsOptional()
  @IsArray()
  scopes?: string[];

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsString()
  tokenExpiresAt?: string;
}
