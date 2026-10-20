import { IsString, IsNotEmpty, IsInt, Min, Max, IsIn, Length, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestUploadUrlDto {
  @ApiProperty({ example: 'product_photo.jpg' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  filename!: string;

  @ApiProperty({
    example: 'image/jpeg',
    enum: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
  })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4'], {
    message: 'Unsupported MIME type. Allowed: image/jpeg, image/png, image/webp, video/mp4.',
  })
  mimeType!: string;

  @ApiProperty({
    example: 1048576,
    description: 'File size in bytes (max 52,428,800 bytes / 50MB)',
  })
  @IsInt()
  @Min(1)
  @Max(52_428_800, { message: 'File size exceeds maximum 50MB limit.' })
  fileSizeBytes!: number;
}

export class ConfirmMediaUploadDto {
  @ApiProperty({ example: 'workspaces/60b8.../media/uuid-photo.jpg' })
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @ApiProperty({ example: 'product_photo.jpg' })
  @IsString()
  @IsNotEmpty()
  originalFilename!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ example: 1048576 })
  @IsInt()
  fileSizeBytes!: number;

  @ApiPropertyOptional({ example: 1080 })
  @IsOptional()
  @IsInt()
  width?: number;

  @ApiPropertyOptional({ example: 1080 })
  @IsOptional()
  @IsInt()
  height?: number;
}
