import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'reset-token-xyz',
    description: 'Password reset token received via email',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'NewSecurePassword123!', description: 'New password (min 8 characters)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  newPassword!: string;
}
