import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({
    description: 'Current user password confirmation required to permanently delete account',
    example: 'Password123!',
  })
  @IsNotEmpty({ message: 'Password confirmation is required.' })
  @IsString()
  @MinLength(8)
  passwordConfirm!: string;
}
