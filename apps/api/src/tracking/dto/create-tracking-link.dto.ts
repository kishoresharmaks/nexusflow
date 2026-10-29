import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateTrackingLinkDto {
  @IsString()
  @IsNotEmpty()
  destinationUrl!: string;

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

  @IsString()
  @IsOptional()
  campaignId?: string | undefined;
}
