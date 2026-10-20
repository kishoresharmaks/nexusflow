import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SchedulePostDto {
  @ApiProperty({ example: '2026-11-01T15:00:00.000Z', description: 'Target UTC timestamp to publish' })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: '60b8d29f1c9d440000a22222', description: 'Target social account ID' })
  @IsOptional()
  @IsString()
  socialAccountId?: string;
}
