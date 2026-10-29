import { Controller, Get, Param, Req, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { TrackingService } from './tracking.service';

@ApiTags('Public Tracking')
@Controller()
export class PublicTrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get(['t/:code', 'api/v1/t/:code'])
  @ApiOperation({
    summary: 'Public redirect endpoint for tracked marketing attribution links',
  })
  @ApiResponse({ status: 302, description: 'Redirect to target store with attribution params' })
  @ApiResponse({ status: 404, description: 'Tracking link not found or expired' })
  async handleRedirect(
    @Param('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const rawIp =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      req.ip ||
      undefined;
    const clientIp = rawIp ? rawIp.split(',')[0]?.trim() : undefined;
    const userAgent = (req.headers['user-agent'] as string) || undefined;
    const referrer = (req.headers['referer'] as string) || undefined;

    const { destinationUrl } = await this.trackingService.resolveAndRecordClick(
      code,
      clientIp,
      userAgent,
      referrer,
    );

    res.redirect(HttpStatus.FOUND, destinationUrl);
  }
}
