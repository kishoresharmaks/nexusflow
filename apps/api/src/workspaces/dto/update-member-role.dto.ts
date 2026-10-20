import { IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '@commercepilot/database';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: [WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER],
    example: WorkspaceRole.ADMIN,
    description: 'Updated role; use the ownership transfer flow for OWNER',
  })
  @IsIn([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER], {
    message: 'Role must be ADMIN, MEMBER, or VIEWER. Ownership uses the transfer flow.',
  })
  @IsNotEmpty()
  role!: WorkspaceRole;
}
