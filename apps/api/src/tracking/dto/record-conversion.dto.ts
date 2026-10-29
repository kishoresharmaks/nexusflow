import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RecordConversionDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsInt()
  @Min(0)
  orderTotalCents!: number;

  @IsString()
  @IsOptional()
  currency?: string | undefined;

  @IsString()
  @IsOptional()
  attributionSource?: string | undefined;

  @IsString()
  @IsOptional()
  campaignId?: string | undefined;

  @IsString()
  @IsOptional()
  clickId?: string | undefined;
}
