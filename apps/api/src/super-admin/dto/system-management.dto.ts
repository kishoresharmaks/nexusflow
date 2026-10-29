import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

export class UpdatePlatformSettingDto {
  @IsNotEmpty()
  value: any;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  audience?: string = 'ALL';

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean = true;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class VerifyEmailConnectionDto {
  @IsOptional()
  @IsString()
  provider?: string;
}

export class SendTestEmailDto {
  @IsString()
  @IsNotEmpty()
  to!: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
