import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class RecordClickDto {
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  targetUrl!: string;

  @IsString()
  @IsOptional()
  campaignId?: string | undefined;

  @IsString()
  @IsOptional()
  referrer?: string | undefined;

  @IsString()
  @IsOptional()
  country?: string | undefined;
}
