import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductsService } from '../src/products/products.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/audit/audit.service';
import { ImportStatus } from '@commercepilot/database';

describe('ProductsService', () => {
  let service: ProductsService;
  let mockPrisma: any;
  let mockAuditService: Partial<AuditService>;

  const workspaceId = '60b8d29f1c9d440000a11111';
  const otherWorkspaceId = '60b8d29f1c9d440000a22222';
  const productId = '60b8d29f1c9d440000a33333';
  const userId = '60b8d29f1c9d440000a44444';

  beforeEach(() => {
    mockPrisma = {
      product: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      catalogImport: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    };

    mockAuditService = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new ProductsService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as AuditService,
    );
  });

  describe('Product CRUD and validation', () => {
    it('creates a new product successfully with freshness metadata', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({
        id: productId,
        workspaceId,
        sku: 'SKU-001',
        title: 'Premium Linen Shirt',
        priceCents: 4500,
        currency: 'USD',
        inventoryCount: 15,
        isActive: true,
        freshnessCheckedAt: new Date(),
        updatedAt: new Date(),
        createdAt: new Date(),
      });

      const res = await service.createProduct(
        workspaceId,
        {
          sku: 'SKU-001',
          title: 'Premium Linen Shirt',
          priceCents: 4500,
        },
        userId,
      );

      expect(res.id).toBe(productId);
      expect(res.title).toBe('Premium Linen Shirt');
      expect(res.priceCents).toBe(4500);
      expect(res.isStale).toBe(false);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_CREATED' }),
      );
    });

    it('rejects product creation when SKU already exists in workspace', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'existing', sku: 'SKU-001' });

      await expect(
        service.createProduct(
          workspaceId,
          {
            sku: 'SKU-001',
            title: 'Another Shirt',
            priceCents: 3000,
          },
          userId,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('updates a product and refreshes freshness timestamp', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: productId,
        workspaceId,
        sku: 'SKU-001',
      });
      mockPrisma.product.update.mockResolvedValue({
        id: productId,
        workspaceId,
        sku: 'SKU-001',
        title: 'Updated Shirt',
        priceCents: 4900,
        freshnessCheckedAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.updateProduct(
        workspaceId,
        productId,
        { title: 'Updated Shirt', priceCents: 4900 },
        userId,
      );

      expect(res.title).toBe('Updated Shirt');
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_UPDATED' }),
      );
    });

    it('deletes a product belonging to the workspace', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: productId,
        workspaceId,
        title: 'To Delete',
      });
      mockPrisma.product.delete.mockResolvedValue({ id: productId });

      const res = await service.deleteProduct(workspaceId, productId, userId);

      expect(res.success).toBe(true);
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: productId } });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_DELETED' }),
      );
    });
  });

  describe('Search and pagination', () => {
    it('returns paginated products and computes stale flags', async () => {
      const freshDate = new Date();
      const staleDate = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72 hours ago

      mockPrisma.product.count.mockResolvedValue(2);
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          workspaceId,
          title: 'Fresh Shoes',
          priceCents: 8000,
          freshnessCheckedAt: freshDate,
          updatedAt: freshDate,
        },
        {
          id: 'prod-2',
          workspaceId,
          title: 'Old Boots',
          priceCents: 12000,
          freshnessCheckedAt: staleDate,
          updatedAt: staleDate,
        },
      ]);

      const res = await service.findProducts(workspaceId, { page: 1, limit: 10, search: 'shoes' });

      expect(res.meta.total).toBe(2);
      expect(res.items.length).toBe(2);
      expect(res.items[0]?.isStale).toBe(false);
      expect(res.items[1]?.isStale).toBe(true);
    });
  });

  describe('Cross-tenant isolation boundaries', () => {
    it('throws NotFoundException when trying to fetch a product belonging to another workspace', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.getProductById(otherWorkspaceId, productId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when trying to update a product belonging to another workspace', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProduct(otherWorkspaceId, productId, { title: 'Hacked' }, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when trying to delete a product belonging to another workspace', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.deleteProduct(otherWorkspaceId, productId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('CSV Import processing and error reporting', () => {
    it('processes CSV, imports valid products, records row errors, and tracks import status', async () => {
      mockPrisma.catalogImport.create.mockResolvedValue({
        id: 'import-123',
        workspaceId,
        fileName: 'catalog.csv',
        status: ImportStatus.PROCESSING,
      });

      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ id: 'p1' });

      mockPrisma.catalogImport.update.mockImplementation(async ({ data }: any) => ({
        id: 'import-123',
        ...data,
      }));

      const csvContent =
        `sku,title,price,inventory\r\n` +
        `SKU-OK1,Valid Shirt,24.99,10\r\n` +
        `SKU-BAD1,,15.00,5\r\n` +
        `SKU-BAD2,Negative Price,-5.00,20\r\n` +
        `SKU-OK2,Valid Pants,49.50,15`;

      const result = await service.importCsv(
        workspaceId,
        {
          fileName: 'catalog.csv',
          csvContent,
        },
        userId,
      );

      expect(result.status).toBe(ImportStatus.COMPLETED);
      expect(result.totalRows).toBe(4);
      expect(result.importedRows).toBe(2);
      expect(result.failedRows).toBe(2);
      expect(Array.isArray(result.errors)).toBe(true);

      const errors = result.errors as any[];
      expect(errors.length).toBe(2);
      expect(errors[0].rowNumber).toBe(3); // Line 3: missing title
      expect(errors[1].rowNumber).toBe(4); // Line 4: negative price

      expect(mockPrisma.product.create).toHaveBeenCalledTimes(2);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CATALOG_IMPORTED' }),
      );
    });

    it('marks import status as FAILED when 0 valid rows are imported', async () => {
      mockPrisma.catalogImport.create.mockResolvedValue({
        id: 'import-failed',
        workspaceId,
        fileName: 'bad.csv',
        status: ImportStatus.PROCESSING,
      });

      mockPrisma.catalogImport.update.mockImplementation(async ({ data }: any) => ({
        id: 'import-failed',
        ...data,
      }));

      const csvContent = `sku,title,price\r\nSKU-1,,invalid\r\nSKU-2,,-10`;

      const result = await service.importCsv(
        workspaceId,
        {
          fileName: 'bad.csv',
          csvContent,
        },
        userId,
      );

      expect(result.status).toBe(ImportStatus.FAILED);
      expect(result.importedRows).toBe(0);
      expect(result.failedRows).toBe(2);
    });
  });
});
