import { IsEmail, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ResendVerificationDto {
  @ApiPropertyOptional({ description: 'User email address if requesting without active session' })
  @IsOptional()
  @IsEmail({}, { message: 'A valid email address is required.' })
  email?: string;
}
