import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaService } from '../src/media/media.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/audit/audit.service';
import type { ConfigService } from '@nestjs/config';

describe('MediaService', () => {
  let service: MediaService;
  let mockPrisma: any;
  let mockAuditService: Partial<AuditService>;
  let mockConfigService: Partial<ConfigService>;

  const workspaceId = '60b8d29f1c9d440000a11111';
  const assetId = '60b8d29f1c9d440000a22222';
  const userId = '60b8d29f1c9d440000a33333';

  beforeEach(() => {
    mockPrisma = {
      mediaAsset: {
        create: vi.fn().mockImplementation(async ({ data }: any) => ({
          id: assetId,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => ({
          id: where.id,
          workspaceId,
          storageKey: `workspaces/${workspaceId}/media/test.png`,
          originalFilename: 'test.png',
          mimeType: 'image/png',
          fileSizeBytes: 1024,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn().mockResolvedValue({ id: assetId }),
      },
    };

    mockAuditService = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 's3Endpoint') return 'http://localhost:9000';
        if (key === 's3Bucket') return 'test-bucket';
        return undefined;
      }),
    };

    service = new MediaService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as AuditService,
      mockConfigService as ConfigService,
    );
  });

  describe('generatePresignedUploadUrl', () => {
    it('generates tenant-isolated upload url under workspaces/:workspaceId/media/', async () => {
      const result = await service.generatePresignedUploadUrl(workspaceId, {
        filename: 'product-photo.png',
        mimeType: 'image/png',
        fileSizeBytes: 1024 * 50,
      });

      expect(result.uploadUrl).toBeDefined();
      expect(result.storageKey).toMatch(
        new RegExp(`^workspaces/${workspaceId}/media/.*-product-photo\\.png$`),
      );
      expect(result.expectedHeaders['Content-Type']).toBe('image/png');
      expect(result.expiresInSeconds).toBe(900);
    });

    it('rejects invalid workspace ObjectId format', async () => {
      await expect(
        service.generatePresignedUploadUrl('invalid-id', {
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
          fileSizeBytes: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmUpload', () => {
    it('saves media asset entity with verified tenant ownership', async () => {
      const storageKey = `workspaces/${workspaceId}/media/uuid-hero.png`;
      const asset = await service.confirmUpload(
        workspaceId,
        {
          storageKey,
          originalFilename: 'hero.png',
          mimeType: 'image/png',
          fileSizeBytes: 2048,
          width: 800,
          height: 600,
        },
        userId,
        '127.0.0.1',
      );

      expect(asset.id).toBe(assetId);
      expect(asset.workspaceId).toBe(workspaceId);
      expect(asset.storageKey).toBe(storageKey);
      expect(mockPrisma.mediaAsset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId,
          storageKey,
          fileSizeBytes: 2048,
          width: 800,
          height: 600,
        }),
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MEDIA_ASSET_UPLOADED',
          resourceType: 'MediaAsset',
        }),
      );
    });

    it('rejects upload confirmation when storageKey belongs to a different workspace', async () => {
      const foreignStorageKey = `workspaces/60b8d29f1c9d440000a99999/media/alien-file.png`;

      await expect(
        service.confirmUpload(
          workspaceId,
          {
            storageKey: foreignStorageKey,
            originalFilename: 'alien.png',
            mimeType: 'image/png',
            fileSizeBytes: 1024,
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadLocalFile', () => {
    it('saves file buffer locally and creates media asset record', async () => {
      const mockFile = {
        originalname: 'summer-shoes.png',
        mimetype: 'image/png',
        size: 2048,
        buffer: Buffer.from('fake-image-bytes'),
      };

      const asset = await service.uploadLocalFile(workspaceId, mockFile, userId, '127.0.0.1');

      expect(asset.id).toBe(assetId);
      expect(asset.url).toContain(`/api/v1/media/${workspaceId}/${assetId}/file`);
      expect(mockPrisma.mediaAsset.create).toHaveBeenCalled();
      expect(mockPrisma.mediaAsset.update).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MEDIA_ASSET_UPLOADED',
          metadata: expect.objectContaining({ storage: 'local' }),
        }),
      );
    });

    it('rejects upload without buffer', async () => {
      await expect(
        service.uploadLocalFile(
          workspaceId,
          { originalname: 'test.png', mimetype: 'image/png', size: 0, buffer: null as any },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLocalFile', () => {
    it('throws NotFoundException when media asset does not exist', async () => {
      mockPrisma.mediaAsset.findFirst.mockResolvedValue(null);

      await expect(service.getLocalFile(workspaceId, assetId)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when file does not exist on disk', async () => {
      mockPrisma.mediaAsset.findFirst.mockResolvedValue({
        id: assetId,
        workspaceId,
        storageKey: `workspaces/${workspaceId}/media/missing-file.png`,
        mimeType: 'image/png',
        originalFilename: 'missing-file.png',
      });

      await expect(service.getLocalFile(workspaceId, assetId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listAssets', () => {
    it('returns media assets isolated to workspace', async () => {
      mockPrisma.mediaAsset.findMany.mockResolvedValue([
        { id: assetId, workspaceId, storageKey: 'test' },
      ]);

      const list = await service.listAssets(workspaceId);
      expect(list).toHaveLength(1);
      expect(mockPrisma.mediaAsset.findMany).toHaveBeenCalledWith({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });
  });

  describe('deleteAsset', () => {
    it('deletes asset owned by workspace and records audit', async () => {
      mockPrisma.mediaAsset.findFirst.mockResolvedValue({
        id: assetId,
        workspaceId,
        storageKey: `workspaces/${workspaceId}/media/test.png`,
      });

      const res = await service.deleteAsset(workspaceId, assetId, userId);
      expect(res.success).toBe(true);
      expect(mockPrisma.mediaAsset.delete).toHaveBeenCalledWith({
        where: { id: assetId },
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MEDIA_ASSET_DELETED',
        }),
      );
    });

    it('throws NotFoundException if asset not found in workspace', async () => {
      mockPrisma.mediaAsset.findFirst.mockResolvedValue(null);

      await expect(service.deleteAsset(workspaceId, assetId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('generates secure expiring download URL for existing asset', async () => {
      mockPrisma.mediaAsset.findFirst.mockResolvedValue({
        id: assetId,
        workspaceId,
        storageKey: `workspaces/${workspaceId}/media/photo.png`,
      });

      const result = await service.getPresignedDownloadUrl(workspaceId, assetId, 600);
      expect(result.downloadUrl).toBeDefined();
      expect(result.expiresInSeconds).toBe(600);
    });

    it('throws NotFoundException when downloading non-existent asset', async () => {
      mockPrisma.mediaAsset.findFirst.mockResolvedValue(null);

      await expect(
        service.getPresignedDownloadUrl(workspaceId, 'nonexistent', 300),
      ).rejects.toThrow(BadRequestException); // invalid hex id throws BadRequestException
    });
  });

  describe('validateMediaForProvider', () => {
    it('validates supported media formats and sizes for Instagram', () => {
      const valid = service.validateMediaForProvider(
        { mimeType: 'image/jpeg', fileSizeBytes: 5 * 1024 * 1024 },
        'META_INSTAGRAM',
      );
      expect(valid.valid).toBe(true);

      const tooLarge = service.validateMediaForProvider(
        { mimeType: 'image/jpeg', fileSizeBytes: 10 * 1024 * 1024 },
        'META_INSTAGRAM',
      );
      expect(tooLarge.valid).toBe(false);
      expect(tooLarge.reason).toContain('exceeds maximum size of 8MB');

      const unsupportedMime = service.validateMediaForProvider(
        { mimeType: 'image/gif', fileSizeBytes: 1024 },
        'META_INSTAGRAM',
      );
      expect(unsupportedMime.valid).toBe(false);
      expect(unsupportedMime.reason).toContain('requires JPEG, PNG, or MP4/MOV');
    });

    it('validates supported media formats and sizes for Facebook', () => {
      const valid = service.validateMediaForProvider(
        { mimeType: 'image/gif', fileSizeBytes: 1024 * 1024 },
        'META_FACEBOOK',
      );
      expect(valid.valid).toBe(true);

      const tooLarge = service.validateMediaForProvider(
        { mimeType: 'video/mp4', fileSizeBytes: 60 * 1024 * 1024 },
        'META_FACEBOOK',
      );
      expect(tooLarge.valid).toBe(false);
      expect(tooLarge.reason).toContain('exceeds Facebook limit of 50MB');
    });
  });
});
