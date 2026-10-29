import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class ShopifyAuthorizeDto {
  @IsString()
  @IsNotEmpty()
  shop!: string;
}

export class ShopifyCallbackQueryDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  hmac!: string;

  @IsString()
  @IsNotEmpty()
  shop!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  timestamp!: string;
}
