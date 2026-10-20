import { IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartOwnershipTransferDto {
  @ApiProperty({ description: 'Membership ID of an existing verified workspace member' })
  @IsMongoId()
  @IsNotEmpty()
  membershipId!: string;
}
