import { IsNotEmpty, IsOptional, IsString, IsDateString, Matches } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string | undefined;

  @IsDateString()
  @IsOptional()
  startDate?: string | undefined;

  @IsDateString()
  @IsOptional()
  endDate?: string | undefined;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9_-]+$/, {
    message:
      'utmCampaign must contain only lowercase alphanumeric characters, dashes, and underscores.',
  })
  utmCampaign?: string | undefined;
}
