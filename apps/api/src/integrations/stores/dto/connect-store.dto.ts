import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { StorePlatform } from '@commercepilot/database';

export class ConnectStoreDto {
  @IsEnum(StorePlatform)
  @IsNotEmpty()
  platform!: StorePlatform;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  storeName!: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  storeUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  apiKey!: string;

  @IsString()
  @IsOptional()
  apiSecret?: string | undefined;

  @IsString()
  @IsOptional()
  apiVersion?: string | undefined;
}
