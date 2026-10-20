import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'seller@example.com', description: 'User email' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  password!: string;
}
