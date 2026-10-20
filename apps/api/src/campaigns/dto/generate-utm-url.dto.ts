import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class GenerateUtmUrlDto {
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  baseUrl!: string;

  @IsString()
  @IsNotEmpty()
  utmSource!: string;

  @IsString()
  @IsNotEmpty()
  utmMedium!: string;

  @IsString()
  @IsOptional()
  utmCampaign?: string | undefined;

  @IsString()
  @IsOptional()
  utmContent?: string | undefined;

  @IsString()
  @IsOptional()
  utmTerm?: string | undefined;
}
