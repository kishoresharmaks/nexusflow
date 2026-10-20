import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    example: 'Switching to another workspace',
    description: 'Optional cancellation rationale for product diagnostics',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
