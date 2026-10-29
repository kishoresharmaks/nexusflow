import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivatePlanDto {
  @ApiProperty({
    example: 'order_PXr8k9bZ3aQ2',
    description:
      'Razorpay order id created during checkout. Activation is gated on the verified payment.captured webhook for this order.',
  })
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}
