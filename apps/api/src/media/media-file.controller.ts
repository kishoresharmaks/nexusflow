import { Controller, Get, Param, Res, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import { MediaService } from './media.service';

@ApiTags('Media Storage & Assets')
@Controller('media')
export class MediaFileController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(':workspaceId/:assetId/file')
  @ApiOperation({ summary: 'Stream media asset binary file directly from local storage' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'assetId', description: 'Media asset ID' })
  @ApiResponse({ status: 200, description: 'Media file binary stream' })
  @Header('Cache-Control', 'public, max-age=86400')
  async getMediaFile(
    @Param('workspaceId') workspaceId: string,
    @Param('assetId') assetId: string,
    @Res() res: Response,
  ): Promise<void> {
    const fileInfo = await this.mediaService.getLocalFile(workspaceId, assetId);

    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileInfo.originalFilename)}"`,
    );

    const stream = fs.createReadStream(fileInfo.filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    stream.pipe(res);
  }
}
