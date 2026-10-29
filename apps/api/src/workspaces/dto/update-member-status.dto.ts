import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '@commercepilot/database';

export class UpdateMemberStatusDto {
  @ApiProperty({
    enum: [MembershipStatus.ACTIVE, MembershipStatus.SUSPENDED],
    example: MembershipStatus.SUSPENDED,
    description: 'Target workspace membership status',
  })
  @IsIn([MembershipStatus.ACTIVE, MembershipStatus.SUSPENDED], {
    message: 'Membership status can only be set to ACTIVE or SUSPENDED.',
  })
  @IsNotEmpty()
  status!: MembershipStatus;

  @ApiPropertyOptional({ example: 'Policy violation', description: 'Optional reason for suspension' })
  @IsOptional()
  @IsString()
  reason?: string;
}
