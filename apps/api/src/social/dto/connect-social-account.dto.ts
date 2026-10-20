import { IsEnum, IsString, IsNotEmpty, IsOptional, IsArray, IsDateString } from 'class-validator';
import { SocialProvider } from '@commercepilot/database';

export class ConnectSocialAccountDto {
  @IsEnum(SocialProvider, {
    message: `Provider must be one of: ${Object.values(SocialProvider).join(', ')}`,
  })
  provider!: SocialProvider;

  @IsString()
  @IsNotEmpty()
  providerAccountId!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsOptional()
  username?: string | undefined;

  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsString()
  @IsOptional()
  refreshToken?: string | undefined;

  @IsDateString()
  @IsOptional()
  tokenExpiresAt?: string | undefined;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[] | undefined;
}
