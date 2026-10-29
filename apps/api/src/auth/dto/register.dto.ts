import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'seller@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Password (min 8 characters)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  password!: string;

  @ApiProperty({ example: 'Jane Doe', description: 'Full name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Flagship Store', description: 'Initial workspace name' })
  @IsString()
  @IsOptional()
  workspaceName?: string;

  @ApiPropertyOptional({ description: 'Invitation token if registering via a workspace invite' })
  @IsString()
  @IsOptional()
  invitationToken?: string;
}
