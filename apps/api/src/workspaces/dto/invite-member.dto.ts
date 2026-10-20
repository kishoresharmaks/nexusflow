import { IsEmail, IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '@commercepilot/database';

export class InviteMemberDto {
  @ApiProperty({ example: 'colleague@example.com', description: 'Invitee email' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    enum: [WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER],
    example: WorkspaceRole.MEMBER,
    description: 'Role to grant after the recipient accepts the invitation',
  })
  @IsIn([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER], {
    message: 'Invitation role must be ADMIN, MEMBER, or VIEWER. Ownership uses the transfer flow.',
  })
  @IsNotEmpty()
  role!: WorkspaceRole;
}
