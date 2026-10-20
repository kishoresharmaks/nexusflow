import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({
    example: 'GROWTH',
    description: 'Target plan identifier (FREE, STARTER, GROWTH, PRO)',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['FREE', 'STARTER', 'GROWTH', 'PRO'])
  planId!: string;
}
