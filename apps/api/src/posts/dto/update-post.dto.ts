import { IsString, IsOptional, IsArray, IsUrl, IsDateString, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  content?: string | undefined;

  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  mediaUrls?: string[] | undefined;

  @IsString()
  @IsOptional()
  productId?: string | undefined;

  @IsString()
  @IsOptional()
  campaignId?: string | undefined;

  @IsString()
  @IsOptional()
  socialAccountId?: string | undefined;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string | undefined;
}
