import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceRole } from '@commercepilot/database';

export class CreateMemberDto {
  @ApiProperty({ example: 'Jane Doe', description: 'Full name of the new member' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Full name must have at least 2 characters.' })
  name!: string;

  @ApiProperty({ example: 'jane.doe@example.com', description: 'Email address of the member' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    enum: [WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER],
    example: WorkspaceRole.MEMBER,
    description: 'Workspace role for the member',
  })
  @IsIn([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER], {
    message: 'Role must be ADMIN, MEMBER, or VIEWER. Ownership requires the transfer flow.',
  })
  @IsNotEmpty()
  role!: WorkspaceRole;

  @ApiPropertyOptional({ example: 'Marketing', description: 'Department or team' })
  @IsOptional()
  @IsString()
  department?: string;
}
