import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateAccountDto {
  @ApiProperty({ description: 'Account activation token received via email' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'New account password (minimum 8 characters)', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  password!: string;
}
