import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'seller@example.com', description: 'User account email' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty()
  email!: string;
}
