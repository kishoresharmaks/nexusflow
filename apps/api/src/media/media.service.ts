import { Injectable, BadRequestException, NotFoundException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
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
  private readonly s3Endpoint: string | undefined;
  private readonly s3Bucket: string;
  private readonly s3Region: string;
  private readonly storageConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    const rawEndpoint =
      this.configService.get<string>('s3Endpoint') ||
      process.env['S3_ENDPOINT'];
    this.s3Endpoint = rawEndpoint;
    this.s3Bucket =
      this.configService.get<string>('s3Bucket') ||
      process.env['S3_BUCKET'] ||
      '';
    this.s3Region =
      this.configService.get<string>('s3Region') ||
      process.env['S3_REGION'] ||
      'us-east-1';

    const accessKeyId =
      this.configService.get<string>('s3AccessKeyId') ||
      process.env['S3_ACCESS_KEY_ID'] ||
      '';
    const secretAccessKey =
      this.configService.get<string>('s3SecretAccessKey') ||
      process.env['S3_SECRET_ACCESS_KEY'] ||
      '';
    const forcePathStyle =
      (this.configService.get<string>('s3ForcePathStyle') ||
        process.env['S3_FORCE_PATH_STYLE']) !== 'false';

    this.storageConfigured = Boolean(this.s3Bucket && accessKeyId && secretAccessKey);
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

  private requireStorageConfiguration(): void {
    if (!this.storageConfigured) {
      throw new ServiceUnavailableException(
        'Private object storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY server-side.',
      );
    }
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
    this.requireStorageConfiguration();

    const cleanName = this.sanitizeFilename(dto.filename);
    const uniqueId = randomUUID();
    const storageKey = `workspaces/${workspaceId}/media/${uniqueId}-${cleanName}`;
    const expiresInSeconds = 900; // 15 minutes

    try {
      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: storageKey,
        ContentType: dto.mimeType,
      });
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
      return {
        uploadUrl,
        storageKey,
        expiresInSeconds,
        expectedHeaders: { 'Content-Type': dto.mimeType },
      };
    } catch (error) {
      this.logger.error(`Failed to generate S3 presigned PUT URL: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Unable to generate a secure upload URL from object storage.');
    }
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
    this.requireStorageConfiguration();

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
      this.logger.warn(`HeadObject verification failed: ${(err as Error)?.message || 'unknown error'}`);
      throw new BadRequestException('Uploaded object could not be verified in private object storage.');
    }

    const asset = await this.prisma.mediaAsset.create({
      data: {
        workspaceId,
        storageKey: dto.storageKey,
        originalFilename: dto.originalFilename,
        mimeType: dto.mimeType,
        fileSizeBytes: dto.fileSizeBytes,
        width: dto.width ?? null,
        height: dto.height ?? null,
        // Private assets are retrieved only through the authenticated download-url endpoint.
        url: '',
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
    this.requireStorageConfiguration();
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
      throw new ServiceUnavailableException('Unable to generate a secure download URL from object storage.');
    }
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

    this.requireStorageConfiguration();
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key: asset.storageKey,
        }),
      );
    } catch (s3Err) {
      this.logger.warn(`Failed to delete object from S3 storage: ${(s3Err as Error).message}`);
      throw new ServiceUnavailableException('Object deletion could not be confirmed; media metadata was preserved.');
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

  /**
   * Diagnostic probe to verify live S3 bucket connectivity.
   */
  async checkS3Connectivity(): Promise<{ connected: boolean; bucket: string; region: string; error?: string }> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.s3Bucket }));
      return { connected: true, bucket: this.s3Bucket, region: this.s3Region };
    } catch (err) {
      return {
        connected: false,
        bucket: this.s3Bucket,
        region: this.s3Region,
        error: (err as Error).message,
      };
    }
  }
}
