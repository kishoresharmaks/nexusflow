import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestUploadUrlDto, ConfirmMediaUploadDto } from './dto/media.dto';
import { MediaAsset } from '@commercepilot/database';

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  expectedHeaders: Record<string, string>;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresInSeconds: number;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3Client: S3Client;
  private readonly s3Endpoint?: string;
  private readonly s3Bucket: string;
  private readonly s3Region: string;
  private readonly localStorageDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    this.localStorageDir =
      this.configService.get<string>('localMediaDir') ||
      process.env['LOCAL_MEDIA_DIR'] ||
      path.resolve(process.cwd(), 'uploads', 'media');
    const rawEndpoint =
      this.configService.get<string>('s3Endpoint') ||
      process.env['S3_ENDPOINT'] ||
      'http://localhost:9000';
    this.s3Endpoint = rawEndpoint;
    this.s3Bucket =
      this.configService.get<string>('s3Bucket') ||
      process.env['S3_BUCKET'] ||
      'commercepilot-media';
    this.s3Region =
      this.configService.get<string>('s3Region') ||
      process.env['S3_REGION'] ||
      'us-east-1';

    const accessKeyId =
      this.configService.get<string>('s3AccessKeyId') ||
      process.env['S3_ACCESS_KEY_ID'] ||
      'minioadmin';
    const secretAccessKey =
      this.configService.get<string>('s3SecretAccessKey') ||
      process.env['S3_SECRET_ACCESS_KEY'] ||
      'minioadmin';
    const forcePathStyle =
      (this.configService.get<string>('s3ForcePathStyle') ||
        process.env['S3_FORCE_PATH_STYLE']) !== 'false';

    this.s3Client = new S3Client({
      region: this.s3Region,
      ...(this.s3Endpoint ? { endpoint: this.s3Endpoint } : {}),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    });
  }

  private validateObjectId(id: string, label = 'ID'): void {
    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw new BadRequestException(`Invalid ${label} format.`);
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  }

  /**
   * Generates a pre-signed S3 upload URL for private object storage using AWS S3 SDK.
   * Path is strictly tenant-isolated under workspaces/:workspaceId/media/.
   */
  async generatePresignedUploadUrl(
    workspaceId: string,
    dto: RequestUploadUrlDto,
  ): Promise<PresignedUploadResult> {
    this.validateObjectId(workspaceId, 'workspace ID');

    const cleanName = this.sanitizeFilename(dto.filename);
    const uniqueId = randomUUID();
    const storageKey = `workspaces/${workspaceId}/media/${uniqueId}-${cleanName}`;
    const expiresInSeconds = 900; // 15 minutes

    let uploadUrl: string;
    try {
      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: storageKey,
        ContentType: dto.mimeType,
      });
      uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    } catch (error) {
      this.logger.error(`Failed to generate S3 presigned PUT URL: ${(error as Error).message}`);
      if (process.env['NODE_ENV'] === 'production' || process.env['NODE_ENV'] === 'staging') {
        throw new BadRequestException('Failed to generate pre-signed upload URL from storage service.');
      }
      uploadUrl = `${this.s3Endpoint}/${this.s3Bucket}/${storageKey}?mockSig=true`;
    }

    return {
      uploadUrl,
      storageKey,
      expiresInSeconds,
      expectedHeaders: {
        'Content-Type': dto.mimeType,
      },
    };
  }

  /**
   * Confirms upload and registers MediaAsset entity.
   * Performs server-side HeadObject validation to verify real object metadata in storage.
   */
  async confirmUpload(
    workspaceId: string,
    dto: ConfirmMediaUploadDto,
    userId: string,
    clientIp?: string,
  ): Promise<MediaAsset> {
    this.validateObjectId(workspaceId, 'workspace ID');

    // Ensure storageKey belongs to this tenant
    if (!dto.storageKey.startsWith(`workspaces/${workspaceId}/`)) {
      throw new BadRequestException('Storage key does not belong to the target workspace.');
    }

    // Verify object exists in storage via HeadObjectCommand
    try {
      const head = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.s3Bucket,
          Key: dto.storageKey,
        }),
      );
      if (head.ContentLength) {
        dto.fileSizeBytes = head.ContentLength;
      }
      if (head.ContentType) {
        dto.mimeType = head.ContentType;
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || 'HeadObject failed';
      if (process.env['NODE_ENV'] === 'production' || process.env['NODE_ENV'] === 'staging') {
        throw new BadRequestException(
          `Uploaded object could not be verified in storage: ${errorMsg}`,
        );
      }
      this.logger.debug(`S3 HeadObject verification skipped in dev/test: ${errorMsg}`);
    }

    const publicUrl = `${this.s3Endpoint}/${this.s3Bucket}/${dto.storageKey}`;

    const asset = await this.prisma.mediaAsset.create({
      data: {
        workspaceId,
        storageKey: dto.storageKey,
        originalFilename: dto.originalFilename,
        mimeType: dto.mimeType,
        fileSizeBytes: dto.fileSizeBytes,
        width: dto.width ?? null,
        height: dto.height ?? null,
        url: publicUrl,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'MEDIA_ASSET_UPLOADED',
      resourceType: 'MediaAsset',
      resourceId: asset.id,
      metadata: {
        filename: asset.originalFilename,
        fileSizeBytes: asset.fileSizeBytes,
      },
      ipAddress: clientIp,
    });

    return asset;
  }

  /**
   * Generates a short-lived presigned download URL for private object access.
   */
  async getPresignedDownloadUrl(
    workspaceId: string,
    assetId: string,
    expiresInSeconds = 300,
  ): Promise<PresignedDownloadResult> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(assetId, 'asset ID');

    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, workspaceId },
    });

    if (!asset) {
      throw new NotFoundException('Media asset not found in this workspace.');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: asset.storageKey,
      });
      const downloadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
      return { downloadUrl, expiresInSeconds };
    } catch (error) {
      this.logger.error(`Failed to generate S3 presigned GET URL: ${(error as Error).message}`);
      if (process.env['NODE_ENV'] === 'production' || process.env['NODE_ENV'] === 'staging') {
        throw new BadRequestException('Failed to generate secure download URL.');
      }
      return {
        downloadUrl: `${this.s3Endpoint}/${this.s3Bucket}/${asset.storageKey}?mockSig=true`,
        expiresInSeconds,
      };
    }
  }

  /**
   * Directly uploads and saves media file to local disk storage for the workspace.
   * Path: uploads/media/:workspaceId/:uniqueId-:cleanName
   * Serves files through /api/v1/media/:workspaceId/:assetId/file
   */
  async uploadLocalFile(
    workspaceId: string,
    file: { originalname?: string; mimetype?: string; size: number; buffer: Buffer },
    userId: string,
    clientIp?: string,
  ): Promise<MediaAsset> {
    this.validateObjectId(workspaceId, 'workspace ID');

    if (!file || !file.buffer) {
      throw new BadRequestException('No file buffer provided for local upload.');
    }

    const cleanName = this.sanitizeFilename(file.originalname || 'upload.png');
    const uniqueId = randomUUID();
    const storageKey = `workspaces/${workspaceId}/media/${uniqueId}-${cleanName}`;

    const wsDir = path.join(this.localStorageDir, workspaceId);
    if (!fs.existsSync(wsDir)) {
      fs.mkdirSync(wsDir, { recursive: true });
    }

    const filePath = path.join(wsDir, `${uniqueId}-${cleanName}`);
    fs.writeFileSync(filePath, file.buffer);

    const apiBase =
      this.configService.get<string>('apiUrl') ||
      process.env['API_URL'] ||
      'http://localhost:4000';

    const asset = await this.prisma.mediaAsset.create({
      data: {
        workspaceId,
        storageKey,
        originalFilename: file.originalname || cleanName,
        mimeType: file.mimetype || 'application/octet-stream',
        fileSizeBytes: file.size,
        url: '',
      },
    });

    const fileUrl = `${apiBase.replace(/\/+$/, '')}/api/v1/media/${workspaceId}/${asset.id}/file`;
    const updatedAsset = await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { url: fileUrl },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'MEDIA_ASSET_UPLOADED',
      resourceType: 'MediaAsset',
      resourceId: updatedAsset.id,
      metadata: {
        filename: updatedAsset.originalFilename,
        fileSizeBytes: updatedAsset.fileSizeBytes,
        storage: 'local',
      },
      ipAddress: clientIp,
    });

    return updatedAsset;
  }

  /**
   * Retrieves binary file details from local disk storage.
   */
  async getLocalFile(
    workspaceId: string,
    assetId: string,
  ): Promise<{ filePath: string; mimeType: string; originalFilename: string }> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(assetId, 'asset ID');

    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, workspaceId },
    });

    if (!asset) {
      throw new NotFoundException('Media asset not found in this workspace.');
    }

    const fileName = path.basename(asset.storageKey);
    const filePath = path.join(this.localStorageDir, workspaceId, fileName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Media file not found in local storage.');
    }

    return {
      filePath,
      mimeType: asset.mimeType,
      originalFilename: asset.originalFilename,
    };
  }

  /**
   * List media assets for workspace.
   */
  async listAssets(workspaceId: string): Promise<MediaAsset[]> {
    this.validateObjectId(workspaceId, 'workspace ID');
    return this.prisma.mediaAsset.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Delete media asset: removes both local storage / S3 storage object and database record.
   */
  async deleteAsset(
    workspaceId: string,
    assetId: string,
    userId: string,
    clientIp?: string,
  ): Promise<{ success: boolean; id: string }> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(assetId, 'asset ID');

    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, workspaceId },
    });

    if (!asset) {
      throw new NotFoundException('Media asset not found in this workspace.');
    }

    // Attempt local storage file removal
    if (asset.storageKey) {
      try {
        const fileName = path.basename(asset.storageKey);
        const localFilePath = path.join(this.localStorageDir, workspaceId, fileName);
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
      } catch (localErr) {
        this.logger.warn(`Failed to delete local media file: ${(localErr as Error).message}`);
      }
    }

    // Attempt S3 storage removal if configured
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key: asset.storageKey,
        }),
      );
    } catch (s3Err) {
      this.logger.warn(`Failed to delete object from S3 storage: ${(s3Err as Error).message}`);
    }

    await this.prisma.mediaAsset.delete({
      where: { id: assetId },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'MEDIA_ASSET_DELETED',
      resourceType: 'MediaAsset',
      resourceId: assetId,
      ipAddress: clientIp,
    });

    return { success: true, id: assetId };
  }

  /**
   * Validates media suitability against provider limits before publishing.
   */
  validateMediaForProvider(
    media: { mimeType: string; fileSizeBytes: number; width?: number | null; height?: number | null },
    provider: string,
  ): { valid: boolean; reason?: string } {
    const isInstagram = provider.toLowerCase().includes('instagram');
    const isFacebook = provider.toLowerCase().includes('meta') || provider.toLowerCase().includes('facebook');

    if (isInstagram) {
      const allowedMimes = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'];
      if (!allowedMimes.includes(media.mimeType)) {
        return {
          valid: false,
          reason: `Instagram requires JPEG, PNG, or MP4/MOV video. Received: ${media.mimeType}`,
        };
      }
      if (media.mimeType.startsWith('image/') && media.fileSizeBytes > 8 * 1024 * 1024) {
        return {
          valid: false,
          reason: `Instagram image exceeds maximum size of 8MB (${(media.fileSizeBytes / (1024 * 1024)).toFixed(1)}MB).`,
        };
      }
      if (media.mimeType.startsWith('video/') && media.fileSizeBytes > 100 * 1024 * 1024) {
        return {
          valid: false,
          reason: `Instagram video exceeds maximum size of 100MB (${(media.fileSizeBytes / (1024 * 1024)).toFixed(1)}MB).`,
        };
      }
    }

    if (isFacebook) {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'];
      if (!allowedMimes.includes(media.mimeType)) {
        return {
          valid: false,
          reason: `Facebook requires JPEG, PNG, GIF, WebP, or MP4 video. Received: ${media.mimeType}`,
        };
      }
      if (media.fileSizeBytes > 50 * 1024 * 1024) {
        return {
          valid: false,
          reason: 'Media file exceeds Facebook limit of 50MB.',
        };
      }
    }

    return { valid: true };
  }
}
