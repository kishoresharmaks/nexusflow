import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService, LivenessResult, ReadinessResult } from './health.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get(['health', 'api/v1/health'])
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Application is alive and responding' })
  getLiveness(): LivenessResult {
    return this.healthService.getLiveness();
  }

  @Get(['ready', 'api/v1/ready'])
  @ApiOperation({ summary: 'Readiness probe checking database and redis' })
  @ApiResponse({ status: 200, description: 'Application and dependencies are ready' })
  @ApiResponse({ status: 503, description: 'One or more required dependencies are not ready' })
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<ReadinessResult> {
    const result = await this.healthService.checkReadiness();
    if (result.status !== 'ready') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
