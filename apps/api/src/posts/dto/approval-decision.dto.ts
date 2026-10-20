import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ApprovalDecisionDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  decisionNotes?: string | undefined;
}
